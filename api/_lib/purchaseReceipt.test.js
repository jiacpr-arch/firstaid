import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { createPurchaseReceipt, verifyPurchaseReceipt, RECEIPT_TTL_SECONDS } from './purchaseReceipt.js'
import { paidGrant } from './stripeCheckout.js'
import { checkoutAnalyticsBlocked, filterCheckoutAnalyticsEvent } from '../../src/lib/checkoutAnalyticsBoundary.js'
import { openPurchaseReceipt } from '../../src/utils/purchaseReceipt.js'
import { claimAttempt, consumeReceipt, eligibleReceiptDocument, validReceipt, startMeta, startGoogle, RECEIPT_URL, RECEIPT_KEY, choiceKey, attemptKey, GOOGLE_PURCHASE_ENABLED } from '../../public/purchase-receipt.js'
import { RECEIPT_HTML } from '../checkout/receipt-page.js'

const secret = 'synthetic-unit-test-only-not-a-live-secret'
const now = 1_800_000_000
const options = { now, environment: 'production' }
const paid = { id: 'cs_test_synthetic_paid_123456', livemode: true, mode: 'payment', status: 'complete', payment_status: 'paid', currency: 'thb', amount_total: 24900,
  metadata: { app: 'firstaid', learner_id: 'synthetic-private-learner', chapter: '0' } }
const fresh = () => ({ eventId: 'fa_purchase_' + 'a'.repeat(64), value: 249, currency: 'THB', expiresAt: Math.floor(Date.now() / 1000) + 600 })

