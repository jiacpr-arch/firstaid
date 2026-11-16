import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkoutItem, sessionParams, parseBuyer, paidGrant, grantPaidSession, isGuestSession, guestClaimItem,
  guestReturn, clearClaimCookie, readCookie, CLAIM_COOKIE,
} from './stripeCheckout.js'
import { claimGuestPurchase } from './guestClaim.js'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE } from '../../src/config/pricing.js'

const SID = 'cs_test_guestSession123456'
const L_ME = '11111111-1111-4111-8111-111111111111'
const L_OTHER = '22222222-2222-4222-8222-222222222222'

const guestSession = (over = {}) => ({
  id: SID, mode: 'payment', payment_status: 'paid', currency: 'thb', amount_total: COURSE_BUNDLE_PRICE * 100,
  metadata: { app: 'firstaid', guest: '1', chapter: '0', buyer_name: 'สมชาย ใจดี', buyer_phone: '0812345678' },
  ...over,
})

// Supabase admin stand-in: lesson_entitlements select(eq order_ref)/upsert + jia_firstaid_hub_adopt rpc
function fakeAdmin(rows = [], { adopt = null } = {}) {
  const calls = { upserts: [], rpc: [] }
  return {
    rows, calls,
    rpc: async (name, args) => { calls.rpc.push([name, args]); return { data: adopt, error: null } },
    from: (table) => {
      assert.equal(table, 'lesson_entitlements')
      const filters = []
      const b = {
        select: () => b,
        eq: (c, v) => { filters.push([c, v]); return b },
        limit: () => Promise.resolve({ data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }),
        upsert: async (row) => {
          calls.upserts.push(row)
          const i = rows.findIndex((r) => r.learner_id === row.learner_id && r.chapter === row.chapter)
          if (i >= 0) rows[i] = { ...row }
          else rows.push({ ...row })
          return { error: null }
        },
      }
      return b
    },
  }
}

const claim = (admin, over = {}) => claimGuestPurchase({
  admin, auth: { userId: 'u1', learnerId: L_ME }, sessionId: SID,
  fetchSession: async () => guestSession(), receiptSecret: undefined, ...over,
})

test('parseBuyer: name 2–80 + Thai mobile, normalised', () => {
  assert.deepEqual(parseBuyer({ name: '  สมชาย   ใจดี ', phone: '081-234 5678' }), { name: 'สมชาย ใจดี', phone: '0812345678' })
  assert.deepEqual(parseBuyer({ name: 'Ann', phone: '+66812345678' }), { name: 'Ann', phone: '0812345678' })
  assert.deepEqual(parseBuyer({ name: 'Ann', phone: '021234567' }), { name: 'Ann', phone: '021234567' })
  assert.equal(parseBuyer({}), null)
  assert.equal(parseBuyer({ name: 'A', phone: '0812345678' }), null)
  assert.equal(parseBuyer({ name: 'x'.repeat(81), phone: '0812345678' }), null)
  assert.equal(parseBuyer({ name: 'Ann', phone: '812345678' }), null)
  assert.equal(parseBuyer({ name: 'Ann', phone: '08123' }), null)
  assert.equal(parseBuyer({ name: 'Ann', phone: '08123456789' }), null)
})

test('sessionParams guest: metadata guest=1 + buyer, no learner, server price, success via return route', () => {
  const p = sessionParams({ item: checkoutItem(0), buyer: { name: 'Ann B', phone: '0812345678' }, base: 'https://x.test' })
  assert.equal(p.get('metadata[guest]'), '1')
  assert.equal(p.get('metadata[buyer_name]'), 'Ann B')
  assert.equal(p.get('metadata[buyer_phone]'), '0812345678')
  assert.equal(p.get('metadata[app]'), 'firstaid')
  assert.equal(p.get('metadata[chapter]'), '0')
  assert.equal(p.get('metadata[learner_id]'), null)
  assert.equal(p.get('client_reference_id'), null)
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), String(COURSE_BUNDLE_PRICE * 100))
  assert.equal(p.get('success_url'), 'https://x.test/api/checkout/return?chapter=0&session_id={CHECKOUT_SESSION_ID}')
  assert.ok(!p.get('success_url').includes('0812345678') && !p.get('cancel_url').includes('0812345678'))
  assert.equal(p.get('cancel_url'), 'https://x.test/buy?cancelled=0')
  assert.throws(() => sessionParams({ item: checkoutItem(0), base: 'https://x.test' }), /buyer_required/)
})

