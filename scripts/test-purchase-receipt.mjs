// Network-blocked browser regression: synthetic receipts and mocked SDKs only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { RECEIPT_HTML, RECEIPT_CSP } from '../api/checkout/receipt-page.js'
import { RECEIPT_KEY, RECEIPT_PATH, RECEIPT_URL, choiceKey } from '../public/purchase-receipt.js'

const ORIGIN = 'https://firstaid.morroo.com'
const TOKEN = 'synthetic_signed.measurement_receipt'
const EVENT = 'fa_purchase_' + 'a'.repeat(64)
const JS = await readFile(new URL('../public/purchase-receipt.js', import.meta.url), 'utf8')
const HANDOFF = await readFile(new URL('../src/utils/purchaseReceipt.js', import.meta.url), 'utf8')
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {})
let passed = 0

async function fixture(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const requests = [], calls = [], googleCalls = [], observations = [], blocked = []
  await context.exposeBinding('__receiptRecord', (_source, kind, value) => {
    if (kind === 'call') calls.push(value)
    else if (kind === 'google') googleCalls.push(value)
    else observations.push(value)
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.url() === 'https://connect.facebook.net/en_US/fbevents.js') {
      requests.push('meta'); assert.equal(request.headers().referer, undefined)
      const script = `(function(){function run(){window.__receiptRecord('observation',{href:location.href,referrer:document.referrer,token:sessionStorage.getItem('${RECEIPT_KEY}'),body:document.body.innerText}); const f=window.fbq; const q=f.queue.splice(0); f.callMethod=(...a)=>window.__receiptRecord('call',a); q.forEach(a=>f.callMethod(...a));} ${options.deferSdk ? 'window.__releaseMeta=run;' : 'run();'} })();`
      return route.fulfill({ contentType: 'text/javascript', body: script })
    }
    if (url.hostname === 'www.googletagmanager.com') {
      requests.push('google'); assert.equal(request.headers().referer, undefined)
      const script = `(function(){function run(){window.__receiptRecord('observation',{href:location.href,referrer:document.referrer,token:sessionStorage.getItem('${RECEIPT_KEY}'),body:document.body.innerText}); const q=window.dataLayer; const buffered=q.splice(0); const push=q.push.bind(q); q.push=(...items)=>{items.forEach(a=>window.__receiptRecord('google',Array.from(a)));return push(...items)};buffered.forEach(a=>window.__receiptRecord('google',Array.from(a)));} ${options.deferSdk ? 'window.__releaseGoogle=run;' : 'run();'} })();`
      return route.fulfill({ contentType: 'text/javascript', body: script })
    }
    if (url.origin === ORIGIN && url.pathname === '/api/checkout/receipt' && request.method() === 'POST') {
      assert.equal(request.headers().referer, undefined)
      assert.equal(request.headers().cookie, undefined)
      assert.deepEqual(request.postDataJSON(), { receipt: TOKEN })
      return route.fulfill({ status: options.invalid ? 400 : 200, contentType: 'application/json', body: JSON.stringify(options.invalid ? { error: 'invalid_receipt' } : { eventId: EVENT, value: 249, currency: 'THB', expiresAt: Math.floor(Date.now() / 1000) + 600 }) })
    }
    if (url.origin === ORIGIN && request.method() === 'GET') {
      if (url.pathname === RECEIPT_PATH) return route.fulfill({ contentType: 'text/html', body: RECEIPT_HTML, headers: { 'Content-Security-Policy': RECEIPT_CSP, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } })
      // Exercise the staged enabled branch with synthetic SDKs only. The source
      // constant remains false; this fixture is not an activation mechanism.
      if (url.pathname === '/purchase-receipt.js') return route.fulfill({ contentType: 'text/javascript', body: options.googleEnabled ? JS.replace('export const GOOGLE_PURCHASE_ENABLED = false', 'export const GOOGLE_PURCHASE_ENABLED = true') : JS })
      if (url.pathname === '/fixture-handoff.js') return route.fulfill({ contentType: 'text/javascript', body: HANDOFF })
      if (url.pathname === '/buy') return route.fulfill({ contentType: 'text/html', body: `<html><head></head><body><script type="module">import {openPurchaseReceipt} from '/fixture-handoff.js';openPurchaseReceipt(window,document,'${TOKEN}');</script></body></html>` })
      if (url.pathname === '/learn') return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic learning page</h1>' })
    }
    blocked.push(request.url()); return route.abort('blockedbyclient')
  })
  await context.addInitScript(({ token, key, options }) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // One seed per tab. Reload/back must not invent another checkout receipt.
    if (!sessionStorage.getItem('__receipt_seeded')) {
      sessionStorage.setItem('__receipt_seeded', '1')
      if (!options.noToken) sessionStorage.setItem(key, token)
      if (options.oldGrants) {
        localStorage.setItem('firstaid_jia_training_meta_consent_v2', 'granted')
        localStorage.setItem('firstaid_jia_training_google_consent_v1', 'granted')
        localStorage.setItem('firstaid_purchase_meta_consent_v1', 'granted')
      }
    }
    if (options.storageFailure) {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage) throw Error('Synthetic local storage unavailable')
        return original.call(this, name, value)
      }
    }
    if (options.holdLock) {
      const request = navigator.locks.request.bind(navigator.locks)
      navigator.locks.request = (...args) => new Promise(resolve => { window.__releaseLock = () => resolve(request(...args)) })
    }
  }, { token: TOKEN, key: RECEIPT_KEY, options })
  const page = await context.newPage()
  await page.goto(options.handoff ? ORIGIN + '/buy?session_id=cs_synthetic_private_url_123456' : RECEIPT_URL + (options.query || ''))
  await page.waitForURL(RECEIPT_URL + (options.query || ''))
  await page.waitForFunction(() => !document.getElementById('status').textContent.includes('กำลังตรวจสอบ'))
  const close = async () => {
    const transmitted = JSON.stringify({ calls, googleCalls, observations, blocked })
    for (const sensitive of [TOKEN, 'cs_synthetic_private_url_123456', 'synthetic-private-learner']) assert.equal(transmitted.includes(sensitive), false, 'No sensitive payload may reach SDKs or unexpected requests')
    assert.deepEqual(blocked, [], 'Unexpected network requests must not be silently ignored')
    await context.close()
  }
  return { context, page, requests, calls, googleCalls, observations, blocked, close }
}
const grant = page => page.locator('[data-vendor="meta"][data-choice="granted"]')
const deny = page => page.locator('[data-vendor="meta"][data-choice="denied"]')
const purchases = f => f.calls.filter(args => args[0] === 'trackSingle' && args[2] === 'Purchase')
async function run(name, test) { await test(); passed++; console.log('PASS ' + name) }

