// Real Chromium + actual App/Zustand stores, with synthetic local data only.
// Run: CHROMIUM_EXECUTABLE_PATH=/tmp/chromium node scripts/test-entitlement-boundary.mjs
// This builds into an OS temporary directory. A test-only Vite transform exposes
// store controls in that temporary bundle; shipping source/dist are never edited.
// Every request/WebSocket is intercepted. No live SDK, auth, API, or customer data.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://firstaid.morroo.com'
const META = 'https://connect.facebook.net/en_US/fbevents.js'
const GOOGLE = 'https://www.googletagmanager.com/gtag/js?id=G-H10PHV2XNG'
const CONSENT = {
  meta: 'firstaid_jia_training_meta_consent_v2',
  google: 'firstaid_jia_training_google_consent_v2',
  openai: 'firstaid_jia_training_openai_consent_v1',
}
const EMPTY = { chapters: [], cpr: false }
const CLASS = { chapters: [0], cpr: false }
const BUNDLE = { chapters: [0], cpr: true }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const temp = await mkdtemp(join(tmpdir(), 'firstaid-entitlement-boundary-'))
const dist = join(temp, 'dist')
let browser, passed = 0

// The production modules stay unchanged. Hooks call real store actions and real
// loaders, never substitute entitlement readiness, refresh logic, or App markup.
const TEST_CONTROLS = `
import { useLearnerStore as boundaryLearners } from './stores/learnerStore';
import { useEntitlementStore as boundaryEntitlements, entitlementKey as boundaryKey } from './stores/entitlementStore';
import { useAuthStore as boundaryAuth } from './stores/authStore';
import { useProgressStore as boundaryProgress } from './stores/progressStore';
import { loadTrainingPixel as boundaryLoadMeta, TRAINING_PIXEL_ID as boundaryPixel } from './lib/trainingAds';
import { loadTrainingGoogle as boundaryLoadGoogle } from './lib/trainingGoogleAds';
import { loadTrainingOpenAI as boundaryLoadOpenAI } from './lib/trainingOpenAIAds';
window.__entitlementTest = {
  refresh: () => boundaryEntitlements.getState().refresh(boundaryAuth.getState().session),
  changeLearner: id => boundaryLearners.setState({ learner: { id, name: '' } }),
  state: () => {
    const value = boundaryEntitlements.getState();
    return { status: value.status, loading: value.loading, ownsBundle: value.chapters.has(0), cpr: value.cpr,
      progressReady: boundaryProgress.getState().loaded && !boundaryProgress.getState().loading,
      privateDocument: !!window.__firstaidPrivateDocument,
      currentKey: value.key === boundaryKey(boundaryAuth.getState().session, boundaryLearners.getState().learner?.id) };
  },
  staleLoaders: () => {
    boundaryLoadMeta(window, document, boundaryPixel);
    boundaryLoadGoogle(window, document, { publicLanding: true });
    boundaryLoadOpenAI(window, document, { publicLanding: true });
  },
};
`

// Minimal SDKs deliberately retain DOM observers after revocation. Only boolean
// observations and document IDs are reported, never identity, body text, or URLs.
function sdkStub(vendor) {
  return `(() => {
    window.__entitlementStub${vendor} = true;
    window.__recordEntitlementBoundary('historical-resource', {
      documentId: window.__entitlementDocumentId, vendor: '${vendor}',
      count: performance.getEntriesByType('resource').filter(entry => new URL(entry.name).searchParams.has('learnerId')).length,
    });
    const observe = records => {
      const owner = node => node.textContent?.includes('เริ่มบทที่ 1') ||
        (node.nodeType === 1 && (node.matches('.page-container, form, input, textarea') || !!node.querySelector('.page-container, form, input, textarea')));
      window.__recordEntitlementBoundary('sdk-dom', {
        documentId: window.__entitlementDocumentId, hadSDK: true,
        ownershipVisible: document.querySelector('.course-hero-actions')?.textContent.includes('เริ่มบทที่ 1') || false,
        privateInserted: (records || []).some(record => [...record.addedNodes].some(owner)),
      });
    };
    const record = args => window.__recordEntitlementBoundary('sdk-command', {
      documentId: window.__entitlementDocumentId, vendor: '${vendor}',
      revoked: args[0] === 'consent' && (args[1] === 'revoke' || args[2]?.analytics_storage === 'denied'),
    });
    ${vendor === 'Meta'
      ? 'const queued = window.fbq.queue.splice(0); window.fbq.callMethod = (...args) => record(args); queued.forEach(record);'
      : 'const queued = window.dataLayer.splice(0); window.dataLayer.push = (...rows) => { rows.forEach(record); return 0; }; queued.forEach(record);'}
    observe();
    new MutationObserver(observe).observe(document.getElementById('root'), { childList: true, subtree: true });
  })();`
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, message) {
  for (let n = 0; n < 250; n++) { if (check()) return; await delay(20) }
  assert.fail(message)
}