test('sessionParams logged in: unchanged (learner metadata, /buy success, no guest fields)', () => {
  const p = sessionParams({ item: checkoutItem(2), learnerId: L_ME, userId: 'u1', buyer: { name: 'x', phone: 'y' }, base: 'https://x.test' })
  assert.equal(p.get('metadata[learner_id]'), L_ME)
  assert.equal(p.get('client_reference_id'), L_ME)
  assert.equal(p.get('metadata[guest]'), null)
  assert.equal(p.get('metadata[buyer_phone]'), null)
  assert.equal(p.get('success_url'), 'https://x.test/buy?session_id={CHECKOUT_SESSION_ID}')
})

test('guestReturn: HttpOnly 30-day cookie scoped to the claim path, id never in the app URL', () => {
  const r = guestReturn({ chapter: '2', session_id: SID })
  assert.equal(r.location, '/buy?guest_paid=2')
  assert.ok(!r.location.includes(SID))
  assert.equal(r.cookie, `${CLAIM_COOKIE}=${SID}; Path=/api/checkout/claim; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`)
  assert.equal(guestReturn({ chapter: '0', session_id: 'bogus;Path=/' }).cookie, null)
  assert.equal(guestReturn({ chapter: '99', session_id: SID }).location, '/buy?guest_paid=0')
  assert.match(clearClaimCookie(), /Max-Age=0/)
  assert.equal(readCookie(`a=1; ${CLAIM_COOKIE}=${SID}; b=2`, CLAIM_COOKIE), SID)
  assert.equal(readCookie('a=1', CLAIM_COOKIE), null)
})

test('guestClaimItem: only firstaid guest sessions at the server price', () => {
  assert.deepEqual(guestClaimItem(guestSession()), { chapter: 0 })
  assert.deepEqual(guestClaimItem(guestSession({ amount_total: CHAPTER_PRICES[3] * 100, metadata: { ...guestSession().metadata, chapter: '3' } })), { chapter: 3 })
  assert.equal(guestClaimItem(guestSession({ amount_total: 100 })), null)
  assert.equal(guestClaimItem(guestSession({ currency: 'usd' })), null)
  assert.equal(guestClaimItem(guestSession({ mode: 'subscription' })), null)
  assert.equal(guestClaimItem(guestSession({ metadata: { ...guestSession().metadata, app: 'bls' } })), null)
  assert.equal(guestClaimItem(guestSession({ metadata: { ...guestSession().metadata, chapter: '1' } })), null)
  assert.equal(guestClaimItem(guestSession({ metadata: { ...guestSession().metadata, learner_id: L_OTHER } })), null)
  assert.equal(guestClaimItem(guestSession({ metadata: { app: 'firstaid', chapter: '0' } })), null)
})

test('webhook path: guest sessions are acknowledged, never granted', async () => {
  assert.equal(isGuestSession(guestSession()), true)
  assert.equal(isGuestSession(guestSession({ metadata: { guest: '1', plan: 'bls_online365' } })), false) // other app's guest
  assert.equal(isGuestSession({ metadata: { app: 'firstaid', learner_id: L_ME, chapter: '0' } }), false)
  assert.equal(paidGrant(guestSession()), null)
  const admin = fakeAdmin()
  assert.equal(await grantPaidSession(admin, guestSession()), null)
  assert.equal(admin.calls.upserts.length, 0)
})

