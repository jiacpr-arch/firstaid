import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONSENT_KEY, loadTrainingPixel, revokeTrainingPixel, TRAINING_PIXEL_ID, installMarketingLifecycleGuard, trackLandingContact } from '../../src/lib/trainingAds.js'
import { GOOGLE_CONSENT_KEY, GOOGLE_COOKIE_PREFIX, GOOGLE_PUBLIC_PAGE, TRAINING_GA4_ID, TRAINING_GOOGLE_ADS_ID, TRAINING_GOOGLE_LINE_CONVERSION, loadTrainingGoogle, readGoogleConsent, saveGoogleConsent, revokeTrainingGoogle, trackGoogleLandingContact } from '../../src/lib/trainingGoogleAds.js'
import { installMarketingConsentStorageGuard, revokeTrainingMarketing } from '../../src/lib/trainingMarketing.js'

function fixture(storage = {}) {
  const local = new Map(Object.entries(storage)), session = new Map(), scripts = [], cookies = [], handlers = {}, nativeHistory = [], navigation = []
  const store = map => ({ getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) })
  const location = new URL('https://firstaid.morroo.com/?utm_source=google&gclid=synthetic_click_id')
  location.assign = href => navigation.push(['assign', href])
  location.replace = href => navigation.push(['replace', href])
  location.reload = () => navigation.push(['reload'])
  const win = {
    performance: { clearResourceTimings() {}, getEntriesByType: () => [] },
    location, localStorage: store(local), sessionStorage: store(session),
    history: { pushState: (...args) => nativeHistory.push(['push', ...args]), replaceState: (...args) => nativeHistory.push(['replace', ...args]) },
    addEventListener: (name, fn) => { handlers[name] = fn }, removeEventListener: name => { delete handlers[name] },
  }
  const doc = {
    referrer: '', createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
    addEventListener: (name, fn) => { handlers['document:' + name] = fn },
    get cookie() { return `${GOOGLE_COOKIE_PREFIX}_ga=synthetic; _ga=unrelated; ${GOOGLE_COOKIE_PREFIX}_gcl_aw=synthetic` },
    set cookie(value) { cookies.push(value) },
  }
  const load = options => loadTrainingGoogle(win, doc, { enabled: true, publicLanding: true, ...options })
  const calls = () => (win.dataLayer || []).map(args => Array.from(args))
  return { win, doc, load, scripts, cookies, calls, handlers, nativeHistory, navigation }
}

test('Google requires its own fresh consent and public context before creating any SDK globals', () => {
  for (const saved of [{}, { [CONSENT_KEY]: 'granted' }, { firstaid_marketing_consent_v1: 'granted' }, { [GOOGLE_CONSENT_KEY]: 'denied' }]) {
    const f = fixture(saved)
    assert.equal(f.load(), false)
    assert.equal(f.win.gtag, undefined)
    assert.equal(f.win.dataLayer, undefined)
    assert.equal(f.scripts.length, 0)
  }
  for (const options of [{ enabled: false }, { publicLanding: false }]) {
    const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
    assert.equal(f.load(options), false)
    assert.equal(f.scripts.length, 0)
  }
})

