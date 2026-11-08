import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { checkoutItem, sessionParams, verifyStripeSignature, paidGrant } from './stripeCheckout.js'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE } from '../../src/config/pricing.js'

test('checkoutItem: bundle + paid chapters only, free chapter 1 not sellable', () => {
  assert.equal(checkoutItem(0).price, COURSE_BUNDLE_PRICE)
  assert.equal(checkoutItem('2').price, CHAPTER_PRICES[2])
  assert.equal(checkoutItem(5).price, CHAPTER_PRICES[5])
  assert.equal(checkoutItem(1), null)
  assert.equal(checkoutItem(9), null)
  assert.equal(checkoutItem('x'), null)
})

test('sessionParams: server price in satang, card + promptpay, metadata', () => {
  const p = sessionParams({ item: checkoutItem(0), learnerId: 'abc-123', userId: 'u1', base: 'https://x.test' })
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), String(COURSE_BUNDLE_PRICE * 100))
  assert.deepEqual(p.getAll('payment_method_types[]'), ['card', 'promptpay'])
  assert.equal(p.get('metadata[learner_id]'), 'abc-123')
  assert.equal(p.get('metadata[chapter]'), '0')
  assert.equal(p.get('success_url'), 'https://x.test/buy?session_id={CHECKOUT_SESSION_ID}')
})

test('verifyStripeSignature', () => {
  const secret = 'whsec_test'
  const body = '{"a":1}'
  const t = 1_800_000_000
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, { nowSec: t }), true)
  assert.equal(verifyStripeSignature(body + ' ', `t=${t},v1=${sig}`, secret, { nowSec: t }), false)
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, 'other', { nowSec: t }), false)
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, { nowSec: t + 1000 }), false)
  assert.equal(verifyStripeSignature(body, undefined, secret), false)
})

test('paidGrant: only paid firstaid sessions with the full amount', () => {
  const ok = { id: 'cs_1', payment_status: 'paid', currency: 'thb', amount_total: CHAPTER_PRICES[2] * 100, metadata: { app: 'firstaid', learner_id: 'L1', chapter: '2' } }
  assert.deepEqual(paidGrant(ok), { learnerId: 'L1', chapter: 2 })
  assert.equal(paidGrant({ ...ok, payment_status: 'unpaid' }), null)
  assert.equal(paidGrant({ ...ok, amount_total: 100 }), null)
  assert.equal(paidGrant({ ...ok, metadata: { ...ok.metadata, app: 'hub' } }), null)
  assert.equal(paidGrant({ ...ok, metadata: { ...ok.metadata, chapter: '1' } }), null)
})
