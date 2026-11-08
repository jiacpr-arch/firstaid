import { OPENAI_CONSENT_KEY, OPENAI_IMAGE_URL } from '../src/lib/trainingOpenAIAds.js'
// CI browser regression. No server, live SDK, credentials, forms, or network passthrough.
// Run after the full build: node scripts/test-ad-boundary.mjs
import assert from 'node:assert/strict'
import { readFile, stat, readdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from 'playwright'
import { GOOGLE_SDK_STUB, META_SDK_STUB } from './ad-boundary-fixtures.mjs'
import { CONSENT_KEY } from '../src/lib/trainingAds.js'
import { GOOGLE_CONSENT_KEY, TRAINING_GA4_ID, TRAINING_GOOGLE_ADS_ID, TRAINING_GOOGLE_LINE_CONVERSION, GOOGLE_PUBLIC_PAGE } from '../src/lib/trainingGoogleAds.js'

const ORIGIN = 'https://firstaid.morroo.com'
const PIXEL = '1277103750989853'
const SDK = 'https://connect.facebook.net/en_US/fbevents.js'
const GOOGLE_SDK = `https://www.googletagmanager.com/gtag/js?id=${TRAINING_GA4_ID}`
const DIST = resolve(new URL('../dist', import.meta.url).pathname)
const AUTH_HOST = 'ad-boundary-test.supabase.co'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
await stat(resolve(DIST, 'index.html'))
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] } : {})
let passed = 0

