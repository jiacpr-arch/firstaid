// CI browser regression. No server, live SDK, credentials, forms, or network passthrough.
// Run after the full build: node scripts/test-ad-boundary.mjs
import assert from 'node:assert/strict'
import { readFile, stat, readdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from 'playwright'
import { CONSENT_KEY } from '../src/lib/trainingAds.js'

const ORIGIN = 'https://firstaid.morroo.com'
const PIXEL = '1277103750989853'
const SDK = 'https://connect.facebook.net/en_US/fbevents.js'
const DIST = resolve(new URL('../dist', import.meta.url).pathname)
const AUTH_HOST = 'ad-boundary-test.supabase.co'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
await stat(resolve(DIST, 'index.html'))
const browser = await chromium.launch()
let passed = 0

async function fixture(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const sdkRequests = [], calls = [], mounts = [], blocked = []
  let releaseAuth, authRequests = 0
  const authGate = new Promise(resolve => { releaseAuth = resolve })
  await context.exposeBinding('__recordAdBoundary', (_source, kind, value) => {
    if (kind === 'call') calls.push(value)
    if (kind === 'mount') mounts.push(value)
  })
  // Also block WebSockets, which context.route does not intercept.
  await context.routeWebSocket('**/*', socket => socket.close())
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (options.holdAuth && url.hostname === AUTH_HOST && url.pathname === '/auth/v1/token') {
      authRequests++
      await authGate
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_code: 'refresh_token_not_found', message: 'Synthetic session expired' }) })
    }
    if (request.url() === SDK) {
      assert.equal(request.headers().referer, undefined, 'SDK request must suppress referrer')
      sdkRequests.push(request.url())
      return route.fulfill({ contentType: 'text/javascript', body: `
        window.__stubSdkLoaded = true;
        const record = args => window.__recordAdBoundary('call', { documentId: window.__documentId, args });
        const queued = window.fbq.queue.splice(0);
        window.fbq.callMethod = (...args) => record(args);
        queued.forEach(record);
        new MutationObserver(records => {
          if (location.pathname !== '/' && records.some(r => [...r.addedNodes].some(n => n.nodeType === 1))) {
            window.__recordAdBoundary('mount', { documentId: window.__documentId, path: location.pathname });
          }
        }).observe(document.getElementById('root'), { childList: true, subtree: true });
      ` })
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
  await context.addInitScript(({ options, key }) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.__documentId = Math.random().toString(36)
    // Seed once per context, not on reload (withdrawal must survive reload).
    if (!sessionStorage.getItem('__boundarySeeded')) {
      for (const [name, value] of Object.entries(options.storage || {})) localStorage.setItem(name, value)
      if (options.consent) localStorage.setItem(key, options.consent)
      sessionStorage.setItem('__boundarySeeded', '1')
    }
    window.__storageFailures = options.storageFailures || []
    const originalGet = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    const originalRemove = Storage.prototype.removeItem
    const fails = (store, operation) => window.__storageFailures.includes(`${store === localStorage ? 'local' : 'session'}:${operation}`)
    Storage.prototype.getItem = function (name) {
      if (fails(this, 'get')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalGet.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      if (fails(this, 'set')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalSet.call(this, name, value)
    }
    Storage.prototype.removeItem = function (name) {
      if (fails(this, 'remove')) throw new DOMException('Test storage unavailable', 'SecurityError')
      return originalRemove.call(this, name)
    }
  }, { options, key: CONSENT_KEY })
  const page = await context.newPage()
  async function open(path = '/', referer) {
    await page.goto(ORIGIN + path, { waitUntil: 'load', ...(referer ? { referer } : {}) })
    await page.waitForTimeout(700)
  }
  async function grant() {
    await page.getByRole('button', { name: 'อนุญาต', exact: true }).click()
    await page.waitForFunction(() => window.__stubSdkLoaded === true)
    await page.waitForTimeout(100)
  }
  function noAds() { assert.equal(sdkRequests.length, 0, 'No Meta SDK may be requested'); assert.equal(calls.length, 0) }
  return { context, page, sdkRequests, calls, mounts, blocked, open, grant, noAds, releaseAuth, authRequests: () => authRequests }
}
async function test(name, options, fn) {
  const f = await fixture(options)
  try { await fn(f); passed++; console.log(`PASS ${name}`) }
  catch (error) { error.message = `${name}: ${error.message}`; throw error }
  finally { await f.context.close() }
}
try {
  await test('anonymous landing requires fresh explicit consent; single verified PageView', {}, async f => {
    await f.open(); await f.page.getByRole('dialog', { name: 'การวัดผลโฆษณา' }).waitFor(); f.noAds()
    await f.grant()
    assert.equal(f.sdkRequests.length, 1)
    assert.deepEqual(f.calls.map(c => c.args), [
      ['set', 'autoConfig', false, PIXEL], ['consent', 'grant'], ['init', PIXEL], ['trackSingle', PIXEL, 'PageView'],
    ])
    await f.page.waitForTimeout(500)
    assert.equal(f.calls.filter(c => c.args[0] === 'trackSingle').length, 1)
    const oldDocument = await f.page.evaluate(() => window.__documentId)
    await f.page.getByRole('button', { name: 'ถอนความยินยอมวัดผลโฆษณา', exact: true }).click()
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
    await f.page.getByRole('button', { name: 'อนุญาตวัดผลโฆษณา', exact: true }).click()
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
    await f.page.getByRole('button', { name: 'ถอนความยินยอมวัดผลโฆษณา', exact: true }).click()
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
    await test(`direct private route ${path} ignores saved consent`, { consent: 'granted' }, async f => { await f.open(path); f.noAds() })
  }
  for (const path of ['/learn', '/admin/login', '/auth/line/callback', '/auth/hub/callback']) {
    await test(`private-first document ${path} stays ad-free after SPA return`, { consent: 'granted' }, async f => {
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
    ['/?utm_campaign=1234567890123'], ['/', 'https://firstaid.morroo.com/learn/1'],
    ['/', 'https://firstaid.morroo.com/?email=test'],
  ]) await test(`unsafe context ${path} ${referer || ''}`, { consent: 'granted' }, async f => { await f.open(path, referer); f.noAds() })
  for (const profile of [{ name: 'Synthetic learner' }, { phone: '0000000000' }, { email: 'synthetic@example.invalid' }, { lineUserId: 'synthetic' }, { cohortCode: 'synthetic' }, { lineAdded: true }, { lineSkippedAt: 123 }]) {
    await test(`local identity ${Object.keys(profile)[0]} blocks ads`, { consent: 'granted', storage: { 'firstaid.learner': JSON.stringify({ state: { learner: profile }, version: 0 }) } }, async f => { await f.open(); f.noAds() })
  }
  for (const storageFailures of [['local:get'], ['session:get'], ['local:get', 'session:get']]) {
    await test(`stored grant fails closed on ${storageFailures.join(',')}`, { consent: 'granted', storageFailures }, async f => { await f.open(); f.noAds() })
  }
  for (const storageFailures of [['local:set'], ['session:remove'], ['local:set', 'session:set']]) {
    await test(`explicit grant fails closed on ${storageFailures.join(',')}`, { storageFailures }, async f => {
      await f.open()
      const button = f.page.getByRole('button', { name: 'อนุญาต', exact: true })
      if (await button.count()) await button.click()
      await f.page.waitForTimeout(500); f.noAds()
    })
  }
  const assets = await readdir(resolve(DIST, 'assets'))
  const js = (await Promise.all(assets.filter(x => x.endsWith('.js')).map(x => readFile(resolve(DIST, 'assets', x), 'utf8')))).join('\n')
  if (js.includes(AUTH_HOST)) {
    const session = { access_token: 'synthetic-not-a-real-token', refresh_token: 'synthetic-not-a-real-refresh', token_type: 'bearer', expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
    await test('pending Supabase auth resolution fails closed', { consent: 'granted', holdAuth: true, storage: { 'sb-ad-boundary-test-auth-token': JSON.stringify({ ...session, expires_at: 1 }) } }, async f => {
      await f.open(); f.noAds()
      assert.ok(f.authRequests() > 0, 'Synthetic refresh must actually be pending')
      f.releaseAuth()
      await f.page.waitForFunction(() => window.__stubSdkLoaded === true)
      assert.equal(f.sdkRequests.length, 1, 'Resolved anonymous auth may load with saved consent')
    })
    await test('Supabase session without local learner blocks ads', { consent: 'granted', storage: { 'sb-ad-boundary-test-auth-token': JSON.stringify(session) } }, async f => { await f.open(); f.noAds() })
  } else if (process.env.CI) {
    throw new Error('CI build must use VITE_SUPABASE_URL=https://ad-boundary-test.supabase.co for auth-session coverage')
  } else console.log('SKIP auth-session browser case: build lacks synthetic Supabase fixture (required in CI)')
  console.log(`PASS ${passed} network-blocked browser boundary cases; no requests passed through`)
} finally { await browser.close() }
