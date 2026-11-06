import test from 'node:test'
import assert from 'node:assert/strict'
import { createContext, runInContext } from 'node:vm'
import { CONSENT_KEY, TRAINING_PIXEL_ID, loadTrainingPixel, revokeTrainingPixel, trackLandingContact } from '../../src/lib/trainingAds.js'
import { GOOGLE_CONSENT_KEY, TRAINING_GA4_ID, loadTrainingGoogle, revokeTrainingGoogle, saveGoogleConsent, trackGoogleLandingContact } from '../../src/lib/trainingGoogleAds.js'
import { GOOGLE_SDK_STUB, META_SDK_STUB } from '../../scripts/ad-boundary-fixtures.mjs'

// Only local synthetic SDK code is executed. Prepared script elements are never
// fetched, and navigation is deliberately held so the retiring document lives.
function fixture() {
  const values = new Map([[CONSENT_KEY, 'granted'], [GOOGLE_CONSENT_KEY, 'granted']])
  const session = new Map(), scripts = [], records = [], navigation = []
  const storage = map => ({ getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) })
  const win = {
    __documentId: 'retiring-synthetic-document',
    location: Object.assign(new URL('https://firstaid.morroo.com/'), {
      assign: target => navigation.push(target), replace: target => navigation.push(target),
    }),
    history: { pushState() { assert.fail('Private navigation must not mutate history') }, replaceState() { assert.fail('Private navigation must not mutate history') } },
    localStorage: storage(values), sessionStorage: storage(session), addEventListener() {},
    MutationObserver: class { observe() {} },
    __recordAdBoundary: (kind, value) => records.push({ kind, value: JSON.parse(JSON.stringify(value)) }),
  }
  const doc = win.document = {
    referrer: '', cookie: '', createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => ({}),
  }
  win.window = win
  const context = createContext(win)
  const google = () => loadTrainingGoogle(win, doc, { enabled: true, publicLanding: true })
  const meta = () => loadTrainingPixel(win, doc, TRAINING_PIXEL_ID)
  const googleCalls = () => records.filter(r => r.kind === 'google').map(r => r.value.args)
  const metaCalls = () => records.filter(r => r.kind === 'call').map(r => r.value.args)
  return { win, doc, context, scripts, navigation, google, meta, googleCalls, metaCalls }
}
const googleDenial = ['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]

test('pending Google LINE conversion is discarded before a late SDK executes after withdrawal', () => {
  const f = fixture()
  assert.equal(f.google(), true)
  const capturedGtag = f.win.gtag
  assert.equal(trackGoogleLandingContact(f.win, f.doc), true)
  assert.ok(f.win.dataLayer.some(args => args[0] === 'event' && args[1] === 'conversion'))
  assert.equal(saveGoogleConsent(f.win, 'denied'), true)
  revokeTrainingGoogle(f.win, f.doc)
  const queue = f.win.dataLayer
  assert.deepEqual(queue.map(args => Array.from(args)), [googleDenial])
  capturedGtag('event', 'conversion', { send_to: 'synthetic' })
  capturedGtag('config', 'synthetic')
  capturedGtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted' })
  assert.deepEqual(queue.map(args => Array.from(args)), [googleDenial])
  runInContext(GOOGLE_SDK_STUB, f.context)
  assert.equal(f.win.__stubGoogleLoaded, true, 'The late SDK must actually execute')
  assert.deepEqual(f.googleCalls(), [googleDenial], 'No queued grant, config, pageview or conversion may replay')
  assert.equal(f.win[`ga-disable-${TRAINING_GA4_ID}`], true)
})

test('pending Meta LINE contact is discarded before a late SDK executes after withdrawal', () => {
  const f = fixture()
  f.meta()
  const capturedFbq = f.win.fbq
  assert.equal(trackLandingContact(f.win, f.doc), true)
  assert.ok(capturedFbq.queue.some(args => args.includes('Contact')))
  revokeTrainingPixel(f.win, f.doc)
  assert.deepEqual(capturedFbq.queue, [['consent', 'revoke']])
  capturedFbq('trackSingle', TRAINING_PIXEL_ID, 'Contact')
  capturedFbq('init', TRAINING_PIXEL_ID)
  capturedFbq('consent', 'grant')
  assert.deepEqual(capturedFbq.queue, [['consent', 'revoke']])
  runInContext(META_SDK_STUB, f.context)
  assert.equal(f.win.__stubSdkLoaded, true, 'The late SDK must actually execute')
  assert.deepEqual(f.metaCalls(), [['consent', 'revoke']])
})

test('private navigation discards both pending vendors before their late SDK execution', () => {
  const f = fixture()
  f.google(); f.meta()
  trackGoogleLandingContact(f.win, f.doc); trackLandingContact(f.win, f.doc)
  f.win.history.pushState(null, '', '/learn')
  assert.deepEqual(f.navigation, ['https://firstaid.morroo.com/learn'])
  assert.equal(f.win.location.pathname, '/', 'Retiring document keeps its public URL')
  runInContext(META_SDK_STUB, f.context)
  runInContext(GOOGLE_SDK_STUB, f.context)
  assert.equal(f.win.__stubSdkLoaded, true)
  assert.equal(f.win.__stubGoogleLoaded, true)
  assert.deepEqual(f.metaCalls(), [['consent', 'revoke']])
  assert.deepEqual(f.googleCalls(), [googleDenial])
})

test('Google revocation preserves the installed dataLayer array and push handler', () => {
  const f = fixture()
  f.google()
  runInContext(GOOGLE_SDK_STUB, f.context)
  const queue = f.win.dataLayer, push = queue.push, capturedGtag = f.win.gtag
  const before = f.googleCalls().length
  revokeTrainingGoogle(f.win, f.doc)
  assert.equal(f.win.dataLayer, queue)
  assert.equal(queue.push, push)
  assert.deepEqual(f.googleCalls().slice(before), [googleDenial], 'Running SDK receives the denial normally')
  capturedGtag('event', 'synthetic_late_event')
  capturedGtag('consent', 'update', { analytics_storage: 'granted' })
  assert.equal(f.googleCalls().length, before + 1)
})

test('Meta revocation does not clear an installed SDK queue or replace its callMethod', () => {
  const f = fixture()
  f.meta()
  runInContext(META_SDK_STUB, f.context)
  const fbq = f.win.fbq, queue = fbq.queue, callMethod = fbq.callMethod
  const sdkOwnedEntry = ['synthetic_sdk_owned_entry']
  queue.push(sdkOwnedEntry)
  const before = f.metaCalls().length
  revokeTrainingPixel(f.win, f.doc)
  assert.equal(fbq.queue, queue)
  assert.equal(fbq.callMethod, callMethod)
  assert.deepEqual(queue, [sdkOwnedEntry], 'Only a pending bootstrap queue may be cleared')
  assert.deepEqual(f.metaCalls().slice(before), [['consent', 'revoke']])
  fbq('trackSingle', TRAINING_PIXEL_ID, 'Contact')
  f.win._fbq('consent', 'grant')
  assert.equal(f.metaCalls().length, before + 1)
})

test('revocation does not create Google globals or clear a queue this integration did not load', () => {
  const f = fixture()
  revokeTrainingGoogle(f.win, f.doc)
  assert.equal(f.win.dataLayer, undefined)
  assert.equal(f.win.gtag, undefined)
  const foreignQueue = [['synthetic_foreign_entry']]
  f.win.dataLayer = foreignQueue
  revokeTrainingGoogle(f.win, f.doc)
  assert.deepEqual(foreignQueue, [['synthetic_foreign_entry']])
})

test('private-document and shared teardown flags block captured measurement commands', () => {
  for (const flag of ['__firstaidPrivateDocument', '__firstaidMarketingRevoked']) {
    const f = fixture()
    f.google(); f.meta()
    const googleLength = f.win.dataLayer.length, metaLength = f.win.fbq.queue.length
    f.win[flag] = true
    f.win.gtag('event', 'synthetic_late_event')
    f.win.fbq('trackSingle', TRAINING_PIXEL_ID, 'Contact')
    assert.equal(f.win.dataLayer.length, googleLength)
    assert.equal(f.win.fbq.queue.length, metaLength)
  }
})
