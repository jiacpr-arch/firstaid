import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { anonymousLanding, eligibleLanding, loadTrainingPixel, revokeTrainingPixel, readConsent, saveConsent, denialFallbackUrl, TRAINING_PIXEL_ID, CONSENT_KEY, installMarketingLifecycleGuard, canUseMarketingDocument, trackLandingContact } from '../../src/lib/trainingAds.js'
const landing = { hostname: 'firstaid.morroo.com', pathname: '/', search: '', hash: '' }
const loggedOut = { loading: false, session: null }
const progress = { loaded: true, loading: false, readLessonIds: new Set(), passedScenarioIds: new Set(), preTestDone: false, postTestDone: false }

test('only a clean production public landing is eligible', () => {
  assert.equal(eligibleLanding(landing), true)
  for (const patch of [{ hostname: 'localhost' }, { hostname: 'firstaid-eight.vercel.app' }, { pathname: '/admin' }, { pathname: '/post-test' }, { search: '?email=private@example.test' }, { hash: '#token' }]) assert.equal(eligibleLanding({ ...landing, ...patch }), false)
  assert.equal(eligibleLanding(landing, 'https://emr.morroo.com/patients/123'), false)
  assert.equal(eligibleLanding(landing, 'https://example.test/?token=private'), false)
})

test('identity and any learning progress block advertising', () => {
  assert.equal(anonymousLanding({ id: 'anonymous' }, progress, true, loggedOut), true)
  for (const key of ['name', 'phone', 'email', 'lineUserId', 'cohortCode', 'lineAdded', 'lineSkippedAt']) assert.equal(anonymousLanding({ [key]: 'private' }, progress, true, loggedOut), false)
  for (const patch of [{ loaded: false }, { loading: true }, { preTestDone: true }, { postTestDone: true }, { readLessonIds: new Set(['lesson']) }, { passedScenarioIds: new Set(['scenario']) }]) assert.equal(anonymousLanding({}, { ...progress, ...patch }, true, loggedOut), false)
})

test('one SDK, explicit consent, no automatic collection or user fields', () => {
  const scripts = [], win = {}, doc = { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } }
  loadTrainingPixel(win, doc, TRAINING_PIXEL_ID)
  loadTrainingPixel(win, doc, TRAINING_PIXEL_ID)
  assert.equal(scripts.length, 1)
  assert.deepEqual(win.fbq.queue, [['set', 'autoConfig', false, TRAINING_PIXEL_ID], ['consent', 'grant'], ['init', TRAINING_PIXEL_ID], ['trackSingle', TRAINING_PIXEL_ID, 'PageView']])
  revokeTrainingPixel(win, doc)
  assert.deepEqual(win.fbq.queue.at(-1), ['consent', 'revoke'])
})

test('private screens are not rendered until a fresh document is loaded', () => {
  const source = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /if \(leaveMarketingDocument\) return null/)
  assert.match(source, /window\.location\.replace\(window\.location\.href\)/)
  const landing = readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(landing, /fbqTrack\('track', 'Lead'/)
  assert.match(landing, /trackLandingContact\(window, document\)/)
})

test('only verified training ID is accepted and legacy grants cannot be reused', () => {
  assert.equal(TRAINING_PIXEL_ID, '1277103750989853')
  assert.equal(CONSENT_KEY, 'firstaid_jia_training_meta_consent_v2')
  const source = readFileSync(new URL('../../src/components/MetaPixel.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /import\.meta\.env\.VITE_META_PIXEL_ID/)
  const win = {}, doc = { createElement: () => ({}), head: { appendChild: () => assert.fail('must not load legacy SDK') } }
  loadTrainingPixel(win, doc, '1524889459310260')
  assert.equal(win.fbq, undefined)
})


test('withdrawal persists through local storage write failures and never trusts stale grants', () => {
  const values = new Map()
  const sessionStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  const win = { localStorage: { getItem: () => 'granted', setItem: () => { throw Error('blocked') } }, sessionStorage }
  assert.equal(saveConsent(win, 'denied'), true)
  assert.equal(readConsent(win), 'denied')
  assert.equal(saveConsent(win, 'granted'), false)
  assert.equal(readConsent(win), 'denied')
  win.sessionStorage = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } }
  assert.equal(saveConsent(win, 'denied'), false)
  const url = new URL(denialFallbackUrl({ href: 'https://firstaid.morroo.com/?utm_source=meta' }))
  assert.equal(url.searchParams.get('marketing_consent'), 'denied')
  assert.equal(eligibleLanding(url), false)
})