async function fixture(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const openaiRequests = [], sdkRequests = [], calls = [], mounts = [], blocked = [], googleRequests = [], googleCalls = [], googleObservations = [], googleHistoryArguments = []
  let releaseAuth, authRequests = 0
  let holdRetiringNavigation = false, resolveRetiringNavigation
  const retiringNavigationGate = new Promise(resolve => { resolveRetiringNavigation = resolve })
  const pauseNavigation = () => { holdRetiringNavigation = true }
  const releaseNavigation = () => { holdRetiringNavigation = false; resolveRetiringNavigation() }
  const sdkBody = (source, vendor) => options.deferSdkExecution
    ? `window.__release${vendor}Sdk = () => { delete window.__release${vendor}Sdk; ${source} };`
    : source
  const authGate = new Promise(resolve => { releaseAuth = resolve })
  await context.exposeBinding('__recordAdBoundary', (_source, kind, value) => {
    if (kind === 'call') calls.push(value)
    if (kind === 'mount') mounts.push(value)
    if (kind === 'google') googleCalls.push(value)
    if (kind === 'googleObservation') googleObservations.push(value)
    if (kind === 'googleHistoryArgument') googleHistoryArguments.push(value)
  })
  // Also block WebSockets, which context.route does not intercept.
  await context.routeWebSocket('**/*', socket => socket.close())
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    // Pending-SDK cases deliberately keep the retiring document alive while
    // releasing synthetic script execution after consent has been revoked.
    if (holdRetiringNavigation && request.isNavigationRequest() && url.origin === ORIGIN) await retiringNavigationGate
    if (options.holdAuth && url.hostname === AUTH_HOST && url.pathname === '/auth/v1/token') {
      authRequests++
      await authGate
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_code: 'refresh_token_not_found', message: 'Synthetic session expired' }) })
    }
    if (url.hostname === 'bzr.openai.com') {
      assert.equal(request.url(), OPENAI_IMAGE_URL)
      assert.equal(request.method(), 'GET')
      assert.equal(request.headers().referer, ORIGIN + '/')
      openaiRequests.push(request.url())
      return route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') })
    }
    if (request.url() === GOOGLE_SDK) {
      assert.equal(request.headers().referer, undefined, 'Google SDK request must suppress referrer')
      googleRequests.push(request.url())
      return route.fulfill({ contentType: 'text/javascript', body: sdkBody(GOOGLE_SDK_STUB, 'Google') })
    }
    if (request.url() === SDK) {
      assert.equal(request.headers().referer, undefined, 'SDK request must suppress referrer')
      sdkRequests.push(request.url())
      return route.fulfill({ contentType: 'text/javascript', body: sdkBody(META_SDK_STUB, 'Meta') })
    }
    // Synthetic empty entitlement result only. The application must resolve
    // this before public SDK startup; no real learner or backend is contacted.
    if (url.origin === ORIGIN && url.pathname === '/api/entitlements' && request.method() === 'POST') {
      assert.equal(url.search, '', 'Entitlement identifiers must not enter resource URLs')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ chapters: [], cpr: false }) })
    }
    // Only static GET files at the production origin are fulfilled from disk.
    // Everything else is aborted, including same-origin APIs and analytics.
    if (url.origin !== ORIGIN || request.method() !== 'GET' || /^\/(api|_vercel)\//.test(url.pathname)) {
      blocked.push(request.url()); return route.abort('blockedbyclient')
    }
    let file = resolve(DIST, '.' + decodeURIComponent(url.pathname))
    if (file !== DIST && !file.startsWith(DIST + sep)) return route.abort()
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
      return await route.fulfill({ contentType: mime[extname(file)] || 'application/octet-stream', body: await readFile(file) })
    } catch {
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: await readFile(resolve(DIST, 'index.html')) })
      return route.abort('blockedbyclient')
    }
  })
  await context.addInitScript(({ options, key, googleKey, openaiKey }) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.__documentId = Math.random().toString(36)
    // Seed once per context, not on reload (withdrawal must survive reload).
    if (!sessionStorage.getItem('__boundarySeeded')) {
      for (const [name, value] of Object.entries(options.storage || {})) localStorage.setItem(name, value)
      if (options.consent) localStorage.setItem(key, options.consent)
      if (options.googleConsent) localStorage.setItem(googleKey, options.googleConsent === 'granted' ? JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) : options.googleConsent)
      if (options.openaiConsent) localStorage.setItem(openaiKey, options.openaiConsent)
      sessionStorage.setItem('__boundarySeeded', '1')
    }
    window.__storageFailures = options.storageFailures || []
    let partialGrantWritten = false
    const partialGrantKey = options.partialGrantFailure === 'google' ? googleKey : options.partialGrantFailure === 'meta' ? key : null
    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    const originalRemove = Storage.prototype.removeItem
    const fails = (store, operation) => window.__storageFailures.includes(`${store === localStorage ? 'local' : 'session'}:${operation}`)
    Storage.prototype.getItem = function (name) {
      if (fails(this, 'get')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalGet.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      // A single local grant succeeds, then denial rollback cannot write either
      // store. This must not be treated as consent merely because it persisted.
      if (partialGrantKey && partialGrantWritten) throw new DOMException('Synthetic post-grant write failure', 'SecurityError')
      if (partialGrantKey && this === localStorage && name === partialGrantKey && (value === 'granted' || String(value).includes('\"mode\":\"ads\"'))) {
        const result = originalSet.call(this, name, value)
        partialGrantWritten = true
        return result
      }
      if (fails(this, 'set')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalSet.call(this, name, value)
    }
    Storage.prototype.removeItem = function (name) {
      if (partialGrantKey && partialGrantWritten && this === sessionStorage) throw new DOMException('Synthetic session removal failure', 'SecurityError')
      if (fails(this, 'remove')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalRemove.call(this, name)
    }
  }, { options, key: CONSENT_KEY, googleKey: GOOGLE_CONSENT_KEY, openaiKey: OPENAI_CONSENT_KEY })
  const page = await context.newPage()
  let pageErrorSeen = false, scriptSyntaxErrorSeen = false
  page.on('pageerror', error => {
    pageErrorSeen = true
    scriptSyntaxErrorSeen ||= error.name === 'SyntaxError' || /Identifier .*already been declared/.test(error.message)
  })
  async function waitForSdk(flag) {
    try { await page.waitForFunction(key => window[key] === true, flag) }
    catch (error) {
      // Diagnostics contain only consent categories and booleans. Never include
      // identity, actual URLs, queue contents, DOM text, or exception payloads.
      const state = await page.evaluate(({ metaKey, googleKey, googleSdk }) => {
        const consent = (store, key) => {
          try {
            const value = window[store].getItem(key)
            return (value === 'granted' || String(value).includes('\"mode\":\"ads\"')) || value === 'denied' ? value : value === '1' ? 'denied' : 'unset'
          } catch { return 'unreadable' }
        }
        return {
          metaConsent: consent('localStorage', metaKey), googleConsent: consent('localStorage', googleKey),
          metaTabDenial: consent('sessionStorage', metaKey + '_denied'), googleTabDenial: consent('sessionStorage', googleKey + '_denied'),
          publicLandingVisible: !!document.querySelector('.course-landing'),
          privateDocument: !!window.__firstaidPrivateDocument, marketingRevoked: !!window.__firstaidMarketingRevoked,
          metaLoaded: !!window.__firstaidMetaLoaded, googleLoaded: !!window.__firstaidGoogleLoaded,
          metaRevoked: !!window.__firstaidMetaRevoked, googleRevoked: !!window.__firstaidGoogleRevoked,
          hasGtag: typeof window.gtag === 'function', hasDataLayer: !!window.dataLayer,
          dataLayerIsArray: Array.isArray(window.dataLayer), googleScriptPresent: [...document.scripts].some(script => script.src === googleSdk),
          metaStubLoaded: !!window.__stubSdkLoaded, googleStubLoaded: !!window.__stubGoogleLoaded,
        }
      }, { metaKey: CONSENT_KEY, googleKey: GOOGLE_CONSENT_KEY, googleSdk: GOOGLE_SDK }).catch(() => ({ diagnosticsUnavailable: true }))
      error.message += `; safe SDK diagnostics: ${JSON.stringify({ ...state, pageErrorSeen, scriptSyntaxErrorSeen })}`
      throw error
    }
  }
  async function open(path = '/', referer) {
    await page.goto(ORIGIN + path, { waitUntil: 'load', ...(referer ? { referer } : {}) })
    await page.waitForTimeout(700)
    await showSeparateChoices()
  }
  // The consent card leads with combined "อนุญาตทั้งหมด / ไม่อนุญาตทั้งหมด"; per-vendor cases open "เลือกแยก" first.
  async function showSeparateChoices() {
    const toggle = page.getByRole('button', { name: 'รายละเอียด / เลือกแยก', exact: true })
    if (await toggle.count()) await toggle.click()
  }
  async function grant() {
    await page.getByRole('button', { name: 'อนุญาต', exact: true }).click()
    await waitForSdk('__stubSdkLoaded')
    await page.waitForTimeout(100)
  }
  async function grantGoogle() {
    await page.getByRole('button', { name: 'Google สถิติและวัดผลโฆษณา', exact: true }).click()
    await waitForSdk('__stubGoogleLoaded')
    await page.waitForTimeout(100)
  }
  // Decided vendors collapse into the "ตั้งค่าการวัดผล" chip; open it before using a withdraw/re-grant toggle.
  async function consentToggle(name) {
    const chip = page.getByRole('button', { name: 'ตั้งค่าการวัดผล', exact: true })
    if (await chip.count()) await chip.click()
    return page.getByRole('button', { name, exact: true })
  }
  function noAds() {
    assert.equal(openaiRequests.length, 0, 'No OpenAI image may be requested')
    assert.equal(sdkRequests.length, 0, 'No Meta SDK may be requested'); assert.equal(calls.length, 0)
    assert.equal(googleRequests.length, 0, 'No Google SDK may be requested'); assert.equal(googleCalls.length, 0)
  }
  function googleStayedPublic() {
    assert.ok(googleObservations.length > 0, 'Adversarial Google observer must have run')
    assert.ok(googleObservations.every(item => new URL(item.url).pathname === '/' && !new URL(item.url).hash), 'Google-bearing document never exposes private history or a fragment')
    assert.ok(googleObservations.every(item => item.forms === 0 && item.privateNodes === 0 && !item.insertedPrivateNodes), 'Google-bearing document never contains even transient lesson, auth or form DOM')
    assert.ok(googleObservations.every(item => item.canonical === null || item.canonical === ORIGIN + '/'), 'Google-bearing document never exposes private SEO metadata')
  }
  return { context, page, openaiRequests, sdkRequests, calls, mounts, blocked, googleRequests, googleCalls, googleObservations, googleHistoryArguments, open, grant, grantGoogle, consentToggle, showSeparateChoices, noAds, googleStayedPublic, releaseAuth, pauseNavigation, releaseNavigation, authRequests: () => authRequests }
}
async function test(name, options, fn) {
  if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) return
  const f = await fixture(options)
  try { await fn(f); passed++; console.log(`PASS ${name}`) }
  catch (error) { error.message = `${name}: ${error.message}`; throw error }
  finally { f.releaseNavigation(); await f.context.close() }
}
try {

  await test('combined allow-all grants each vendor separately, then the card leaves the content', {}, async f => {
    await f.page.goto(ORIGIN + '/', { waitUntil: 'load' }); await f.page.waitForTimeout(700); f.noAds()
    await f.page.getByRole('button', { name: 'อนุญาต Meta และ OpenAI', exact: true }).click()
    assert.equal(f.googleRequests.length, 0, 'Combined grant cannot authorize Google purpose')
    await f.grantGoogle()
    await f.page.waitForFunction(() => window.__stubSdkLoaded === true && window.__stubGoogleLoaded === true && window.__firstaidOpenAILoaded === true)
    assert.deepEqual(await f.page.evaluate(keys => keys.map(k => { const v = localStorage.getItem(k); return v?.startsWith('{') ? JSON.parse(v).mode : v }), [CONSENT_KEY, GOOGLE_CONSENT_KEY, OPENAI_CONSENT_KEY]), ['granted', 'ads', 'granted'])
    assert.equal(await f.page.getByRole('dialog').count(), 0)
    assert.equal(await f.page.getByTestId('marketing-consent').isVisible(), false, 'Decided consent must not cover page content')
    const chip = f.page.getByRole('button', { name: 'ตั้งค่าการวัดผล', exact: true })
    assert.equal(await chip.evaluate(el => getComputedStyle(el).position), 'static')
  })
  await test('combined deny-all loads nothing and survives reload', {}, async f => {
    await f.page.goto(ORIGIN + '/', { waitUntil: 'load' }); await f.page.waitForTimeout(700)
    await f.page.getByRole('button', { name: 'ไม่อนุญาตทั้งหมด', exact: true }).click()
    await f.page.waitForTimeout(300); f.noAds()
    assert.deepEqual(await f.page.evaluate(keys => keys.map(k => localStorage.getItem(k)), [CONSENT_KEY, GOOGLE_CONSENT_KEY, OPENAI_CONSENT_KEY]), ['denied', 'denied', 'denied'])
    await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(500); f.noAds()
    assert.equal(await f.page.getByRole('button', { name: 'อนุญาต Meta และ OpenAI', exact: true }).count(), 0)
  })
  await test('deny-all also revokes a previously granted vendor when other choices remain pending', { consent: 'granted' }, async f => {
    await f.open()
    await f.page.waitForFunction(() => window.__stubSdkLoaded === true)
    const oldDocument = await f.page.evaluate(() => window.__documentId)
    await f.page.getByRole('button', { name: 'ไม่อนุญาตทั้งหมด', exact: true }).click()
    await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
    await f.page.waitForTimeout(500)
    assert.deepEqual(await f.page.evaluate(keys => keys.map(k => localStorage.getItem(k)), [CONSENT_KEY, GOOGLE_CONSENT_KEY, OPENAI_CONSENT_KEY]), ['denied', 'denied', 'denied'])
    assert.equal(f.sdkRequests.length, 1, 'The previous Meta SDK must not reload')
    assert.equal(f.googleRequests.length, 0); assert.equal(f.openaiRequests.length, 0)
    assert.ok(f.calls.some(call => call.documentId === oldDocument && call.args[0] === 'consent' && call.args[1] === 'revoke'))
  })
  await test('OpenAI own grant renders exactly one fixed image; withdrawal persists', {}, async f => {
    await f.open(); f.noAds()
    await f.page.getByRole('button', { name: 'อนุญาต OpenAI', exact: true }).click()
    await f.page.waitForFunction(() => window.__firstaidOpenAILoaded === true)
    await f.page.waitForTimeout(200)
    assert.deepEqual(f.openaiRequests, [OPENAI_IMAGE_URL])
    assert.equal(f.sdkRequests.length, 0); assert.equal(f.googleRequests.length, 0)
    assert.equal(await f.page.evaluate(() => typeof window.oaiq), 'undefined')
    const old = await f.page.evaluate(() => window.__documentId)
    await Promise.all([
      f.page.waitForEvent('domcontentloaded'),
      (await f.consentToggle('ถอนความยินยอม OpenAI')).click(),
    ])
    assert.notEqual(await f.page.evaluate(() => window.__documentId), old)
    await f.page.waitForTimeout(300)
    assert.equal(f.openaiRequests.length, 1)
    await f.page.reload(); await f.page.waitForTimeout(300)
    assert.equal(f.openaiRequests.length, 1)
  })
  await test('OpenAI partial grant with failed rollback redirects to durable no-ads URL', {}, async f => {
    await f.open(); f.noAds()
    const old = await f.page.evaluate(key => {
      const set = Storage.prototype.setItem
      const remove = Storage.prototype.removeItem
      let wroteGrant = false
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && name === key) {
          if (wroteGrant) throw new DOMException('Synthetic rollback write failure', 'SecurityError')
          const result = set.call(this, name, value)
          if ((value === 'granted' || String(value).includes('\"mode\":\"ads\"'))) wroteGrant = true
          return result
        }
        if (this === sessionStorage && name === key + '_denied') throw new DOMException('Synthetic session denial write failure', 'SecurityError')
        return set.call(this, name, value)
      }
      Storage.prototype.removeItem = function (name) {
        if (this === sessionStorage && name === key + '_denied') throw new DOMException('Synthetic denial removal failure', 'SecurityError')
        return remove.call(this, name)
      }
      return window.__documentId
    }, OPENAI_CONSENT_KEY)
    await Promise.all([
      f.page.waitForEvent('domcontentloaded'),
      f.page.getByRole('button', { name: 'อนุญาต OpenAI', exact: true }).click(),
    ])
    assert.notEqual(await f.page.evaluate(() => window.__documentId), old)
    assert.equal(new URL(f.page.url()).searchParams.get('marketing_consent'), 'denied')
    await f.page.waitForTimeout(300)
    f.noAds()
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), OPENAI_CONSENT_KEY), 'granted', 'Synthetic stale grant must remain to exercise URL fallback')
    await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(300)
    assert.equal(new URL(f.page.url()).searchParams.get('marketing_consent'), 'denied')
    f.noAds()
  })
  await test('OpenAI grant never inferred from Meta or Google', { consent: 'granted', googleConsent: 'granted' }, async f => {
    await f.open(); assert.equal(f.openaiRequests.length, 0)
    await f.page.getByRole('dialog', { name: 'การวัดผล OpenAI', exact: true }).waitFor()
  })
  await test('oppref entry remains excluded despite OpenAI grant', { openaiConsent: 'granted' }, async f => {
    await f.open('/?oppref=synthetic-opaque'); f.noAds()
  })
  for (const path of ['/learn', '/admin/login', '/auth/line/callback']) {
    await test(`OpenAI-only private boundary ${path}`, { openaiConsent: 'granted' }, async f => {
      await f.open(); assert.equal(f.openaiRequests.length, 1)
      const old = await f.page.evaluate(() => window.__documentId)
      await Promise.all([
        f.page.waitForEvent('domcontentloaded'),
        f.page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path),
      ])
      assert.notEqual(await f.page.evaluate(() => window.__documentId), old)
      await f.page.waitForTimeout(300)
      assert.equal(f.openaiRequests.length, 1)
      assert.equal(await f.page.locator('#firstaid-training-openai').count(), 0)
    })
  }
  await test('anonymous landing requires fresh explicit consent; single verified PageView', {}, async f => {
    await f.open(); await f.page.getByRole('dialog', { name: 'การวัดผลโฆษณา' }).waitFor(); f.noAds()
    await f.grant()
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(f.googleRequests.length, 0, 'Meta consent never authorizes Google')
    assert.deepEqual(f.calls.map(c => c.args), [
      ['set', 'autoConfig', false, PIXEL], ['consent', 'grant'], ['init', PIXEL], ['trackSingle', PIXEL, 'PageView'],
    ])
    await f.page.waitForTimeout(500)
    assert.equal(f.calls.filter(c => c.args[0] === 'trackSingle').length, 1)
    const oldDocument = await f.page.evaluate(() => window.__documentId)
    await (await f.consentToggle('ถอนความยินยอมวัดผลโฆษณา')).click()
    await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
    await f.page.waitForTimeout(500)
    assert.equal(f.sdkRequests.length, 1, 'Withdrawal must not re-load SDK')
    assert.ok(f.calls.some(c => c.args[0] === 'consent' && c.args[1] === 'revoke'))
    assert.equal(await f.page.evaluate(() => !!window.fbq), false)
    await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(500)
    assert.equal(f.sdkRequests.length, 1, 'Reload after withdrawal must not regrant')
  })
  await test('public LINE contact requires consent; emergency 1669 is never an ad contact', {}, async f => {
    await f.open()
    await f.page.getByRole('dialog', { name: 'การวัดผลโฆษณา' }).waitFor()
    const originalUrl = f.page.url()
    const documentId = await f.page.evaluate(() => window.__documentId)
    // Cancel native navigation only. React's own click handler still runs.
    // Never open LINE, a new tab, or an external telephone application.
    await f.page.evaluate(() => {
      document.addEventListener('click', event => {
        const link = event.target.closest?.('a')
        if (link && (link.href.startsWith('https://line.me/') || link.href.startsWith('tel:'))) event.preventDefault()
      }, true)
    })
    const line = f.page.locator('.course-practical-note a[href^="https://line.me/"]')
    const emergency = f.page.locator('a[href="tel:1669"]')
    assert.equal(await line.count(), 1)
    assert.equal(await emergency.count(), 1)
    await line.dispatchEvent('click')
    await emergency.dispatchEvent('click')
    await f.page.waitForTimeout(100); f.noAds()
    await f.grant()
    await line.dispatchEvent('click')
    await f.page.waitForTimeout(100)
    const contacts = () => f.calls.filter(c => c.args.includes('Contact'))
    assert.deepEqual(contacts().map(c => c.args), [[
      'trackSingle', PIXEL, 'Contact',
      { content_name: 'cpr_aed_inperson_course', source: 'firstaid_landing', channel: 'line' },
    ]], 'Only the verified dataset receives the static public LINE contact event')
    await emergency.dispatchEvent('click')
    await f.page.waitForTimeout(100)
    assert.equal(contacts().length, 1, 'Emergency phone action must not be an advertising conversion')
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(f.context.pages().length, 1, 'No external window may open')
    assert.equal(f.page.url(), originalUrl)
    assert.equal(await f.page.evaluate(() => window.__documentId), documentId)
    assert.equal(f.blocked.some(url => /^https:\/\/line\.me\//.test(url)), false, 'LINE navigation must be prevented, not merely blocked')
  })
  await test('decline before SDK can later explicitly grant durable consent', {}, async f => {
    await f.open()
    const documentId = await f.page.evaluate(() => window.__documentId)
    await f.page.getByRole('button', { name: 'ไม่อนุญาต', exact: true }).click()
    await f.page.waitForTimeout(300); f.noAds()
    assert.equal(await f.page.evaluate(() => window.__documentId), documentId)
    await (await f.consentToggle('อนุญาตวัดผลโฆษณา')).click()
    await f.page.waitForFunction(() => window.__stubSdkLoaded === true)
    await f.page.waitForTimeout(100)
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), CONSENT_KEY), 'granted')
    assert.deepEqual(f.calls.map(c => c.args), [
      ['set', 'autoConfig', false, PIXEL], ['consent', 'grant'], ['init', PIXEL], ['trackSingle', PIXEL, 'PageView'],
    ])
  })
  await test('withdrawal with both stores unwritable uses no-ads fallback', {}, async f => {
    await f.open(); await f.grant()
    const oldDocument = await f.page.evaluate(() => { window.__storageFailures = ['local:set', 'session:set']; return window.__documentId })
    await (await f.consentToggle('ถอนความยินยอมวัดผลโฆษณา')).click()
    await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
    await f.page.waitForTimeout(500)
    assert.equal(new URL(f.page.url()).searchParams.get('marketing_consent'), 'denied')
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(await f.page.evaluate(() => !!window.fbq), false)
  })
  await test('legacy consent cannot authorize new dataset', { storage: { firstaid_marketing_consent_v1: 'granted' } }, async f => {
    assert.notEqual(CONSENT_KEY, 'firstaid_marketing_consent_v1')
    await f.open(); f.noAds()
    await f.page.getByRole('button', { name: 'อนุญาต', exact: true }).waitFor()
  })
  for (const path of ['/learn', '/learn/1', '/pre-test', '/admin', '/admin/login', '/auth/line/callback', '/auth/hub/callback']) {
    await test(`SPA transition ${path} destroys SDK before private mount`, {}, async f => {
      await f.open(); await f.grant()
      const oldDocument = await f.page.evaluate(() => window.__documentId)
      await f.page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(700)
      assert.equal(f.sdkRequests.length, 1, 'Fresh private document must not load SDK')
      assert.equal(await f.page.evaluate(() => !!window.fbq), false)
      assert.deepEqual(f.mounts, [], 'No private UI may mount in SDK-bearing document')
      assert.ok(f.calls.some(c => c.args[0] === 'consent' && c.args[1] === 'revoke'))
      assert.equal(f.calls.filter(c => ['track', 'trackSingle', 'trackCustom', 'trackSingleCustom'].includes(c.args[0])).length, 1)
    })
    await test(`direct private route ${path} ignores saved consent`, { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted' }, async f => { await f.open(path); f.noAds() })
  }
  for (const path of ['/learn', '/admin/login', '/auth/line/callback', '/auth/hub/callback']) {
    await test(`private-first document ${path} stays ad-free after SPA return`, { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted' }, async f => {
      await f.open(path); f.noAds()
      const documentId = await f.page.evaluate(() => window.__documentId)
      await f.page.evaluate(() => { history.pushState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate')) })
      await f.page.waitForTimeout(700)
      assert.equal(await f.page.evaluate(() => window.__documentId), documentId, 'Exercise same-document SPA return')
      f.noAds()
    })
  }
  await test('unconsented landing visiting private UI cannot later enable ads in same document', {}, async f => {
    await f.open()
    await f.page.getByRole('dialog', { name: 'การวัดผลโฆษณา' }).waitFor()
    f.noAds()
    const documentId = await f.page.evaluate(() => window.__documentId)
    await f.page.evaluate(() => { history.pushState(null, '', '/learn'); dispatchEvent(new PopStateEvent('popstate')) })
    await f.page.waitForTimeout(700)
    // Model a persisted grant (e.g. another tab), without authorizing this document.
    await f.page.evaluate(key => {
      localStorage.setItem(key, 'granted')
      history.pushState(null, '', '/')
      dispatchEvent(new PopStateEvent('popstate'))
    }, CONSENT_KEY)
    await f.page.waitForTimeout(700)
    assert.equal(await f.page.evaluate(() => window.__documentId), documentId, 'Exercise same-document return after private UI')
    f.noAds()
    assert.equal(await f.page.getByRole('dialog', { name: 'การวัดผลโฆษณา' }).count(), 0, 'Previously private document must not solicit advertising consent')
    assert.equal(await f.page.getByRole('button', { name: 'อนุญาตวัดผลโฆษณา', exact: true }).count(), 0)
  })
  for (const [path, referer] of [
    ['/?email=test%40example.invalid'], ['/#learner'], ['/?utm_source=one&utm_source=two'],
    ...['gclid','gbraid','wbraid','fbclid'].map(key => ['/?'+key+'=0812345678']),
    ['/?utm_campaign=1234567890123'], ['/', 'https://firstaid.morroo.com/learn/1'],
    ['/', 'https://firstaid.morroo.com/?email=test'],
  ]) await test(`unsafe context ${path} ${referer || ''}`, { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted' }, async f => { await f.open(path, referer); f.noAds() })
  for (const profile of [{ name: 'Synthetic learner' }, { phone: '0000000000' }, { email: 'synthetic@example.invalid' }, { lineUserId: 'synthetic' }, { cohortCode: 'synthetic' }, { lineAdded: true }, { lineSkippedAt: 123 }]) {
    await test(`local identity ${Object.keys(profile)[0]} blocks ads`, { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted', storage: { 'firstaid.learner': JSON.stringify({ state: { learner: profile }, version: 0 }) } }, async f => { await f.open(); f.noAds() })
  }
  for (const storageFailures of [['local:get'], ['session:get'], ['local:get', 'session:get']]) {
    await test(`stored grant fails closed on ${storageFailures.join(',')}`, { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted', storageFailures }, async f => { await f.open(); f.noAds() })
  }
  for (const storageFailures of [['local:set'], ['session:remove'], ['local:set', 'session:set']]) {
    await test(`explicit grant fails closed on ${storageFailures.join(',')}`, { storageFailures }, async f => {
      await f.open()
      const button = f.page.getByRole('button', { name: 'อนุญาต', exact: true })
      if (await button.count()) await button.click()
      await f.page.waitForTimeout(500); f.noAds()
    })
  }

  await test('Google consent is separate; clean GA4 pageview and contact-only Ads conversion', {}, async f => {
    await f.open(); await f.page.getByRole('dialog', { name: 'การวัดผล Google' }).waitFor(); f.noAds()
    assert.equal(await f.page.evaluate(() => !!window.gtag || !!window.dataLayer), false)
    await f.grantGoogle()
    assert.equal(f.googleRequests.length, 1)
    assert.equal(f.sdkRequests.length, 0, 'Google consent never authorizes Meta')
    const events = () => f.googleCalls.filter(c => c.args[0] === 'event').map(c => c.args)
    assert.deepEqual(events(), [['event', 'page_view', { ...GOOGLE_PUBLIC_PAGE, user_data: null, send_to: TRAINING_GA4_ID }]])
    const configs = f.googleCalls.filter(c => c.args[0] === 'config').map(c => c.args)
    assert.deepEqual(configs.map(c => c[1]), [TRAINING_GA4_ID, TRAINING_GOOGLE_ADS_ID])
    assert.ok(configs.every(c => c[2].send_page_view === false && c[2].user_data === null && c[2].cookie_domain === 'firstaid.morroo.com' && c[2].cookie_prefix === 'firstaid_attribution_v2'))
    await f.page.evaluate(() => document.addEventListener('click', event => {
      const link = event.target.closest?.('a')
      if (link && (link.href.startsWith('https://line.me/') || link.href.startsWith('tel:'))) event.preventDefault()
    }, true))
    await f.page.locator('.course-practical-note a[href^="https://line.me/"]').dispatchEvent('click')
    await f.page.waitForTimeout(100)
    assert.deepEqual(events().map(c => [c[1], c[2].send_to]), [['page_view', TRAINING_GA4_ID], ['contact', TRAINING_GA4_ID], ['conversion', TRAINING_GOOGLE_LINE_CONVERSION]])
    await f.page.locator('a[href="tel:1669"]').dispatchEvent('click')
    await f.page.waitForTimeout(100)
    assert.equal(events().length, 3, 'Emergency 1669 never generates a Google advertising event')
    assert.ok(events().every(c => c[2].user_data === null), 'Every manual event explicitly opts out of user-data collection')
    assert.equal(f.sdkRequests.length, 0)
    assert.equal(f.context.pages().length, 1)
    f.googleStayedPublic()
  })
  await test('Google purpose changes discard loaded document and repeated choice does not renew', {}, async f => {
    await f.open(); await f.grantGoogle()
    const snapshot = await f.page.evaluate(key => ({grant:localStorage.getItem(key),doc:window.__documentId}), GOOGLE_CONSENT_KEY)
    await f.page.getByRole('button', {name:'Google สถิติและวัดผลโฆษณา',exact:true}).click()
    assert.deepEqual(await f.page.evaluate(key => ({grant:localStorage.getItem(key),doc:window.__documentId}), GOOGLE_CONSENT_KEY),snapshot)
    await f.page.getByRole('button', {name:'Google สถิติอย่างเดียว',exact:true}).click()
    await f.page.waitForFunction(id=>window.__documentId!==id,snapshot.doc)
    await f.page.waitForFunction(()=>window.__stubGoogleLoaded===true)
    const analytics = await f.page.evaluate(key => ({grant:JSON.parse(localStorage.getItem(key)),doc:window.__documentId}),GOOGLE_CONSENT_KEY)
    assert.equal(analytics.grant.mode,'analytics')
    const configs=f.googleCalls.filter(c=>c.documentId===analytics.doc && c.args[0]==='config')
    assert.equal(configs.length,1);assert.equal(configs[0].args[2].cookie_prefix,'firstaid_analytics')
    await f.showSeparateChoices();await f.grantGoogle()
    await f.page.waitForFunction(id=>window.__documentId!==id,analytics.doc)
    await f.page.waitForFunction(()=>window.__stubGoogleLoaded===true)
    assert.equal(await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).mode,GOOGLE_CONSENT_KEY),'ads')
  })
  await test('declining Google does not deny Meta and may be explicitly changed later', {}, async f => {
    await f.open()
    await f.page.getByRole('button', { name: 'ไม่อนุญาต / ถอนความยินยอม Google', exact: true }).click()
    await f.grant()
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(f.googleRequests.length, 0)
    await f.grantGoogle()
    assert.equal(f.sdkRequests.length, 1)
    assert.equal(f.googleRequests.length, 1)
  })
  await test('declining Meta does not deny Google', {}, async f => {
    await f.open()
    await f.page.getByRole('button', { name: 'ไม่อนุญาต', exact: true }).click()
    await f.grantGoogle()
    assert.equal(f.sdkRequests.length, 0)
    assert.equal(f.googleRequests.length, 1)
  })
  for (const method of ['pushState', 'replaceState']) for (const path of ['/learn', '/learn/1', '/admin/login', '/auth/line/callback?code=synthetic', '/auth/hub/callback?code=synthetic']) {
    await test(`Google ${method} ${path} keeps actual location and DOM public before document replacement`, {}, async f => {
      await f.open(); await f.grantGoogle()
      const oldDocument = await f.page.evaluate(() => window.__documentId)
      await f.page.evaluate(({ method, path }) => { history[method](null, '', path); dispatchEvent(new PopStateEvent('popstate')) }, { method, path })
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(500)
      assert.equal(new URL(f.page.url()).pathname, new URL(path, ORIGIN).pathname)
      assert.equal(f.googleRequests.length, 1)
      assert.equal(f.sdkRequests.length, 0)
      assert.equal(await f.page.evaluate(() => !!window.gtag || !!window.fbq), false)
      assert.ok(f.googleObservations.some(item => item.reason === method), 'SDK history wrapper must observe the attempted navigation')
      assert.ok(f.googleHistoryArguments.some(item => item.documentId === oldDocument && item.method === method && item.target === path), 'Later wrappers can observe synthetic arguments before our guard; only actual location and DOM are protected')
      f.googleStayedPublic()
    })
  }
  for (const [name, selector, mobile] of [
    ['desktop navigation', '.course-desktop-nav a[href="/learn"]', false],
    ['start lesson', '.course-hero-actions a.btn-primary', false],
    ['chapter anchor', '.course-chapter', false],
    ['course tool', '.course-tools a[href="/schedule"]', false],
    ['game link', '.course-game-shortcut', false],
    ['mobile navigation', '.bottom-bar a[href="/call"]', true],
  ]) {
    await test(`Google and Meta public ${name} bypasses SDK history arguments`, {}, async f => {
      if (mobile) await f.page.setViewportSize({ width: 390, height: 844 })
      await f.open(); await f.grantGoogle(); await f.grant()
      const oldDocument = await f.page.evaluate(() => window.__documentId)
      const link = f.page.locator(selector).first()
      const target = new URL(await link.getAttribute('href'), ORIGIN)
      assert.notEqual(target.pathname, '/', 'Exercise a genuine private-page link')
      const previousArguments = f.googleHistoryArguments.length
      await link.click()
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(500)
      assert.equal(new URL(f.page.url()).pathname, target.pathname)
      assert.equal(f.sdkRequests.length, 1)
      assert.equal(f.googleRequests.length, 1)
      assert.equal(await f.page.evaluate(() => !!window.gtag || !!window.fbq), false)
      assert.deepEqual(f.mounts, [])
      assert.deepEqual(f.googleHistoryArguments.slice(previousArguments).filter(item => item.documentId === oldDocument), [], 'Captured public links never pass target arguments through an SDK history wrapper')
      f.googleStayedPublic()
    })
  }
  for (const storageFailures of [[], ['local:set'], ['local:set', 'session:set']]) {
    await test(`Google withdrawal survives stale local grant and ${storageFailures.join(',') || 'working storage'}`, {}, async f => {
      await f.open(); await f.grantGoogle()
      const oldDocument = await f.page.evaluate(failures => { window.__storageFailures = failures; return window.__documentId }, storageFailures)
      await (await f.consentToggle('ไม่อนุญาต / ถอนความยินยอม Google')).click()
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(500)
      assert.equal(f.googleRequests.length, 1)
      assert.equal(await f.page.evaluate(() => !!window.gtag), false)
      assert.ok(f.googleCalls.some(c => c.args[0] === 'consent' && c.args[1] === 'update' && c.args[2].analytics_storage === 'denied'))
      if (storageFailures.length === 2) assert.equal(new URL(f.page.url()).searchParams.get('marketing_consent'), 'denied')
      await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(500)
      assert.equal(f.googleRequests.length, 1)
    })
  }
  for (const storageFailures of [['local:set'], ['session:remove'], ['local:set', 'session:set']]) {
    await test(`Google explicit grant fails closed on ${storageFailures.join(',')}`, { storageFailures }, async f => {
      await f.open()
      const button = f.page.getByRole('button', { name: 'Google สถิติและวัดผลโฆษณา', exact: true })
      if (await button.count()) await button.click()
      await f.page.waitForTimeout(300); f.noAds()
      await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(500); f.noAds()
    })
  }
  await test('Google and Meta cached document revokes on hide and reloads on restore', {}, async f => {
    await f.open(); await f.grantGoogle(); await f.grant()
    const oldDocument = await f.page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
      return window.__documentId
    })
    await f.page.waitForTimeout(100)
    assert.equal(await f.page.evaluate(() => window.__firstaidGoogleRevoked && window.__firstaidMetaRevoked), true)
    await f.page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
    f.googleStayedPublic()
  })
  await test('Google withdrawal from another tab discards the original SDK document', {}, async f => {
    await f.open(); await f.grantGoogle()
    const oldDocument = await f.page.evaluate(() => window.__documentId)
    const other = await f.context.newPage()
    await other.goto(ORIGIN + '/learn', { waitUntil: 'load' })
    await other.evaluate(key => localStorage.setItem(key, 'denied'), GOOGLE_CONSENT_KEY)
    await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
    await f.page.waitForTimeout(500)
    assert.equal(f.googleRequests.length, 1)
    assert.equal(await f.page.evaluate(() => !!window.gtag), false)
    f.googleStayedPublic()
    await other.close()
  })
  for (const vendor of ['meta', 'google']) {
    await test(`${vendor} partial grant with failed rollback uses a no-ads document`, { partialGrantFailure: vendor }, async f => {
      await f.open(); f.noAds()
      const oldDocument = await f.page.evaluate(() => window.__documentId)
      const button = vendor === 'google' ? 'Google สถิติและวัดผลโฆษณา' : 'อนุญาต'
      await f.page.getByRole('button', { name: button, exact: true }).click()
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(500)
      assert.equal(new URL(f.page.url()).searchParams.get('marketing_consent'), 'denied')
      const key = vendor === 'google' ? GOOGLE_CONSENT_KEY : CONSENT_KEY
      assert.equal(await f.page.evaluate(key => localStorage.getItem(key)?.startsWith('{') ? JSON.parse(localStorage.getItem(key)).mode : localStorage.getItem(key), key), vendor === 'google' ? 'ads' : 'granted', 'Verify the surviving partial grant, not an accidentally successful rollback')
      f.noAds()
      assert.equal(await f.page.evaluate(() => !!window.gtag || !!window.fbq), false)
      await f.page.reload({ waitUntil: 'load' }); await f.page.waitForTimeout(500)
      f.noAds()
    })
  }
  for (const retirement of ['google-withdrawal', 'meta-withdrawal', 'private-navigation']) {
    await test(`pending SDK cannot replay queued LINE intent after ${retirement}`, { deferSdkExecution: true }, async f => {
      const google = retirement !== 'meta-withdrawal'
      const meta = retirement !== 'google-withdrawal'
      await f.open()
      if (google) {
        await f.page.getByRole('button', { name: 'Google สถิติและวัดผลโฆษณา', exact: true }).click()
        await f.page.waitForFunction(() => typeof window.__releaseGoogleSdk === 'function')
      }
      if (meta) {
        await f.page.getByRole('button', { name: 'อนุญาต', exact: true }).click()
        await f.page.waitForFunction(() => typeof window.__releaseMetaSdk === 'function')
      }
      await f.page.evaluate(() => document.addEventListener('click', event => {
        if (event.target.closest?.('a')?.href.startsWith('https://line.me/')) event.preventDefault()
      }, true))
      await f.page.locator('.course-practical-note a[href^="https://line.me/"]').dispatchEvent('click')
      const prepared = await f.page.evaluate(() => ({
        googleContactPending: !!window.dataLayer?.some(args => args[0] === 'event' && args[1] === 'conversion'),
        metaContactPending: !!window.fbq?.queue?.some(args => args.includes('Contact')),
        googleExecuted: !!window.__stubGoogleLoaded, metaExecuted: !!window.__stubSdkLoaded,
      }))
      assert.equal(prepared.googleContactPending, google)
      assert.equal(prepared.metaContactPending, meta)
      assert.equal(prepared.googleExecuted, false)
      assert.equal(prepared.metaExecuted, false)
      assert.equal(f.googleCalls.length, 0)
      assert.equal(f.calls.length, 0)
      const oldDocument = await f.page.evaluate(() => window.__documentId)
      f.pauseNavigation()
      const target = retirement === 'private-navigation'
        ? f.page.locator('.course-desktop-nav a[href="/learn"]')
        : await f.consentToggle(retirement === 'google-withdrawal' ? 'ไม่อนุญาต / ถอนความยินยอม Google' : 'ถอนความยินยอมวัดผลโฆษณา')
      // A pending reload can suspend later Playwright frame evaluations even
      // while its response is held. Observe the real synchronous click handler
      // and release the synthetic SDK in one evaluation, before it can commit.
      const retired = await target.evaluate((element, { google, meta }) => {
        const beforeDocument = window.__documentId
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 }))
        const state = {
          beforeDocument, afterDocument: window.__documentId,
          googleRevoked: !!window.__firstaidGoogleRevoked, metaRevoked: !!window.__firstaidMetaRevoked,
          marketingRevoked: !!window.__firstaidMarketingRevoked, privateDocument: !!window.__firstaidPrivateDocument,
          googleReleaseReady: typeof window.__releaseGoogleSdk === 'function', metaReleaseReady: typeof window.__releaseMetaSdk === 'function',
        }
        // Missing revocation is a real failure, not a reason to bypass the
        // guard or quietly cancel the late-SDK portion of this test.
        if ((google && !state.googleRevoked) || (meta && !state.metaRevoked)) return state
        // Captured application shims must not repopulate the revoked queues.
        if (google) {
          window.gtag('event', 'synthetic_late_event', { send_to: 'synthetic' })
          window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted' })
          window.__releaseGoogleSdk()
        }
        if (meta) {
          window.fbq('trackSingle', 'synthetic', 'Contact')
          window.fbq('consent', 'grant')
          window.__releaseMetaSdk()
        }
        return { ...state, afterReleaseDocument: window.__documentId, googleExecuted: !!window.__stubGoogleLoaded, metaExecuted: !!window.__stubSdkLoaded }
      }, { google, meta })
      // Diagnostics are fixture document IDs and booleans only, never user data.
      const diagnostics = JSON.stringify(retired)
      assert.equal(retired.beforeDocument, oldDocument, diagnostics)
      assert.equal(retired.afterDocument, oldDocument, 'Exercise the retiring document before navigation commits: ' + diagnostics)
      assert.ok(!google || retired.googleRevoked, 'Google must be revoked synchronously: ' + diagnostics)
      assert.ok(!meta || retired.metaRevoked, 'Meta must be revoked synchronously: ' + diagnostics)
      assert.equal(retired.afterReleaseDocument, oldDocument, diagnostics)
      assert.ok(!google || (retired.googleReleaseReady && retired.googleExecuted), 'Late Google stub must actually execute: ' + diagnostics)
      assert.ok(!meta || (retired.metaReleaseReady && retired.metaExecuted), 'Late Meta stub must actually execute: ' + diagnostics)
      await f.page.waitForTimeout(100)
      if (google) {
        assert.ok(f.googleCalls.length > 0, 'Late Google stub must execute and receive denial')
        assert.ok(f.googleCalls.every(call => call.documentId === oldDocument && call.args[0] === 'consent' && call.args[1] === 'update' && ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization'].every(key => call.args[2][key] === 'denied')), 'No old grant, config, pageview or Ads conversion may replay')
        f.googleStayedPublic()
      }
      if (meta) {
        assert.ok(f.calls.length > 0, 'Late Meta stub must execute and receive revocation')
        assert.ok(f.calls.every(call => call.documentId === oldDocument && call.args.length === 2 && call.args[0] === 'consent' && call.args[1] === 'revoke'), 'No old Meta initialization, PageView or Contact may replay')
      }
      assert.equal(f.context.pages().length, 1)
      f.releaseNavigation()
      await f.page.waitForFunction(id => window.__documentId !== id, oldDocument)
      await f.page.waitForTimeout(500)
      assert.equal(await f.page.evaluate(() => !!window.gtag || !!window.fbq), false)
      assert.equal(f.googleRequests.length, google ? 1 : 0)
      assert.equal(f.sdkRequests.length, meta ? 1 : 0)
    })
  }
  const assets = await readdir(resolve(DIST, 'assets'))
  const js = (await Promise.all(assets.filter(x => x.endsWith('.js')).map(x => readFile(resolve(DIST, 'assets', x), 'utf8')))).join('\n')
  if (js.includes(AUTH_HOST)) {
    const session = { access_token: 'synthetic-not-a-real-token', refresh_token: 'synthetic-not-a-real-refresh', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
    await test('pending Supabase auth resolution fails closed', { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted', holdAuth: true, storage: { 'sb-ad-boundary-test-auth-token': JSON.stringify({ ...session, expires_at: 1 }) } }, async f => {
      await f.open(); f.noAds()
      assert.ok(f.authRequests() > 0, 'Synthetic refresh must actually be pending')
      f.releaseAuth()
      await f.page.waitForFunction(() => window.__stubSdkLoaded === true)
      assert.equal(f.sdkRequests.length, 1, 'Resolved anonymous auth may load with saved consent')
      await f.page.waitForFunction(() => window.__stubGoogleLoaded === true)
      assert.equal(f.googleRequests.length, 1)
    })
    await test('Supabase session without local learner blocks ads', { consent: 'granted', googleConsent: 'granted', openaiConsent: 'granted', storage: { 'sb-ad-boundary-test-auth-token': JSON.stringify(session) } }, async f => { await f.open(); f.noAds() })
  } else if (process.env.CI) {
    throw new Error('CI build must use VITE_SUPABASE_URL=https://ad-boundary-test.supabase.co for auth-session coverage')
  } else console.log('SKIP auth-session browser case: build lacks synthetic Supabase fixture (required in CI)')
  console.log(`PASS ${passed} network-blocked browser boundary cases; no requests passed through`)
} finally { await browser.close() }