test('claim: success grants once to the logged-in learner and clears the cookie', async () => {
  const admin = fakeAdmin()
  const out = await claim(admin)
  assert.equal(out.status, 200)
  assert.equal(out.body.status, 'paid')
  assert.equal(out.body.chapter, 0)
  assert.equal(out.clear, true)
  assert.deepEqual(admin.calls.upserts, [{ learner_id: L_ME, chapter: 0, source: 'stripe', order_ref: `stripe:${SID}`, expires_at: null }])
  const again = await claim(admin)
  assert.equal(again.status, 200)
  assert.equal(again.body.status, 'paid')
  assert.equal(admin.calls.upserts.length, 1) // no second grant
})

test('claim: needs login', async () => {
  const admin = fakeAdmin()
  const out = await claim(admin, { auth: null })
  assert.equal(out.status, 401)
  assert.equal(admin.calls.upserts.length, 0)
})

test('claim: no / malformed cookie → 404 without calling Stripe', async () => {
  let called = false
  const out = await claim(fakeAdmin(), { sessionId: null, fetchSession: async () => { called = true } })
  assert.equal(out.status, 404)
  assert.equal(called, false)
  assert.equal((await claim(fakeAdmin(), { sessionId: 'cs_x;evil' })).status, 404)
})

test('claim: PromptPay not settled → pending, cookie kept, no grant', async () => {
  const admin = fakeAdmin()
  const out = await claim(admin, { fetchSession: async () => guestSession({ payment_status: 'unpaid' }) })
  assert.equal(out.status, 200)
  assert.equal(out.body.status, 'pending')
  assert.ok(!out.clear)
  assert.equal(admin.calls.upserts.length, 0)
})

test('claim: payment already attached to another account → 409, no grant', async () => {
  const admin = fakeAdmin([{ learner_id: L_OTHER, chapter: 0, order_ref: `stripe:${SID}` }])
  const out = await claim(admin)
  assert.equal(out.status, 409)
  assert.equal(out.body.error, 'claimed')
  assert.equal(admin.calls.upserts.length, 0)
})

test('claim: forged / other-product / underpaid / logged-in-owned sessions → no grant', async () => {
  const cases = [
    guestSession({ metadata: { guest: '1', plan: 'bls_online365', course: 'bls-online' } }),
    guestSession({ metadata: { ...guestSession().metadata, app: 'acls' } }),
    guestSession({ amount_total: 100 }),
    guestSession({ metadata: { app: 'firstaid', chapter: '0', learner_id: L_OTHER } }),
    guestSession({ id: 'cs_test_someOtherSession999' }),
    null,
  ]
  for (const s of cases) {
    const admin = fakeAdmin()
    const out = await claim(admin, { fetchSession: async () => s })
    assert.equal(out.status, 404, JSON.stringify(s))
    assert.equal(admin.calls.upserts.length, 0)
  }
})

test('claim: Stripe unreachable → 502, cookie kept', async () => {
  const out = await claim(fakeAdmin(), { fetchSession: async () => { throw new Error('stripe_error') } })
  assert.equal(out.status, 502)
  assert.ok(!out.clear)
})

test('claim: account with no learner adopts the device learner via the Hub rule, else 409 account_not_linked', async () => {
  const admin = fakeAdmin([], { adopt: { ok: true, learnerId: L_ME } })
  const out = await claim(admin, { auth: { userId: 'u1', learnerId: null }, learnerCandidate: L_ME })
  assert.equal(out.status, 200)
  assert.deepEqual(admin.calls.rpc[0], ['jia_firstaid_hub_adopt', { payload: { userId: 'u1', learnerId: L_ME } }])
  assert.equal(admin.calls.upserts[0].learner_id, L_ME)
  const refused = fakeAdmin([], { adopt: { ok: false } })
  const out2 = await claim(refused, { auth: { userId: 'u1', learnerId: null }, learnerCandidate: L_OTHER })
  assert.equal(out2.status, 409)
  assert.equal(out2.body.error, 'account_not_linked')
  assert.equal(refused.calls.upserts.length, 0)
})