test('Google queues one clean explicit pageview, no matching, no automatic pageviews or cross-domain linking', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  assert.equal(f.load(), true)
  assert.equal(f.load(), false)
  assert.equal(f.scripts.length, 1)
  assert.equal(f.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${TRAINING_GA4_ID}`)
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer')
  const calls = f.calls()
  assert.deepEqual(calls[0], ['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
  assert.deepEqual(calls.find(c => c[0] === 'set' && c[1] === 'linker'), ['set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false }])
  for (const id of [TRAINING_GA4_ID, TRAINING_GOOGLE_ADS_ID]) {
    const config = calls.find(c => c[0] === 'config' && c[1] === id)[2]
    assert.equal(config.send_page_view, false)
    assert.equal(config.user_data, null)
    assert.equal(config.cookie_domain, 'firstaid.morroo.com')
    assert.equal(config.cookie_prefix, GOOGLE_COOKIE_PREFIX)
    assert.equal(config.allow_ad_personalization_signals, false)
    assert.equal(config.page_location, GOOGLE_PUBLIC_PAGE.page_location + '?gclid=synthetic_click_id')
    assert.equal(config.page_referrer, '')
    if (id === TRAINING_GA4_ID) assert.equal(config.allow_google_signals, false)
    else assert.equal(config.allow_enhanced_conversions, false)
  }
  assert.deepEqual(calls.filter(c => c[0] === 'event'), [['event', 'page_view', { ...GOOGLE_PUBLIC_PAGE, page_location: GOOGLE_PUBLIC_PAGE.page_location + '?gclid=synthetic_click_id', user_data: null, send_to: TRAINING_GA4_ID }]])
  assert.deepEqual(calls.find(c => c[0] === 'set' && c[1] === 'user_data'), ['set', 'user_data', null])
  assert.doesNotMatch(JSON.stringify(calls), /utm_source|"user_id"|email|phone|transaction_id|value|currency/)
})

test('Google and Meta grants, declines and SDK initialization remain independent', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  revokeTrainingPixel(f.win, f.doc)
  assert.equal(f.load(), true, 'Meta denial does not deny Google')
  assert.equal(f.win.fbq, undefined)
  assert.equal(trackLandingContact(f.win, f.doc), false)
  f.win.__firstaidMetaRevoked = false
  loadTrainingPixel(f.win, f.doc, TRAINING_PIXEL_ID)
  assert.equal(f.scripts.length, 2, 'Google loaded marker does not prevent Meta loading')
  const g = fixture({ [CONSENT_KEY]: 'granted' })
  revokeTrainingGoogle(g.win, g.doc)
  loadTrainingPixel(g.win, g.doc, TRAINING_PIXEL_ID)
  assert.equal(g.scripts.length, 1, 'Google denial does not deny Meta')
  assert.equal(g.win.gtag, undefined)
})

test('private, unsafe, revoked and unknown queue contexts fail closed', () => {
  const patches = [
    { __firstaidPrivateDocument: true }, { __firstaidGoogleRevoked: true }, { __firstaidMarketingRevoked: true },
    { gtag: () => {} }, { dataLayer: [] },
    ...['/learn', '/admin', '/auth/line/callback', '/?email=test@example.invalid', '/#token', '/?_gl=synthetic'].map(path => ({ location: new URL(path, GOOGLE_PUBLIC_PAGE.page_location) })),
  ]
  for (const patch of patches) {
    const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
    Object.assign(f.win, patch)
    assert.equal(f.load(), false)
    assert.equal(f.scripts.length, 0)
  }
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.doc.referrer = 'https://firstaid.morroo.com/learn/private'
  assert.equal(f.load(), false)
})

test('public LINE click emits static contact intent and the verified contact conversion only', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  assert.equal(trackGoogleLandingContact(f.win, f.doc), false)
  f.load()
  assert.equal(trackGoogleLandingContact(f.win, f.doc), true)
  const events = f.calls().filter(c => c[0] === 'event')
  assert.deepEqual(events.map(c => [c[1], c[2].send_to]), [['page_view', TRAINING_GA4_ID], ['contact', TRAINING_GA4_ID], ['conversion', TRAINING_GOOGLE_LINE_CONVERSION]])
  assert.deepEqual(Object.keys(events[2][2]).sort(), ['channel', 'content_name', 'page_location', 'page_referrer', 'page_title', 'send_to', 'source', 'user_data'])
  assert.ok(events.every(c => c[2].user_data === null))
  revokeTrainingGoogle(f.win, f.doc)
  assert.equal(trackGoogleLandingContact(f.win, f.doc), false)
  const source = readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8')
  assert.match(source, /function trackLineLead\(\) \{[\s\S]*?trackGoogleLandingContact\(window, document\)/)
  assert.match(source, /href="tel:1669" className="course-emergency"/)
  assert.doesNotMatch(source, /href="tel:1669"[^>]*onClick/)
})

test('Google withdrawal blocks collection and only clears its prefixed cookies', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.load()
  revokeTrainingGoogle(f.win, f.doc)
  assert.equal(f.win[`ga-disable-${TRAINING_GA4_ID}`], true)
  assert.equal(f.win.__firstaidGoogleRevoked, true)
  assert.equal(f.win.__firstaidMarketingRevoked, undefined, 'Vendor denial is not a shared denial')
  assert.ok(f.cookies.length > 0)
  assert.ok(f.cookies.every(cookie => /^firstaid_(?:attribution_v2|training|analytics|purchase)_/.test(cookie)))
  assert.equal(f.load(), false)
  assert.deepEqual(f.calls().at(-1), ['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
})

test('Google storage failures never convert old grants or failed writes into consent', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.win.localStorage.setItem = () => { throw Error('blocked') }
  assert.equal(saveGoogleConsent(f.win, 'denied'), true)
  assert.equal(readGoogleConsent(f.win), 'denied')
  assert.equal(saveGoogleConsent(f.win, 'ads', f.doc), false)
  assert.equal(f.load(), false)
  f.win.sessionStorage.getItem = () => { throw Error('blocked') }
  assert.equal(readGoogleConsent(f.win), null)
  assert.equal(f.load(), false)
  const g = fixture()
  g.win.sessionStorage.removeItem = () => { throw Error('blocked') }
  assert.equal(saveGoogleConsent(g.win, 'ads', g.doc), false)
  assert.equal(saveGoogleConsent(g.win, 'invalid'), false)
})

test('SDK-bearing SPA navigation becomes a full document navigation before URL mutation', () => {
  for (const method of ['pushState', 'replaceState']) {
    const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
    f.load()
    const before = f.win.location.href
    f.win.history[method]({}, '', '/auth/line/callback?code=synthetic')
    assert.equal(f.win.location.href, before, 'Old document keeps its public URL')
    assert.equal(f.nativeHistory.length, 0, 'No native SPA mutation reaches an SDK observer')
    assert.deepEqual(f.navigation, [[method === 'pushState' ? 'assign' : 'replace', 'https://firstaid.morroo.com/auth/line/callback?code=synthetic']])
    assert.equal(f.win.__firstaidPrivateDocument, true)
    assert.equal(f.win.__firstaidMarketingRevoked, true)
  }
})

test('private link clicks stop before React or later SDK listeners and never become SPA routes', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.load()
  let prevented = 0, stopped = 0
  f.handlers['document:click']({ button: 0, target: { closest: () => ({ href: 'https://firstaid.morroo.com/learn', hasAttribute: () => false }) }, preventDefault: () => prevented++, stopImmediatePropagation: () => stopped++ })
  assert.equal(prevented, 1)
  assert.equal(stopped, 1)
  assert.deepEqual(f.navigation, [['assign', 'https://firstaid.morroo.com/learn']])
})

test('all-vendor pagehide revokes both and cached pages reload before reuse', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.load()
  loadTrainingPixel(f.win, f.doc, TRAINING_PIXEL_ID)
  installMarketingLifecycleGuard(f.win, f.doc, revokeTrainingMarketing)
  f.handlers.pagehide()
  assert.equal(f.win.__firstaidMetaRevoked, true)
  assert.equal(f.win.__firstaidGoogleRevoked, true)
  assert.equal(f.win.__firstaidMarketingRevoked, true)
  f.handlers.pageshow({ persisted: true })
  assert.deepEqual(f.navigation, [['reload']])
})


test('cross-tab Google withdrawal reloads the whole document but grants never auto-load', () => {
  const f = fixture({ [GOOGLE_CONSENT_KEY]: JSON.stringify({version:2,mode:'ads',issuedAt:Date.now(),expiresAt:Date.now()+86400000}) })
  f.load()
  const cleanup = installMarketingConsentStorageGuard(f.win, f.doc)
  f.handlers.storage({ key: CONSENT_KEY })
  assert.equal(f.navigation.length, 0)
  f.win.localStorage.setItem(GOOGLE_CONSENT_KEY, 'denied')
  f.handlers.storage({ key: GOOGLE_CONSENT_KEY })
  assert.equal(f.win.__firstaidMarketingRevoked, true)
  assert.deepEqual(f.navigation, [['reload']])
  cleanup()
  assert.equal(f.handlers.storage, undefined)
  const g = fixture()
  installMarketingConsentStorageGuard(g.win, g.doc)
  g.win.localStorage.setItem(GOOGLE_CONSENT_KEY, 'granted')
  g.handlers.storage({ key: GOOGLE_CONSENT_KEY })
  assert.equal(g.scripts.length, 0)
})

test('analytics-only grant isolates identity and never configures Ads or contact conversion', () => {
  const now=Date.now(), f=fixture({[GOOGLE_CONSENT_KEY]:JSON.stringify({version:2,mode:'analytics',issuedAt:now,expiresAt:now+86400000})})
  assert.equal(f.load(),true)
  const calls=f.calls()
  assert.equal(calls.some(c=>c[0]==='config' && c[1]===TRAINING_GOOGLE_ADS_ID),false)
  assert.equal(calls.find(c=>c[0]==='config')[2].cookie_prefix,'firstaid_analytics')
  assert.equal(calls.find(c=>c[0]==='config')[2].cookie_update,false)
  assert.deepEqual(calls.find(c=>c[0]==='consent' && c[1]==='update')[2],{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})
  trackGoogleLandingContact(f.win,f.doc)
  assert.equal(f.calls().some(c=>c[0]==='event' && c[1]==='conversion'),false)
})

test('a different grant instance from another tab retires the existing loaded SDK', () => {
  const now=Date.now(), f=fixture({[GOOGLE_CONSENT_KEY]:JSON.stringify({version:2,mode:'ads',issuedAt:now-1000,expiresAt:now-1000+86400000})})
  assert.equal(f.load(),true)
  installMarketingConsentStorageGuard(f.win,f.doc)
  f.win.localStorage.setItem(GOOGLE_CONSENT_KEY,JSON.stringify({version:2,mode:'analytics',issuedAt:now,expiresAt:now+86400000}))
  f.handlers.storage({key:GOOGLE_CONSENT_KEY})
  assert.deepEqual(f.navigation,[['reload']])
  assert.equal(f.win.__firstaidGoogleRevoked,true)
})

test('only ads consent sends validated case-preserved Google click IDs in canonical location', () => {
  for (const mode of ['ads', 'analytics']) {
    for (const key of ['gclid', 'gbraid', 'wbraid']) {
      const f = fixture()
      saveGoogleConsent(f.win, mode, f.doc)
      f.win.location.search = '?' + key + '=Case_Sensitive123&utm_source=google&fbclid=Other_Click123'
      assert.equal(f.load(), true)
      trackGoogleLandingContact(f.win, f.doc)
      const locations = f.calls().flatMap(c => c.filter(x => x?.page_location).map(x => x.page_location))
      assert.ok(locations.length > 2)
      assert.ok(locations.every(url => url === GOOGLE_PUBLIC_PAGE.page_location + (mode === 'ads' ? '?' + key + '=Case_Sensitive123' : '')))
    }
  }
})

test('ambiguous, numeric, unknown and private click contexts never create Google SDK', () => {
  for (const search of ['?gclid=Valid_Click123&gclid=Another_Click123', '?gclid=1234567890',
    '?gbraid=1234567890', '?wbraid=1234567890', '?gclid=bad', '?gclid=Valid_Click123&email=a%40b.com']) {
    const f = fixture()
    saveGoogleConsent(f.win, 'ads', f.doc)
    f.win.location.search = search
    assert.equal(f.load(), false)
    assert.equal(f.scripts.length, 0)
  }
})

test('rechecks public context and grant after resource preparation and before configuration', () => {
  for (const mutate of [
    f => { f.win.location.pathname = '/learn' },
    f => { f.doc.referrer = 'https://firstaid.morroo.com/learn' },
    f => { f.win.localStorage.removeItem(GOOGLE_CONSENT_KEY) },
  ]) {
    const f = fixture()
    saveGoogleConsent(f.win, 'ads', f.doc)
    f.win.performance.clearResourceTimings = () => mutate(f)
    assert.equal(f.load(), false)
    assert.equal(f.win.dataLayer, undefined)
    assert.equal(f.scripts.length, 0)
  }
})