try {
  await run('no receipt, invalid receipt and unsafe query never offer tracking', async () => {
    for (const options of [{ noToken: true }, { invalid: true }, { query: '?session_id=private' }]) {
      const f = await fixture(options)
      assert.equal(await f.page.locator('#choices').isVisible(), false); assert.equal(f.requests.length, 0)
      await f.close()
    }
  })
  await run('fresh receipt ignores all stored grants and Google remains gated', async () => {
    const f = await fixture({ oldGrants: true })
    assert.equal(await f.page.locator('#choices').isVisible(), true); assert.equal(f.requests.length, 0)
    await f.page.locator('[data-vendor="google"][data-choice="granted"]').click()
    await f.page.waitForTimeout(30); assert.equal(f.requests.length, 0)
    await deny(f.page).click(); assert.equal(f.requests.length, 0)
    await f.close()
  })
  await run('actual handoff clears raw referrer and token before one minimal Meta Purchase', async () => {
    const f = await fixture({ handoff: true })
    await grant(f.page).click(); await f.page.waitForFunction(() => !!window.fbq?.callMethod)
    await f.page.waitForTimeout(30)
    assert.equal(purchases(f).length, 1)
    assert.deepEqual(purchases(f)[0], ['trackSingle', '1277103750989853', 'Purchase', { value: 249, currency: 'THB' }, { eventID: EVENT }])
    assert.equal(f.observations[0].href, RECEIPT_URL); assert.equal(f.observations[0].referrer, ''); assert.equal(f.observations[0].token, null)
    assert.equal(f.observations[0].body.includes(TOKEN), false); assert.equal(f.observations[0].body.includes('cs_synthetic'), false)
    assert.equal(f.calls.some(args => args.includes('PageView')), false)
    await grant(f.page).click(); assert.equal(purchases(f).length, 1)
    await f.close()
  })
  await run('storage failure denies tracking without interrupting learning', async () => {
    const f = await fixture({ storageFailure: true })
    await grant(f.page).click(); assert.equal(f.requests.length, 0)
    await f.page.locator('a[href="/learn"]').click(); await f.page.waitForURL(ORIGIN + '/learn')
    await f.close()
  })
  await run('withdrawal while lock is pending prevents SDK initialization', async () => {
    const f = await fixture({ holdLock: true })
    await grant(f.page).click(); await f.page.waitForFunction(() => !!window.__releaseLock)
    await deny(f.page).click(); await f.page.evaluate(() => window.__releaseLock())
    await f.page.waitForTimeout(30); assert.equal(f.requests.length, 0); assert.equal(purchases(f).length, 0)
    await f.close()
  })
  await run('concurrent tabs and repeated return claim only one attempt for the same purchase', async () => {
    const f = await fixture(), second = await f.context.newPage()
    await second.goto(RECEIPT_URL); await second.locator('#choices').waitFor({ state: 'visible' })
    await Promise.all([grant(f.page).click(), grant(second).click()])
    await f.page.waitForTimeout(70); assert.equal(f.requests.filter(x => x === 'meta').length, 1); assert.equal(purchases(f).length, 1)
    const third = await f.context.newPage(); await third.goto(RECEIPT_URL); await third.locator('#choices').waitFor({ state: 'visible' }); await grant(third).click()
    await third.waitForTimeout(30); assert.equal(f.requests.filter(x => x === 'meta').length, 1)
    await f.close()
  })
  await run('reload and back cannot replay a consumed receipt', async () => {
    const f = await fixture(); await grant(f.page).click(); await f.page.waitForFunction(() => !!window.fbq?.callMethod)
    await f.page.reload(); await f.page.waitForFunction(() => !document.getElementById('status').textContent.includes('กำลังตรวจสอบ'))
    assert.equal(await f.page.locator('#choices').isVisible(), false)
    await f.page.locator('a[href="/learn"]').click(); await f.page.waitForURL(ORIGIN + '/learn')
    await f.page.goBack(); assert.equal(f.requests.filter(x => x === 'meta').length, 1)
    await f.close()
  })
  await run('late SDK execution after pagehide sees only revocation', async () => {
    const f = await fixture({ deferSdk: true }); await grant(f.page).click(); await f.page.waitForFunction(() => !!window.__releaseMeta)
    await f.page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.__releaseMeta() })
    await f.page.waitForTimeout(30); assert.equal(purchases(f).length, 0)
    assert.deepEqual(f.calls, [['consent', 'revoke']])
    await f.close()
  })
  await run('cross-tab denial discards a loaded receipt document', async () => {
    const f = await fixture(); await grant(f.page).click(); await f.page.waitForFunction(() => !!window.fbq?.callMethod)
    const second = await f.context.newPage(); await second.goto(ORIGIN + '/learn')
    await second.evaluate(key => localStorage.setItem(key, 'denied'), choiceKey('meta'))
    await f.page.waitForFunction(() => document.getElementById('choices')?.hidden && !window.fbq)
    assert.equal(f.requests.filter(x => x === 'meta').length, 1)
    await f.close()
  })
  await run('staged Google branch under production CSP sends one clean GA4 purchase after its own grant', async () => {
    const f = await fixture({ googleEnabled: true, handoff: true })
    assert.equal(f.requests.length, 0)
    await f.page.locator('[data-vendor="google"][data-choice="granted"]').click()
    await f.page.waitForFunction(() => !!window.gtag)
    await f.page.waitForTimeout(50)
    const events = f.googleCalls.filter(args => args[0] === 'event')
    assert.equal(events.length, 1); assert.equal(events[0][1], 'purchase')
    assert.equal(events[0][2].send_to, 'G-H10PHV2XNG'); assert.equal(events[0][2].transaction_id, EVENT)
    assert.equal(events[0][2].page_location, RECEIPT_URL); assert.equal(events[0][2].page_referrer, ''); assert.equal(events[0][2].user_data, null)
    assert.equal(f.googleCalls.some(args => JSON.stringify(args).includes('AW-')), false)
    assert.deepEqual(f.requests, ['google'])
    await f.page.locator('a[href="/learn"]').click(); await f.page.waitForURL(ORIGIN + '/learn')
    assert.equal(f.googleCalls.some(args => args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'denied'), true)
    await f.close()
  })
  await run('staged Google delayed SDK receives only revocation after pagehide', async () => {
    const f = await fixture({ googleEnabled: true, deferSdk: true })
    await f.page.locator('[data-vendor="google"][data-choice="granted"]').click()
    await f.page.waitForFunction(() => !!window.__releaseGoogle)
    await f.page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.__releaseGoogle() })
    await f.page.waitForTimeout(30)
    assert.equal(f.googleCalls.length, 1); assert.equal(f.googleCalls[0][0], 'consent'); assert.equal(f.googleCalls[0][2].analytics_storage, 'denied')
    await f.close()
  })
  await run('staged Google storage failure and denial while pending cannot initialize a tag', async () => {
    for (const options of [{ storageFailure: true }, { holdLock: true }]) {
      const f = await fixture({ ...options, googleEnabled: true })
      await f.page.locator('[data-vendor="google"][data-choice="granted"]').click()
      if (options.holdLock) {
        await f.page.waitForFunction(() => !!window.__releaseLock)
        await f.page.locator('[data-vendor="google"][data-choice="denied"]').click()
        await f.page.evaluate(() => window.__releaseLock())
      }
      await f.page.waitForTimeout(30); assert.equal(f.requests.length, 0)
      await f.close()
    }
  })
  await run('staged Google cross-tab denial and reload discard the tag and consumed receipt', async () => {
    const f = await fixture({ googleEnabled: true })
    await f.page.locator('[data-vendor="google"][data-choice="granted"]').click(); await f.page.waitForFunction(() => !!window.gtag)
    const second = await f.context.newPage(); await second.goto(ORIGIN + '/learn')
    await second.evaluate(key => localStorage.setItem(key, 'denied'), choiceKey('google'))
    await f.page.waitForFunction(() => document.getElementById('choices')?.hidden && !window.gtag)
    assert.equal(f.requests.filter(x => x === 'google').length, 1)
    await f.page.reload(); await f.page.waitForFunction(() => document.getElementById('choices')?.hidden && !window.gtag)
    assert.equal(f.requests.filter(x => x === 'google').length, 1)
    await f.close()
  })
  console.log(`All ${passed} network-blocked purchase browser scenarios passed. No live payment or vendor requests executed.`)
} finally { await browser.close() }
