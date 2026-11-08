// Network-blocked browser regression: synthetic receipts and mocked SDKs only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { RECEIPT_HTML, RECEIPT_CSP } from '../api/checkout/receipt-page.js'
import { RECEIPT_KEY, RECEIPT_PATH, RECEIPT_URL, choiceKey, GTM_ID, GOOGLE_PURCHASE_EVENT, GOOGLE_ADS_PURCHASE_EVENT } from '../public/purchase-receipt.js'

const ORIGIN = 'https://firstaid.morroo.com'
const TOKEN = 'synthetic_signed.measurement_receipt'
const EVENT = 'fa_purchase_' + 'a'.repeat(64)
const JS = await readFile(new URL('../public/purchase-receipt.js', import.meta.url), 'utf8')
const ATTRIBUTION = await readFile(new URL('../public/google-attribution.js', import.meta.url), 'utf8')
const HANDOFF = await readFile(new URL('../src/utils/purchaseReceipt.js', import.meta.url), 'utf8')
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {})
let passed = 0

async function fixture(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const requests = [], calls = [], googleCalls = [], observations = [], blocked = [], errors = []
  let releaseGoogleResponse
  const googleResponseGate = new Promise(resolve => { releaseGoogleResponse = resolve })
  await context.exposeBinding('__receiptRecord', (_source, kind, value) => {
    if (kind === 'call') calls.push(value)
    else if (kind === 'google') googleCalls.push(value)
    else observations.push(value)
  })
  await context.routeWebSocket('**/*', socket => { blocked.push('websocket'); socket.close() })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (options.cspProbe && request.url() === 'https://analytics.google.com/g/collect?synthetic_csp_probe=1') {
      requests.push('exact-collector-probe'); assert.equal(request.headers().referer, undefined)
      return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'},body:''})
    }
    if (options.privacyLink && request.url() === 'https://policies.google.com/privacy') {
      assert.equal(request.headers().referer, undefined)
      return route.fulfill({ contentType:'text/html', body:'<title>Synthetic privacy policy</title>' })
    }
    if (request.url() === 'https://connect.facebook.net/en_US/fbevents.js') {
      requests.push('meta'); assert.equal(request.headers().referer, undefined)
      const script = `(function(){function run(){window.__receiptRecord('observation',{href:location.href,referrer:document.referrer,token:sessionStorage.getItem('${RECEIPT_KEY}'),body:document.body.innerText}); const f=window.fbq; const q=f.queue.splice(0); f.callMethod=(...a)=>window.__receiptRecord('call',a); q.forEach(a=>f.callMethod(...a));} ${options.deferSdk ? 'window.__releaseMeta=run;' : 'run();'} })();`
      return route.fulfill({ contentType: 'text/javascript', body: script })
    }
    if (request.url() === `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`) {
      if (options.holdGoogleResponse) await googleResponseGate
      requests.push('google'); assert.equal(request.headers().referer, undefined)
      const script = `(function(){function run(){window.__receiptRecord('observation',{href:location.href,referrer:document.referrer,token:sessionStorage.getItem('${RECEIPT_KEY}'),body:document.body.innerText}); ${options.testCookieWrite ? `const config=window.dataLayer.find(a=>a[0]==='set' && typeof a[1]==='object')[1]; document.cookie=config.cookie_prefix+'_ga=synthetic; Path=/; Domain=firstaid.morroo.com;'+config.cookie_flags;` : ''} const q=window.dataLayer; const buffered=q.splice(0); const push=q.push.bind(q); q.push=(...items)=>{items.forEach(a=>window.__receiptRecord('google',a.event ? a : Array.from(a)));return push(...items)};buffered.forEach(a=>window.__receiptRecord('google',a.event ? a : Array.from(a)));} ${options.deferSdk ? 'window.__releaseGoogle=run;' : 'run();'} })();`
      return route.fulfill({ contentType: 'text/javascript', body: script })
    }
    if (url.origin === ORIGIN && url.pathname === '/api/checkout/receipt' && request.method() === 'POST') {
      assert.equal(request.headers().referer, undefined)
      assert.equal(request.headers().cookie, undefined)
      assert.deepEqual(request.postDataJSON(), { receipt: TOKEN })
      return route.fulfill({ status: options.invalid ? 400 : 200, contentType: 'application/json', body: JSON.stringify(options.invalid ? { error: 'invalid_receipt' } : { eventId: EVENT, value: 249, currency: 'THB', expiresAt: Math.floor(Date.now() / 1000) + 600, ...options.payload }) })
    }
    if (url.origin === ORIGIN && request.method() === 'GET') {
      if (url.pathname === RECEIPT_PATH) return route.fulfill({ contentType: 'text/html', body: RECEIPT_HTML, headers: { 'Content-Security-Policy': RECEIPT_CSP, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } })
      // Shipping Google path is exercised unchanged. One synthetic fixture
      // disables it to retain emergency kill-switch coverage.
      if (url.pathname === '/purchase-receipt.js') return route.fulfill({ contentType: 'text/javascript', body: options.googleEnabled === false ? JS.replace('export const GOOGLE_PURCHASE_ENABLED = true', 'export const GOOGLE_PURCHASE_ENABLED = false') : JS })
      if (url.pathname === '/google-attribution.js') return route.fulfill({ contentType: 'text/javascript', body: ATTRIBUTION })
      if (url.pathname === '/fixture-handoff.js') return route.fulfill({ contentType: 'text/javascript', body: HANDOFF })
      if (url.pathname === '/buy') return route.fulfill({ contentType: 'text/html', body: `<html><head></head><body><script type="module">import {openPurchaseReceipt} from '/fixture-handoff.js';openPurchaseReceipt(window,document,'${TOKEN}');</script></body></html>` })
      if (url.pathname === '/learn') return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic learning page</h1>' })
    }
    blocked.push(request.url()); return route.abort('blockedbyclient')
  })
  await context.addInitScript(({ token, key, options }) => {
    if (location.origin !== 'https://firstaid.morroo.com') return
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // One seed per tab. Reload/back must not invent another checkout receipt.
    if (!sessionStorage.getItem('__receipt_seeded')) {
      sessionStorage.setItem('__receipt_seeded', '1')
      if (!options.noToken) sessionStorage.setItem(key, token)
      if (options.adsGrant) {
        const now = Date.now(), age = options.expiredGrant ? 86401000 : 1000
        localStorage.setItem('firstaid_jia_training_google_consent_v2', JSON.stringify({ version: 2, mode: 'ads', issuedAt: now - age, expiresAt: now - age + 86400000 }))
      }
      if (options.oldGrants) {
        localStorage.setItem('firstaid_jia_training_meta_consent_v2', 'granted')
        localStorage.setItem('firstaid_jia_training_google_consent_v1', 'granted')
        localStorage.setItem('firstaid_purchase_meta_consent_v1', 'granted')
        localStorage.setItem('firstaid_purchase_google_consent_v1', 'granted')
      }
    }
    if (options.directGoogleAttempt) localStorage.setItem('firstaid_purchase_attempt_v1:google:fa_purchase_' + 'a'.repeat(64), 'attempted')
    if (options.noLocks) Object.defineProperty(navigator, 'locks', { value: undefined })
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
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(options.handoff ? ORIGIN + '/buy?session_id=cs_synthetic_private_url_123456' : RECEIPT_URL + (options.query || ''))
  await page.waitForURL(RECEIPT_URL + (options.query || ''))
  await page.waitForFunction(() => !document.getElementById('status').textContent.includes('กำลังตรวจสอบ'))
  const close = async () => {
    const transmitted = JSON.stringify({ calls, googleCalls, observations, blocked })
    for (const sensitive of [TOKEN, 'cs_synthetic_private_url_123456', 'synthetic-private-learner']) assert.equal(transmitted.includes(sensitive), false, 'No sensitive payload may reach SDKs or unexpected requests')
    assert.deepEqual(blocked, [], 'Unexpected network requests must not be silently ignored')
    assert.deepEqual(errors, [], 'Receipt must execute without page errors')
    for (const observation of observations) {
      assert.equal(observation.href, RECEIPT_URL); assert.equal(observation.referrer, ''); assert.equal(observation.token, null)
    }
    await context.close()
  }
  return { context, page, requests, calls, googleCalls, observations, blocked, releaseGoogleResponse, close }
}
const grant = page => page.locator('[data-vendor="meta"][data-choice="granted"]')
const deny = page => page.locator('[data-vendor="meta"][data-choice="denied"]')
const grantGoogle = page => page.locator('[data-vendor="google"][data-choice="analytics"]')
const denyGoogle = page => page.locator('[data-vendor="google"][data-choice="denied"]')
const googlePurchases = f => f.googleCalls.filter(row => [GOOGLE_PURCHASE_EVENT, GOOGLE_ADS_PURCHASE_EVENT].includes(row.event))
const purchases = f => f.calls.filter(args => args[0] === 'trackSingle' && args[2] === 'Purchase')
async function run(name, test) { await test(); passed++; console.log('PASS ' + name) }

try {
  await run('receipt CSP allows only exact bare-host GA collector path and keeps Ads bridges blocked', async () => {
    const f=await fixture({cspProbe:true})
    const urls=['https://analytics.google.com/g/collect?synthetic_csp_probe=1','https://analytics.google.com/g/collect/','https://analytics.google.com/g/collect-other','https://analytics.google.com/other','https://analytics.google.com/collect','https://www.google.com/g/collect','https://www.google.com/measurement/conversion','https://stats.g.doubleclick.net/g/collect','https://www.googleadservices.com/pagead/conversion','https://www.google.co.th/ads/ga-audiences']
    const result=await f.page.evaluate(async urls=>Promise.all(urls.map(async url=>{try{await fetch(url);return 'allowed'}catch{return 'blocked'}})),urls)
    assert.deepEqual(result,['allowed',...urls.slice(1).map(()=> 'blocked')])
    assert.deepEqual(f.requests,['exact-collector-probe'])
    await f.close()
  })
  await run('privacy policy opens noreferrer tab without redirecting receipt or loading SDK', async () => {
    const f=await fixture({privacyLink:true})
    const opened=f.context.waitForEvent('page')
    await f.page.getByRole('link',{name:'นโยบายความเป็นส่วนตัว Google'}).click()
    const popup=await opened;await popup.waitForLoadState()
    assert.equal(await popup.title(),'Synthetic privacy policy')
    assert.equal(f.page.url(),RECEIPT_URL);assert.equal(f.requests.length,0)
    await f.close()
  })
  await run('no receipt, invalid receipt and unsafe query never offer tracking', async () => {
    for (const options of [{ noToken: true }, { invalid: true }, { payload: { expiresAt: 0 } }, { payload: { value: '249' } }, { payload: { learner: 'private' } }, { query: '?session_id=private' }]) {
      const f = await fixture(options)
      assert.equal(await f.page.locator('#choices').isVisible(), false); assert.equal(f.requests.length, 0)
      await f.close()
    }
  })
  await run('fresh receipt ignores all stored grants and Google kill switch fails closed', async () => {
    const f = await fixture({ oldGrants: true, googleEnabled: false })
    assert.equal(await f.page.locator('#choices').isVisible(), true); assert.equal(f.requests.length, 0)
    await f.page.locator('[data-vendor="google"][data-choice="analytics"]').click()
    await f.page.waitForTimeout(30); assert.equal(f.requests.length, 0)
    await deny(f.page).click(); assert.equal(f.requests.length, 0)
    await f.close()
  })
  await run('fresh ads receipt choice requires valid new-purpose landing consent', async () => {
    for (const options of [{}, { oldGrants: true }, { adsGrant: true, expiredGrant: true }]) {
      const f = await fixture(options)
      assert.equal(await f.page.locator('[data-choice="ads"]').isDisabled(), true)
      assert.equal(f.requests.length, 0)
      await f.close()
    }
    const f = await fixture({ adsGrant: true })
    assert.equal(f.requests.length, 0)
    await f.page.locator('[data-choice="ads"]').click()
    await f.page.waitForFunction(() => window.dataLayer?.some(row => row.event === 'firstaid_receipt_ads_purchase'))
    const purchase = googlePurchases(f)[0]
    assert.equal(purchase.event, GOOGLE_ADS_PURCHASE_EVENT)
    assert.equal(f.googleCalls.some(row => row.event === GOOGLE_PURCHASE_EVENT), false)
    assert.equal(purchase.fa_receipt_cookie_prefix, 'firstaid_attribution_v2')
    assert.equal(purchase.fa_receipt_ads_measurement, 'granted')
    assert.ok(purchase.fa_receipt_cookie_expires > 0 && purchase.fa_receipt_cookie_expires <= 86399)
    assert.equal(purchase.fa_receipt_transaction_id, EVENT)
    const consent = f.googleCalls.find(row => row[0] === 'consent' && row[1] === 'update')[2]
    assert.deepEqual(consent, { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' })
    await grantGoogle(f.page).click()
    await f.page.locator('[data-choice="ads"]').click()
    assert.equal(googlePurchases(f).length, 1)
    await f.close()
  })
  await run('analytics-only ignores available ads grant and cannot upgrade purchase', async () => {
    const f = await fixture({ adsGrant: true })
    await grantGoogle(f.page).click()
    await f.page.waitForFunction(() => window.dataLayer?.some(row => row.event === 'firstaid_receipt_purchase'))
    await f.page.locator('[data-choice="ads"]').click()
    assert.equal(googlePurchases(f).length, 1)
    assert.equal(googlePurchases(f)[0].fa_receipt_cookie_prefix, 'firstaid_purchase')
    assert.equal(googlePurchases(f)[0].fa_receipt_ads_measurement, 'denied')
    const consent = f.googleCalls.find(row => row[0] === 'consent' && row[1] === 'update')[2]
    assert.equal(consent.ad_storage, 'denied'); assert.equal(consent.ad_user_data, 'denied')
    await f.close()
  })
  await run('cross-tab landing ads withdrawal terminates receipt while SDK is delayed', async () => {
    const f = await fixture({ adsGrant: true, holdGoogleResponse: true })
    await f.page.locator('[data-choice="ads"]').click()
    await f.page.waitForFunction(() => !!window.dataLayer)
    const second = await f.context.newPage(); await second.goto(ORIGIN + '/learn')
    await second.evaluate(() => localStorage.setItem('firstaid_jia_training_google_consent_v2', 'denied'))
    f.releaseGoogleResponse()
    await f.page.waitForFunction(() => document.getElementById('choices')?.hidden && !window.gtag)
    assert.equal(googlePurchases(f).length, 0)
    await f.close()
  })
  await run('replacing ads grant in another tab retires the previous receipt consent', async () => {
    const f = await fixture({ adsGrant: true, holdGoogleResponse: true })
    await f.page.locator('[data-choice="ads"]').click()
    await f.page.waitForFunction(() => !!window.dataLayer)
    const second = await f.context.newPage(); await second.goto(ORIGIN + '/learn')
    await second.evaluate(() => {
      const now = Date.now()
      localStorage.setItem('firstaid_jia_training_google_consent_v2', JSON.stringify({ version: 2, mode: 'ads', issuedAt: now, expiresAt: now + 86400000 }))
    })
    f.releaseGoogleResponse()
    await f.page.waitForFunction(() => document.getElementById('choices')?.hidden && !window.gtag)
    assert.equal(googlePurchases(f).length, 0)
    await f.close()
  })
  await run('mock delayed SDK proves absolute cookie_flags contract (actual SDK audited separately)', async () => {
    for (const adsGrant of [false, true]) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60
      const f = await fixture({ adsGrant, testCookieWrite: true, holdGoogleResponse: true, payload: { expiresAt } })
      const deadline = adsGrant ? await f.page.evaluate(() => JSON.parse(localStorage.getItem('firstaid_jia_training_google_consent_v2')).expiresAt / 1000) : expiresAt
      await (adsGrant ? f.page.locator('[data-choice="ads"]') : grantGoogle(f.page)).click()
      await f.page.waitForFunction(() => !!window.dataLayer)
      await f.page.waitForTimeout(1100)
      f.releaseGoogleResponse()
      await f.page.waitForFunction(() => window.dataLayer?.some(row => ['firstaid_receipt_purchase', 'firstaid_receipt_ads_purchase'].includes(row.event)))
      const cookie = (await f.context.cookies()).find(c => c.name === (adsGrant ? 'firstaid_attribution_v2_ga' : 'firstaid_purchase_ga'))
      assert.ok(cookie && cookie.expires > Date.now() / 1000 && cookie.expires <= deadline)
      await f.close()
    }
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
  await run('Google branch under production CSP emits one typed custom GTM event after its own grant', async () => {
    const f = await fixture({ googleEnabled: true, handoff: true })
    assert.equal(f.requests.length, 0)
    await grantGoogle(f.page).click()
    await f.page.waitForFunction(() => window.dataLayer?.some(row => row.event === 'firstaid_receipt_purchase'))
    await f.page.waitForTimeout(30)
    assert.deepEqual(googlePurchases(f), [{ event: GOOGLE_PURCHASE_EVENT, fa_receipt_transaction_id: EVENT, fa_receipt_value: 249, fa_receipt_cookie_prefix: 'firstaid_purchase', fa_receipt_ads_measurement: 'denied', fa_receipt_cookie_expires: googlePurchases(f)[0].fa_receipt_cookie_expires, fa_receipt_cookie_flags: googlePurchases(f)[0].fa_receipt_cookie_flags, fa_receipt_false: false, fa_receipt_true: true, fa_receipt_null: null, fa_receipt_empty: '', fa_receipt_linker: { domains: [], accept_incoming: false, decorate_forms: false } }])
    assert.equal(f.googleCalls.some(args => ['event', 'config', 'js'].includes(args[0])), false)
    assert.equal(f.googleCalls.some(args => JSON.stringify(args).includes('AW-')), false)
    const global = f.googleCalls.find(args => args[0] === 'set' && typeof args[1] === 'object')[1]
    assert.equal(global.page_location, RECEIPT_URL); assert.equal(global.page_referrer, '')
    assert.equal(global.send_page_view, false); assert.equal(global.allow_enhanced_conversions, false)
    assert.deepEqual(f.googleCalls[0], ['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    assert.deepEqual(f.requests, ['google'])
    const bootstrap = f.googleCalls.filter(row => row.event === 'gtm.js')
    assert.equal(bootstrap.length, 1); assert.equal(typeof bootstrap[0]['gtm.start'], 'number')
    const grantIndex = f.googleCalls.findIndex(row => row[0] === 'consent' && row[1] === 'update' && row[2].analytics_storage === 'granted')
    assert.ok(grantIndex < f.googleCalls.indexOf(bootstrap[0]))
    assert.ok(f.googleCalls.indexOf(bootstrap[0]) < f.googleCalls.indexOf(googlePurchases(f)[0]))
    await grantGoogle(f.page).click()
    await f.page.evaluate(() => document.querySelector('script[src*="/gtm.js"]').onload())
    await f.page.waitForTimeout(30); assert.equal(googlePurchases(f).length, 1)
    await f.page.locator('a[href="/learn"]').click(); await f.page.waitForURL(ORIGIN + '/learn')
    assert.equal(f.googleCalls.some(args => args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'denied'), true)
    await f.close()
  })
  for (const order of [['meta', 'google'], ['google', 'meta']]) {
    await run(`independent vendor grants work once in ${order.join(' then ')} order`, async () => {
      const f = await fixture()
      for (const vendor of order) await (vendor === 'meta' ? grant(f.page) : grantGoogle(f.page)).click()
      await f.page.waitForFunction(() => !!window.fbq?.callMethod && window.dataLayer?.some(row => row.event === 'firstaid_receipt_purchase'))
      await f.page.waitForTimeout(30)
      assert.deepEqual(f.requests, order); assert.equal(purchases(f).length, 1); assert.equal(googlePurchases(f).length, 1)
      assert.equal(purchases(f)[0][4].eventID, googlePurchases(f)[0].fa_receipt_transaction_id)
      await f.close()
    })
  }
  await run('Meta-only, absent and declined Google consent never load GTM, including saved grants', async () => {
    for (const declined of [false, true]) {
      const f = await fixture({ oldGrants: true })
      assert.equal(f.requests.length, 0)
      if (declined) await denyGoogle(f.page).click()
      await grant(f.page).click(); await f.page.waitForFunction(() => !!window.fbq?.callMethod)
      await f.page.waitForTimeout(30)
      assert.deepEqual(f.requests, ['meta']); assert.equal(googlePurchases(f).length, 0)
      await f.close()
    }
  })
  await run('existing direct-Google attempt marker prevents GTM replay without blocking Meta', async () => {
    const f = await fixture({ directGoogleAttempt: true })
    await grantGoogle(f.page).click(); await grant(f.page).click()
    await f.page.waitForFunction(() => !!window.fbq?.callMethod)
    await f.page.waitForTimeout(30)
    assert.deepEqual(f.requests, ['meta']); assert.equal(googlePurchases(f).length, 0)
    assert.equal(await f.page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('firstaid_purchase_attempt_v1:gtm:'))), false)
    await f.close()
  })
  await run('Google concurrent tabs and repeated return enqueue only one custom event', async () => {
    const f = await fixture(), second = await f.context.newPage()
    await second.goto(RECEIPT_URL); await second.locator('#choices').waitFor({ state: 'visible' })
    await Promise.all([grantGoogle(f.page).click(), grantGoogle(second).click()])
    await f.page.waitForTimeout(70)
    assert.deepEqual(f.requests, ['google']); assert.equal(googlePurchases(f).length, 1)
    const third = await f.context.newPage(); await third.goto(RECEIPT_URL); await third.locator('#choices').waitFor({ state: 'visible' }); await grantGoogle(third).click()
    await third.waitForTimeout(30); assert.equal(googlePurchases(f).length, 1); assert.deepEqual(f.requests, ['google'])
    await f.close()
  })
  await run('withdrawal before GTM response cancels the eventual onload purchase callback', async () => {
    const f = await fixture({ holdGoogleResponse: true })
    await grantGoogle(f.page).click(); await f.page.waitForFunction(() => !!window.gtag)
    await f.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
    f.releaseGoogleResponse()
    await f.page.waitForTimeout(100)
    assert.deepEqual(f.requests, ['google']); assert.equal(googlePurchases(f).length, 0)
    assert.equal(await f.page.evaluate(() => window['ga-disable-G-H10PHV2XNG']), true)
    assert.deepEqual(f.googleCalls, [['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]])
    await f.close()
  })
  await run('receipt expiring before GTM response cancels the eventual callback', async () => {
    const f = await fixture({ holdGoogleResponse: true })
    await grantGoogle(f.page).click(); await f.page.waitForFunction(() => !!window.gtag)
    await f.page.evaluate(() => { const now = Date.now(); Date.now = () => now + 901_000 })
    f.releaseGoogleResponse()
    await f.page.waitForTimeout(100)
    assert.deepEqual(f.requests, ['google']); assert.equal(googlePurchases(f).length, 0)
    await f.close()
  })
  await run('withdrawal after GTM callback denies all consent and blocks callback/captured-command replay', async () => {
    const f = await fixture()
    await grantGoogle(f.page).click()
    await f.page.waitForFunction(() => window.dataLayer?.some(row => row.event === 'firstaid_receipt_purchase'))
    await f.page.evaluate(() => {
      const callback = document.querySelector('script[src*="/gtm.js"]').onload
      const gtag = window.gtag
      window.dispatchEvent(new PageTransitionEvent('pagehide'))
      callback(); gtag('consent', 'update', { analytics_storage: 'granted' }); gtag('event', 'purchase', { value: 249 })
    })
    await f.page.waitForTimeout(30)
    assert.equal(googlePurchases(f).length, 1)
    assert.equal(await f.page.evaluate(() => window['ga-disable-G-H10PHV2XNG']), true)
    assert.deepEqual(f.googleCalls.at(-1), ['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    await f.close()
  })
  await run('Google delayed SDK receives only revocation after pagehide', async () => {
    const f = await fixture({ googleEnabled: true, deferSdk: true })
    await f.page.locator('[data-vendor="google"][data-choice="analytics"]').click()
    await f.page.waitForFunction(() => !!window.__releaseGoogle)
    await f.page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.__releaseGoogle() })
    await f.page.waitForTimeout(30)
    assert.equal(f.googleCalls.length, 1); assert.equal(f.googleCalls[0][0], 'consent'); assert.equal(f.googleCalls[0][2].analytics_storage, 'denied')
    await f.close()
  })
  await run('Google storage failure and denial while pending cannot initialize a tag', async () => {
    for (const options of [{ storageFailure: true }, { noLocks: true }, { holdLock: true }]) {
      const f = await fixture({ ...options, googleEnabled: true })
      await f.page.locator('[data-vendor="google"][data-choice="analytics"]').click()
      if (options.holdLock) {
        await f.page.waitForFunction(() => !!window.__releaseLock)
        await f.page.locator('[data-vendor="google"][data-choice="denied"]').click()
        await f.page.evaluate(() => window.__releaseLock())
      }
      await f.page.waitForTimeout(30); assert.equal(f.requests.length, 0)
      await f.close()
    }
  })
  await run('Google cross-tab denial and reload discard the tag and consumed receipt', async () => {
    const f = await fixture({ googleEnabled: true })
    await f.page.locator('[data-vendor="google"][data-choice="analytics"]').click(); await f.page.waitForFunction(() => !!window.gtag)
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