async function fixture(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const events = [], sdkRequests = [], unexpected = [], pageErrors = [], routeErrors = []
  let response = options.response || EMPTY, responseStatus = options.status || 200
  let held = !!options.hold, heldRequests = [], apiCount = 0
  let retiringHeld = false, navigationRelease
  const navigationGate = new Promise(resolve => { navigationRelease = resolve })
  const respond = async route => route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(response) })
  await context.exposeBinding('__recordEntitlementBoundary', (_source, kind, value) => events.push({ kind, ...value }))
  await context.routeWebSocket('**/*', socket => { unexpected.push('websocket'); socket.close() })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.isNavigationRequest() && url.origin === ORIGIN) {
      events.push({ kind: 'navigation' })
      if (retiringHeld) await navigationGate
    }
    if (request.url() === META || request.url() === GOOGLE) {
      const vendor = request.url() === META ? 'Meta' : 'Google'
      sdkRequests.push(vendor)
      if (request.headers().referer !== undefined) routeErrors.push('SDK request did not suppress referrer')
      return route.fulfill({ contentType: 'text/javascript', body: sdkStub(vendor) })
    }
    if (url.origin === ORIGIN && url.pathname === '/api/entitlements' && request.method() === 'POST') {
      if (url.search) routeErrors.push('Entitlement endpoint must not expose identity in URL query')
      const body = request.postDataJSON()
      if (!body || Object.keys(body).join(',') !== 'learnerId' || !/^synthetic-learner-[a-z]$/.test(body.learnerId)) routeErrors.push('Unexpected synthetic entitlement request shape')
      apiCount++
      events.push({ kind: 'api-request' })
      if (held) { heldRequests.push(route); return }
      return respond(route)
    }
    // Fonts and first-party analytics are inert local mocks, not pass-throughs.
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' })
    if (url.origin === 'https://class.jiacpr.com' && /^\/images\/certificates\/firstaid-(theory|practical)\.jpg$/.test(url.pathname)) {
      return route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') })
    }
    if (url.origin === ORIGIN && url.pathname === '/_vercel/insights/script.js') return route.fulfill({ contentType: 'text/javascript', body: '' })
    if (url.origin === ORIGIN && request.method() === 'GET' && !/^\/(api|_vercel)\//.test(url.pathname)) {
      for (const base of [dist, join(ROOT, 'public')]) {
        let file = resolve(base, '.' + decodeURIComponent(url.pathname))
        if (file !== base && !file.startsWith(base + sep)) break
        try {
          if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
          return await route.fulfill({ contentType: mime[extname(file)] || 'application/octet-stream', body: await readFile(file) })
        } catch { /* try the next local asset root */ }
      }
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: await readFile(join(dist, 'index.html')) })
    }
    // Deliberately do not record query strings, headers, bodies, or learner IDs.
    unexpected.push(request.resourceType())
    return route.abort('blockedbyclient')
  })
  await context.addInitScript(({ consent, savedGrants, failTimingCleanup }) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.__entitlementDocumentId = crypto.randomUUID()
    if (!sessionStorage.getItem('__entitlementSeeded')) {
      sessionStorage.setItem('__entitlementSeeded', '1')
      localStorage.setItem('firstaid.learner', JSON.stringify({ state: { learner: { id: 'synthetic-learner-a', name: '' } }, version: 0 }))
      if (savedGrants) for (const key of Object.values(consent)) localStorage.setItem(key, key.includes('_google_') ? JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) : 'granted')
    }
    const report = (kind, extra = {}) => window.__recordEntitlementBoundary(kind, {
      documentId: window.__entitlementDocumentId,
      hadSDK: !!window.__firstaidMarketingLoaded,
      ...extra,
    })
    report('document')
    const originalFetch = window.fetch
    if (failTimingCleanup) performance.clearResourceTimings = () => { throw new Error('Synthetic unavailable performance cleanup') }
    window.fetch = function (...args) {
      // This runs at the actual fetch call, before any network interception.
      // It records only the document ID and whether SDK code has ever loaded.
      report('fetch')
      return originalFetch.apply(this, args)
    }
    window.addEventListener('pagehide', () => report('pagehide'))
    window.addEventListener('pageshow', event => report('pageshow', { persisted: event.persisted }))
  }, { consent: CONSENT, savedGrants: !!options.savedGrants, failTimingCleanup: !!options.failTimingCleanup })
  const page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(error.name))
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!window.__entitlementTest)
  await until(() => apiCount > 0, 'Actual App must start its initial entitlement request')
  await page.waitForFunction(() => window.__entitlementTest.state().progressReady)
  const release = async (value = response, status = responseStatus) => {
    response = value; responseStatus = status; held = false
    const routes = heldRequests; heldRequests = []
    await Promise.all(routes.map(respond))
  }
  const state = () => page.evaluate(() => window.__entitlementTest.state())
  const settled = async (status = 'ok') => page.waitForFunction(expected => window.__entitlementTest?.state().status === expected, status)
  const documentId = () => page.evaluate(() => window.__entitlementDocumentId)
  const noAds = () => assert.deepEqual(sdkRequests, [], 'Unresolved, failed, or entitled documents must not request SDKs')
  const safe = () => {
    assert.deepEqual(unexpected, [], 'Unexpected requests must be explicitly mocked or investigated')
    assert.deepEqual(routeErrors, [], 'SDK requests must suppress referrers')
    assert.deepEqual(pageErrors, [], 'Actual App must not raise browser exceptions')
    assert.ok(events.filter(e => e.kind === 'fetch').every(e => !e.hadSDK), 'No actual fetch may run in a document that has loaded an SDK')
    assert.ok(events.filter(e => e.kind === 'sdk-dom').every(e => !e.ownershipVisible && !e.privateInserted), 'SDK-bearing documents must never observe ownership or private DOM, even transiently')
  }
  const showSeparateChoices = async () => {
    // The combined consent UI keeps individual vendor controls collapsed. Open
    // its real details/settings button rather than bypassing any choice handler.
    const open = page.getByRole('button', { name: /^(รายละเอียด \/ เลือกแยก|ตั้งค่าการวัดผล)$/ })
    await open.click()
  }
  const grant = async vendor => {
    const choice = page.getByRole('button', { name: vendor === 'Meta' ? 'อนุญาต' : 'Google สถิติและวัดผลโฆษณา', exact: true })
    if (!await choice.isVisible()) await showSeparateChoices()
    await choice.click()
    await page.waitForFunction(name => window['__entitlementStub' + name] === true, vendor)
  }
  const replaceAfter = async action => {
    const old = await documentId(), index = events.length
    await action()
    await page.waitForFunction(id => window.__entitlementDocumentId !== id && !!window.__entitlementTest, old)
    await settled()
    assert.notEqual(await documentId(), old, 'Retirement must replace the actual browser document')
    const later = events.slice(index)
    assert.equal(later.filter(e => e.kind === 'fetch' && e.documentId === old).length, 0, 'Retiring document must issue no further fetch')
    const newDocument = later.findIndex(e => e.kind === 'document' && e.documentId !== old)
    const nextFetch = later.findIndex(e => e.kind === 'fetch')
    assert.ok(newDocument >= 0 && nextFetch > newDocument, 'Replacement document must exist before any next API fetch')
    safe()
    return old
  }
  return {
    context, page, events, sdkRequests, state, settled, documentId, noAds, safe, grant, showSeparateChoices, replaceAfter,
    apiCount: () => apiCount,
    heldCount: () => heldRequests.length,
    releaseOne: async (index, value, status = 200) => {
      const [route] = heldRequests.splice(index, 1)
      assert.ok(route, 'Requested synthetic response must still be pending')
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    },
    hold: () => { held = true }, release,
    setResponse: (value, status = 200) => { response = value; responseStatus = status },
    pauseNavigation: () => { retiringHeld = true },
    releaseNavigation: () => { retiringHeld = false; navigationRelease() },
    close: async () => { navigationRelease(); await release(); await context.close() },
  }
}