test('unresolved or authenticated session fails closed before any public landing grant', () => {
  assert.equal(anonymousLanding({}, progress, true), false)
  assert.equal(anonymousLanding({}, progress, true, { loading: true, session: null }), false)
  assert.equal(anonymousLanding({}, progress, true, { loading: false, session: { user: { id: 'synthetic' } } }), false)
  assert.equal(anonymousLanding({}, {}, true, loggedOut), false)
  assert.equal(anonymousLanding({}, progress, true, loggedOut), true)
})

test('cached documents revoke on hide and reload before reusing stale auth state', () => {
  const handlers = new Map(), calls = []
  let reloads = 0
  const win = { __firstaidMarketingLoaded: true, fbq: (...args) => calls.push(args), location: { reload: () => reloads++ }, addEventListener: (k,v) => handlers.set(k,v), removeEventListener: k => handlers.delete(k) }
  const dispose = installMarketingLifecycleGuard(win, {})
  handlers.get('pagehide')()
  assert.equal(win.__firstaidMarketingRevoked, true)
  assert.deepEqual(calls, [['consent','revoke']])
  handlers.get('pageshow')({ persisted: false })
  assert.equal(reloads, 0)
  handlers.get('pageshow')({ persisted: true })
  assert.equal(reloads, 1)
  dispose()
  assert.equal(handlers.size, 0)
})


test('an unreadable or uncleared session denial cannot be interpreted as consent', () => {
  const localStorage = { getItem: () => 'granted', setItem: () => {} }
  const win = { localStorage, sessionStorage: { getItem: () => { throw Error('unreadable') }, removeItem: () => { throw Error('blocked') } } }
  assert.equal(readConsent(win), null)
  assert.equal(saveConsent(win, 'granted'), false)
  win.sessionStorage = { getItem: () => null, removeItem: () => { throw Error('blocked') } }
  assert.equal(saveConsent(win, 'granted'), false)
})


test('private documents cannot become marketing documents through SPA return navigation', () => {
  const win = {}
  const context = { urlEligible: true, anonymous: false, auth: { loading: true, session: null }, progress: { loaded: false } }
  assert.equal(canUseMarketingDocument(win, context), false)
  assert.equal(win.__firstaidPrivateDocument, undefined, 'pending startup is not a private visit')
  Object.assign(context, { anonymous: true, auth: loggedOut, progress })
  assert.equal(canUseMarketingDocument(win, context), true)
  assert.equal(canUseMarketingDocument(win, { ...context, urlEligible: false }), false)
  assert.equal(canUseMarketingDocument(win, context), false, 'returning to landing keeps the document locked')
  const doc = { createElement: () => assert.fail('private document cannot load SDK') }
  loadTrainingPixel(win, doc, TRAINING_PIXEL_ID)
  assert.equal(win.fbq, undefined)
  const authenticated = {}
  assert.equal(canUseMarketingDocument(authenticated, { ...context, auth: { loading: false, session: {} } }), false)
  assert.equal(canUseMarketingDocument(authenticated, context), false)
})


test('only consented public LINE intent reaches the verified training dataset', () => {
  const calls = [], win = { __firstaidMarketingLoaded: true, location: landing, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => 'granted' }, fbq: (...args) => calls.push(args) }
  const doc = { referrer: '' }
  assert.equal(trackLandingContact(win, doc), true)
  assert.deepEqual(calls, [['trackSingle', TRAINING_PIXEL_ID, 'Contact', { content_name: 'cpr_aed_inperson_course', source: 'firstaid_landing', channel: 'line' }]])
  for (const patch of [{ __firstaidMarketingRevoked: true }, { __firstaidPrivateDocument: true }, { __firstaidMarketingLoaded: false }, { location: { ...landing, pathname: '/learn' } }, { localStorage: { getItem: () => 'denied' } }]) {
    assert.equal(trackLandingContact({ ...win, ...patch }, doc), false)
  }
  assert.equal(calls.length, 1)
})