function storage(values = new Map()) {
  return { values, getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
function fixture(shared = new Map()) {
  const scripts = [], navigations = []
  const win = {
    location: Object.assign(new URL(RECEIPT_URL), { replace: value => navigations.push(value) }),
    navigator: { webdriver: false, locks: { request: async (_key, _options, callback) => callback() } },
    sessionStorage: storage(), localStorage: storage(shared),
  }
  const doc = { referrer: '', createElement: () => ({}), head: { appendChild: value => scripts.push(value) } }
  return { win, doc, scripts, navigations }
}

test('paid receipt has stable opaque ID, actual amount, strict minimal response and 15 minute TTL', () => {
  const token = createPurchaseReceipt(paid, secret, options)
  const p = verifyPurchaseReceipt(token, secret, options)
  assert.deepEqual(Object.keys(p).sort(), ['currency', 'eventId', 'expiresAt', 'value'])
  assert.equal(p.value, 249); assert.equal(p.currency, 'THB'); assert.equal(p.expiresAt, now + RECEIPT_TTL_SECONDS)
  assert.equal(p.eventId, verifyPurchaseReceipt(createPurchaseReceipt(paid, secret, { ...options, now: now + 1 }), secret, { ...options, now: now + 1 }).eventId)
  const decoded = Buffer.from(token.split('.')[0], 'base64url').toString()
  for (const forbidden of [paid.id, paid.metadata.learner_id, 'chapter', 'email', 'userId']) assert.equal(decoded.includes(forbidden), false)
  assert.equal(verifyPurchaseReceipt(token, secret, { ...options, now: now + 900 }), null)
  assert.equal(verifyPurchaseReceipt(token, 'rotated-synthetic-key', options), null)
})

test('unpaid async, cancelled, missing money, wrong currency, unrelated sessions and previews issue no receipt', () => {
  for (const patch of [{ livemode: false }, { livemode: undefined }, { payment_status: 'unpaid' }, { status: 'open' }, { mode: 'subscription' }, { currency: undefined }, { currency: 'usd' }, { amount_total: undefined }, { amount_total: 100 }, { amount_total: NaN }, { amount_total: 24900.1 }, { id: 'not-a-session' }, { metadata: { ...paid.metadata, app: 'other' } }]) {
    assert.equal(createPurchaseReceipt({ ...paid, ...patch }, secret, options), null, JSON.stringify(patch))
  }
  for (const environment of ['preview', 'development', undefined]) {
    assert.equal(createPurchaseReceipt(paid, secret, { now, environment }), null)
    assert.equal(verifyPurchaseReceipt(createPurchaseReceipt(paid, secret, options), secret, { now, environment }), null)
  }
  assert.equal(createPurchaseReceipt(paid, '', options), null)
  assert.equal(createPurchaseReceipt(paid, 'too-short', options), null)
})

test('tampering, wrong audience/environment, future lifetime and raw webhook signatures are rejected', () => {
  const token = createPurchaseReceipt(paid, secret, options)
  assert.equal(verifyPurchaseReceipt(token + 'x', secret, options), null)
  assert.equal(verifyPurchaseReceipt('x.' + token, secret, options), null)
  const [encoded] = token.split('.')
  const rawMac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  assert.equal(verifyPurchaseReceipt(encoded + '.' + rawMac, secret, options), null)
  const p = JSON.parse(Buffer.from(encoded, 'base64url'))
  const key = crypto.hkdfSync('sha256', secret, 'firstaid-purchase-measurement-v1', 'https://firstaid.morroo.com/api/checkout/receipt:production', 32)
  for (const change of [{ audience: 'https://preview.invalid' }, { environment: 'preview' }, { learner: 'forbidden' }, { expiresAt: now + 901 }]) {
    const body = Buffer.from(JSON.stringify({ ...p, ...change })).toString('base64url')
    const sig = crypto.createHmac('sha256', key).update('firstaid-purchase-measurement-v1.' + body).digest('base64url')
    assert.equal(verifyPurchaseReceipt(body + '.' + sig, secret, options), null)
  }
})

test('handoff stores no URL token and sets no-referrer before full-document replacement', () => {
  const f = fixture(), token = createPurchaseReceipt(paid, secret, options)
  assert.equal(openPurchaseReceipt(f.win, f.doc, token), true)
  assert.equal(f.scripts[0].name, 'referrer'); assert.equal(f.scripts[0].content, 'no-referrer')
  assert.deepEqual(f.navigations, ['/api/checkout/receipt-page'])
  assert.equal(f.win.sessionStorage.getItem(RECEIPT_KEY), token)
  f.win.sessionStorage.setItem = () => { throw Error('blocked') }
  assert.equal(openPurchaseReceipt(f.win, f.doc, token), false)
})

test('consume removes token before credential-free own-server verification and rejects missing or extra data', async () => {
  const f = fixture(), token = createPurchaseReceipt(paid, secret, options), p = fresh()
  f.win.sessionStorage.setItem(RECEIPT_KEY, token)
  const result = await consumeReceipt(f.win, async (url, init) => {
    assert.equal(f.win.sessionStorage.getItem(RECEIPT_KEY), null)
    assert.equal(url, '/api/checkout/receipt'); assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer')
    return { ok: true, json: async () => p }
  })
  assert.deepEqual(result, p)
  assert.equal(await consumeReceipt(f.win, () => { throw Error('should not call') }), null)
  assert.equal(validReceipt({ ...p, session_id: 'forbidden' }), false)
  f.win.sessionStorage.setItem(RECEIPT_KEY, token)
  f.win.sessionStorage.removeItem = () => { throw Error('blocked') }
  assert.equal(await consumeReceipt(f.win, () => { throw Error('must not call') }), null)
})

test('only canonical empty-referrer SDK-free document is eligible', () => {
  const f = fixture(); assert.equal(eligibleReceiptDocument(f.win, f.doc), true)
  for (const href of [RECEIPT_URL + '?session_id=x', RECEIPT_URL + '#x', RECEIPT_URL.replace('https:', 'http:'), RECEIPT_URL.replace('firstaid.morroo.com', 'preview.vercel.app')]) {
    assert.equal(eligibleReceiptDocument({ ...f.win, location: new URL(href) }, f.doc), false)
  }
  assert.equal(eligibleReceiptDocument(f.win, { ...f.doc, referrer: 'https://firstaid.morroo.com/buy?session_id=private' }), false)
  assert.equal(eligibleReceiptDocument({ ...f.win, fbq() {} }, f.doc), false)
})

test('per-vendor at-most-once attempt survives reload and shared-tab races; absent consent/storage/locks fails closed', async () => {
  const shared = new Map(), a = fixture(shared), b = fixture(shared), p = fresh()
  assert.equal(await claimAttempt(a.win, 'meta', p), false)
  shared.set(choiceKey('meta'), 'granted')
  const results = await Promise.all([claimAttempt(a.win, 'meta', p), claimAttempt(b.win, 'meta', p)])
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(await claimAttempt(fixture(shared).win, 'meta', p), false)
  shared.set(choiceKey('google'), 'granted')
  assert.equal(await claimAttempt(a.win, 'google', p), true)
  assert.equal(shared.get(attemptKey('meta', p.eventId)), 'attempted')
  const c = fixture(); c.win.localStorage.setItem(choiceKey('meta'), 'granted'); c.win.navigator.locks = undefined
  assert.equal(await claimAttempt(c.win, 'meta', p), false)
  c.win.navigator.locks = a.win.navigator.locks; c.win.localStorage.setItem = () => { throw Error('blocked') }
  assert.equal(await claimAttempt(c.win, 'meta', p), false)
})

test('Meta sends only minimal Purchase with stable eventID, no PageView, advanced matching or raw identifiers', () => {
  const f = fixture(), p = fresh(); let granted = false
  assert.equal(startMeta(f.win, f.doc, p, () => granted), false); assert.equal(f.scripts.length, 0)
  granted = true; assert.equal(startMeta(f.win, f.doc, p, () => granted), true)
  assert.deepEqual(f.win.fbq.queue, [['set', 'autoConfig', false, '1277103750989853'], ['consent', 'grant'], ['init', '1277103750989853'], ['trackSingle', '1277103750989853', 'Purchase', { value: 249, currency: 'THB' }, { eventID: p.eventId }]])
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer')
  granted = false; f.win.fbq('track', 'Purchase', { bad: true }); assert.equal(f.win.fbq.queue.length, 4)
})

test('Google targets verified GA4 only; kill switch works and no contact/Ads conversion is sent', () => {
  const f = fixture(), p = fresh()
  assert.equal(GOOGLE_PURCHASE_ENABLED, true)
  assert.equal(startGoogle(f.win, f.doc, p, () => true, { enabled: false }), false)
  assert.equal(f.scripts.length, 0)
  assert.equal(startGoogle(f.win, f.doc, p, () => true), true)
  const calls = f.win.dataLayer.map(args => Array.from(args)), events = calls.filter(args => args[0] === 'event')
  assert.equal(events.length, 1); assert.equal(events[0][1], 'purchase'); assert.equal(events[0][2].transaction_id, p.eventId)
  assert.equal(events[0][2].send_to, 'G-H10PHV2XNG'); assert.equal(events[0][2].page_referrer, '')
  assert.equal(JSON.stringify(calls).includes('AW-'), false)
})

test('PostHog blocks payment initialization/identification/capture and delayed URL props without changing public events', () => {
  const publicUrl = new URL('https://firstaid.morroo.com/'), event = { event: 'contact', properties: {} }
  assert.equal(checkoutAnalyticsBlocked(new URL('https://firstaid.morroo.com/buy?session_id=private')), true)
  assert.equal(checkoutAnalyticsBlocked(publicUrl, 'https://firstaid.morroo.com/buy'), true)
  assert.equal(filterCheckoutAnalyticsEvent(event, publicUrl), event)
  assert.equal(filterCheckoutAnalyticsEvent({ event: '$snapshot', properties: { $snapshot_data: [{ data: { href: 'https://firstaid.morroo.com/buy?session_id=private' } }] } }, publicUrl), null)
  for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
    assert.equal(filterCheckoutAnalyticsEvent({ properties: { [key]: 'https://firstaid.morroo.com/buy?session_id=private' } }, publicUrl), null)
    assert.equal(filterCheckoutAnalyticsEvent({ properties: { $set_once: { [key]: 'https://firstaid.morroo.com/buy?session_id=private' } } }, publicUrl), null)
  }
  const source = readFileSync(new URL('../../src/lib/posthog.js', import.meta.url), 'utf8')
  assert.equal((source.match(/checkoutAnalyticsBlocked\(window.location, document.referrer\)/g) || []).length, 3)
  assert.match(source, /before_send: event => filterCheckoutAnalyticsEvent/)
  assert.match(source, /disable_session_recording: true/)
  assert.match(source, /capture_performance: false/)
})

test('receipt page is not the learner app; Buy retains no direct Purchase fanout and confirm issues receipt after entitlement grant', () => {
  assert.equal(RECEIPT_HTML.includes('src/main'), false); assert.equal(RECEIPT_HTML.includes('posthog'), false)
  assert.match(RECEIPT_HTML, /name="referrer" content="no-referrer"/)
  const buy = readFileSync(new URL('../../src/pages/Buy.jsx', import.meta.url), 'utf8')
  assert.equal(buy.includes('purchase_complete'), false); assert.equal(buy.includes('window.fbq'), false)
  const confirm = readFileSync(new URL('../checkout/confirm.js', import.meta.url), 'utf8')
  assert.ok(confirm.indexOf('not_your_session') < confirm.indexOf('await grantPaidSession'))
  assert.ok(confirm.indexOf('await grantPaidSession') < confirm.indexOf('receipt: createPurchaseReceipt'))
  assert.match(confirm, /createPurchaseReceipt\(session, process.env.FIRSTAID_PURCHASE_RECEIPT_SECRET\)/)
  assert.doesNotMatch(confirm, /createPurchaseReceipt\(session, process.env.STRIPE/)
})

function handlerFixture({ session = paid, learner = paid.metadata.learner_id, receiptKey = secret, environment = 'production', grantError = false } = {}) {
  const source = readFileSync(new URL('../checkout/confirm.js', import.meta.url), 'utf8')
    .replace(/^import .*\n/gm, '').replace('export default async function handler', 'async function handler')
  const actions = [], response = { headers: {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this }, setHeader(key, value) { this.headers[key] = value } }
  const context = createContext({
    process: { env: { FIRSTAID_PURCHASE_RECEIPT_SECRET: receiptKey, VERCEL_ENV: environment } },
    getSupabaseAdmin: () => ({}), applyCors: () => false, learnerIdFromToken: async () => learner,
    rateLimited: () => false, isStripeConfigured: () => true, paidGrant,
    stripeApi: async path => { actions.push(['stripe-read', path]); return session },
    grantPaidSession: async () => { actions.push(['grant']); if (grantError) throw Error('synthetic_grant_failure') },
    createPurchaseReceipt: (p, key) => { actions.push(['receipt']); return createPurchaseReceipt(p, key, { environment }) },
  })
  const handler = runInContext(source + '\nhandler', context)
  return { actions, response, run: () => handler({ method: 'GET', query: { session_id: paid.id } }, response) }
}

test('actual confirm handler: paid owner is fulfilled before receipt; missing key keeps paid success working', async () => {
  const f = handlerFixture(); await f.run()
  assert.equal(f.response.code, 200); assert.equal(f.response.body.status, 'paid')
  assert.ok(f.response.body.receipt); assert.deepEqual(f.actions.map(a => a[0]), ['stripe-read', 'grant', 'receipt'])
  assert.equal(f.response.headers['Cache-Control'], 'no-store')
  for (const patch of [{ receiptKey: undefined }, { receiptKey: '' }, { environment: 'preview' }]) {
    // Undefined selects the fixture default, so use an explicit empty key for absence.
    const g = handlerFixture({ ...patch, receiptKey: patch.receiptKey === undefined && !patch.environment ? '' : patch.receiptKey })
    await g.run(); assert.equal(g.response.body.status, 'paid'); assert.equal(g.response.body.receipt, null)
    assert.ok(g.actions.some(a => a[0] === 'grant'))
  }
})

test('actual confirm handler: unauthenticated, wrong owner, unpaid PromptPay and grant failure cannot issue receipts', async () => {
  for (const [options, code] of [[{ learner: null }, 401], [{ learner: 'another-synthetic-learner' }, 403], [{ session: { ...paid, payment_status: 'unpaid' } }, 200], [{ grantError: true }, 502]]) {
    const f = handlerFixture(options); await f.run(); assert.equal(f.response.code, code)
    assert.equal(f.response.body.receipt, undefined); assert.equal(f.actions.some(a => a[0] === 'receipt'), false)
    if (options.session) { assert.equal(f.response.body.status, 'pending'); assert.equal(f.actions.some(a => a[0] === 'grant'), false) }
  }
})