async function run(name, options, test) {
  const f = await fixture(options)
  try {
    await test(f)
    // Flush observer/binding delivery before assertions, without fetching data.
    await f.page.waitForTimeout(60)
    f.safe(); passed++; console.log('PASS ' + name)
  } catch (error) {
    console.error('FAIL ' + name + ' ' + JSON.stringify({
      state: await f.state().catch(() => null), sdkRequests: f.sdkRequests,
      events: f.events.slice(-16).map(({ documentId: _documentId, ...value }) => value),
    }))
    error.message = name + ': ' + error.message; throw error
  }
  finally { await f.close() }
}

try {
  await build({
    root: ROOT, configFile: false, envFile: false, envDir: temp,
    // Never load repository .env files or inject ambient VITE_* credentials.
    envPrefix: '__ENTITLEMENT_BOUNDARY_UNUSED_',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ad-boundary-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('public-test-placeholder'),
      'import.meta.env.VITE_POSTHOG_KEY': JSON.stringify(''),
      'import.meta.env.VITE_ENABLE_TRAINING_GOOGLE_TAGS': JSON.stringify('true'),
    },
    plugins: [
      { name: 'local-entitlement-test-controls', enforce: 'pre', transform(source, id) {
        if (id === join(ROOT, 'src/main.jsx')) return { code: source + TEST_CONTROLS, map: null }
      } },
      react(), tailwindcss(),
    ],
    logLevel: 'error',
    build: { outDir: dist, emptyOutDir: true, copyPublicDir: false, minify: false, sourcemap: false },
  })
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    // Routing also blocks fetch/XHR/scripts, while DNS denial prevents hidden
    // preconnect/speculative/background traffic from reaching a live hostname.
    args: ['--no-sandbox', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND'],
  })

  await run('pending initial lookup suppresses stored grants and stale loaders', { hold: true, savedGrants: true }, async f => {
    await f.page.waitForTimeout(100)
    assert.equal((await f.state()).status, 'loading')
    assert.equal(await f.page.getByRole('dialog').count(), 0)
    await f.page.evaluate(() => window.__entitlementTest.staleLoaders())
    f.noAds()
    await f.release(CLASS); await f.settled(); f.noAds()
  })

  await run('two failed lookups remain private, including later successful retry', { status: 503, savedGrants: true }, async f => {
    await f.settled('error'); f.noAds()
    assert.ok(f.apiCount() >= 2, 'Actual retry loop must execute')
    assert.equal(await f.page.getByRole('dialog').count(), 0)
    f.setResponse(EMPTY)
    await f.page.evaluate(() => window.__entitlementTest.refresh()); await f.settled()
    f.noAds()
    assert.equal(await f.page.getByRole('dialog').count(), 0, 'An error-observing document must remain private after recovery')
  })

  for (const [name, response] of [['class', CLASS], ['purchased bundle', BUNDLE]]) {
    await run(name + ' entitlement preserves ownership CTA without SDKs', { response, savedGrants: true }, async f => {
      await f.settled(); f.noAds()
      assert.equal(await f.page.locator('.course-hero-actions').getByRole('link', { name: 'เริ่มบทที่ 1', exact: true }).isVisible(), true)
      assert.equal(await f.page.locator('.course-hero-actions a[href="/buy"]').count(), 0)
      assert.equal((await f.state()).ownsBundle, true)
      assert.equal((await f.state()).cpr, response.cpr)
    })
  }

  await run('resolved current-key empty entitlement allows separate fresh Google and Meta grants', {}, async f => {
    await f.settled(); f.noAds()
    assert.equal((await f.state()).currentKey, true)
    await f.grant('Google'); assert.deepEqual(f.sdkRequests, ['Google'])
    await f.grant('Meta'); assert.deepEqual(f.sdkRequests, ['Google', 'Meta'])
    const history = f.events.filter(e => e.kind === 'historical-resource')
    assert.equal(history.length, 2, 'Each actual synthetic SDK must inspect historical resource URLs')
    assert.ok(history.every(event => event.count === 0), 'SDK must not see historical learnerId-bearing resource URLs')
    console.log('RESOURCE HISTORY CHECK ' + JSON.stringify(history.map(({ vendor, count }) => ({ vendor, count, timing: 'at SDK execution after empty entitlement resolution' }))))
    assert.equal(await f.page.locator('.course-hero-actions a[href="/buy"]').count(), 1)
  })

  await run('same-key refresh replaces an active SDK document before the next entitlement API', {}, async f => {
    await f.settled(); await f.grant('Google'); await f.grant('Meta')
    f.setResponse(BUNDLE)
    await f.replaceAfter(() => f.page.evaluate(() => { void window.__entitlementTest.refresh() }))
    assert.equal((await f.state()).ownsBundle, true)
    assert.equal(await f.page.locator('.course-hero-actions').getByRole('link', { name: 'เริ่มบทที่ 1', exact: true }).isVisible(), true)
    assert.deepEqual(f.sdkRequests, ['Google', 'Meta'])
  })

  await run('rapid ID-only learner changes replace active SDK document before ownership DOM or fetch', {}, async f => {
    await f.settled(); await f.grant('Google'); await f.grant('Meta')
    f.setResponse(CLASS)
    await f.replaceAfter(() => f.page.evaluate(() => {
      window.__entitlementTest.changeLearner('synthetic-learner-b')
      window.__entitlementTest.changeLearner('synthetic-learner-c')
    }))
    assert.equal((await f.state()).currentKey, true)
    assert.equal((await f.state()).ownsBundle, true)
    assert.deepEqual(f.sdkRequests, ['Google', 'Meta'])
  })

  await run('failure retry gap blocks stale consent handlers until resolved empty', { hold: true }, async f => {
    await f.release({}, 503)
    await f.page.evaluate(keys => {
      for (const key of Object.values(keys)) localStorage.setItem(key, key.includes('_google_') ? JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) : 'granted')
      window.__entitlementTest.staleLoaders()
    }, CONSENT)
    f.noAds()
    f.setResponse(EMPTY)
    await f.settled(); f.noAds()
    // UI state was never granted by the synthetic stale handler. Real choices
    // still need to run through the components after the lookup resolves.
    await f.grant('Google'); await f.grant('Meta')
  })

  await run('SDK appearing during retry backoff is retired before retry fetch', { hold: true }, async f => {
    await f.release({}, 503)
    f.setResponse(CLASS)
    // Adversarial test-only SDK insertion bypasses the correctly blocked loader
    // to prove the store rechecks protection on EVERY attempt, not just attempt 1.
    await f.page.evaluate(stub => {
      window.fbq = function (...args) { window.fbq.queue.push(args) }
      window.fbq.queue = []
      window.__firstaidMetaLoaded = true
      window.__firstaidMarketingLoaded = true
      // Run the synthetic observer immediately, avoiding an artificial race
      // between a network-delivered test script and the retry timeout itself.
      new Function(stub)()
    }, sdkStub('Meta'))
    await f.replaceAfter(async () => {})
    assert.equal((await f.state()).ownsBundle, true)
    assert.ok(f.events.some(event => event.kind === 'sdk-dom'), 'Adversarial synthetic SDK must actually execute')
    assert.deepEqual(f.sdkRequests, [], 'Adversarial SDK is local test execution, not a network SDK request')
  })

  await run('focus and resume events cannot fetch privately in an SDK document', {}, async f => {
    await f.settled(); await f.grant('Google')
    const old = await f.documentId()
    await f.page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await f.page.waitForTimeout(150)
    assert.equal(await f.documentId(), old, 'Current anonymous resume handlers do not invent an entitlement fetch')
    f.setResponse(CLASS)
    // Explicit refresh immediately after resumption still uses the same guard.
    await f.replaceAfter(() => f.page.evaluate(() => { void window.__entitlementTest.refresh() }))
  })

  await run('persisted pageshow retires cached SDK context before rechecking entitlements', {}, async f => {
    await f.settled(); await f.grant('Google'); await f.grant('Meta')
    f.setResponse(BUNDLE)
    // Chromium's actual BFCache admission is platform-dependent and routing may
    // disable it. Exercise the production handler with real PageTransitionEvent
    // instances; the document replacement and API ordering are actual browser IO.
    await f.replaceAfter(() => f.page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    }))
    assert.equal((await f.state()).ownsBundle, true)
    assert.ok(f.events.some(e => e.kind === 'pageshow' && e.persisted))
    assert.deepEqual(f.sdkRequests, ['Google', 'Meta'])
  })

  for (const response of [{ chapters: [2], cpr: false }, { chapters: [], cpr: true }]) {
    await run('partial chapter or CPR ownership stays private', { response, savedGrants: true }, async f => {
      await f.settled(); f.noAds()
      assert.equal(await f.page.getByRole('dialog').count(), 0)
      // Partial ownership is not a whole-course bundle and must not rewrite the
      // actual landing's existing bundle purchase CTA.
      assert.equal(await f.page.locator('.course-hero-actions a[href="/buy"]').count(), 1)
    })
  }

  await run('stale previous-learner response cannot open marketing while current lookup is pending', { hold: true, savedGrants: true }, async f => {
    await f.page.evaluate(() => window.__entitlementTest.changeLearner('synthetic-learner-b'))
    await until(() => f.heldCount() === 2, 'ID change must start the real new learner lookup')
    await f.releaseOne(0, EMPTY)
    await f.page.waitForTimeout(100)
    assert.equal((await f.state()).status, 'loading'); f.noAds()
    await f.release(CLASS); await f.settled()
    assert.equal((await f.state()).currentKey, true)
    assert.equal((await f.state()).ownsBundle, true); f.noAds()
  })

  await run('current empty result waits for older in-flight lookup before SDKs can start', { hold: true }, async f => {
    // Same-key overlap isolates the new active-request counter. An ID change
    // can independently and conservatively make the entire document private.
    await f.page.evaluate(() => { void window.__entitlementTest.refresh() })
    await until(() => f.heldCount() === 2, 'Both real entitlement requests must overlap')
    await f.releaseOne(1, EMPTY); await f.settled()
    assert.equal((await f.state()).currentKey, true)
    assert.equal(await f.page.getByRole('dialog').count(), 0, 'Older pending fetch must still suppress consent UI')
    await f.page.evaluate(keys => {
      for (const key of Object.values(keys)) localStorage.setItem(key, key.includes('_google_') ? JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) : 'granted')
      window.__entitlementTest.staleLoaders()
    }, CONSENT)
    f.noAds()
    await f.release(CLASS)
    await f.showSeparateChoices()
    await f.page.getByRole('dialog', { name: 'การวัดผล Google', exact: true }).waitFor()
    assert.equal((await f.state()).ownsBundle, false, 'Older ownership response must never replace current empty result')
    await f.grant('Google'); await f.grant('Meta')
  })

  await run('unavailable Resource Timing cleanup fails closed despite empty entitlement', { failTimingCleanup: true, savedGrants: true }, async f => {
    await f.settled(); f.noAds()
    assert.equal(await f.page.getByRole('dialog').count(), 0)
  })

  console.log(`All ${passed} network-blocked entitlement browser scenarios passed. Temporary build only; no live requests executed.`)
} finally {
  await browser?.close()
  await rm(temp, { recursive: true, force: true })
}
