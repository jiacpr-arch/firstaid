import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { beginEntitlementLookup, finishEntitlementLookup, entitlementAllowsMarketing, entitlementLookupPending, setEntitlementLookupReady, prepareMarketingResourceTimings } from '../../src/lib/entitlementMarketingBoundary.js'
import { loadTrainingPixel, TRAINING_PIXEL_ID } from '../../src/lib/trainingAds.js'

const empty = () => ({ status: 'ok', loading: false, key: '|synthetic-id', chapters: new Set(), cpr: false })
test('only resolved current empty entitlements permit advertising; no ID is published', () => {
  const win = {}, ready = empty()
  assert.equal(entitlementAllowsMarketing(win, ready, ready.key), true)
  for (const patch of [{ status: 'idle' }, { status: 'loading', loading: true }, { key: '|other-id' }]) {
    assert.equal(entitlementAllowsMarketing({}, { ...ready, ...patch }, ready.key), false)
  }
  for (const patch of [{ status: 'error' }, { chapters: new Set([0]) }, { chapters: new Set([2]) }, { cpr: true }]) {
    const privateWin = {}
    assert.equal(entitlementAllowsMarketing(privateWin, { ...ready, ...patch }, ready.key), false)
    assert.equal(privateWin.__firstaidPrivateDocument, true)
    assert.equal(entitlementAllowsMarketing(privateWin, ready, ready.key), false)
  }
  assert.equal(JSON.stringify(win).includes('synthetic-id'), false)
})
test('pending lookup synchronously blocks stale SDK handlers; private transitions retire active documents', () => {
  const win = {}, ready = empty(), scripts = []
  assert.equal(beginEntitlementLookup(win, () => assert.fail('no SDK to retire')), true)
  assert.equal(entitlementLookupPending(win), true)
  loadTrainingPixel(win, { createElement: () => ({}), head: { appendChild: s => scripts.push(s) } }, TRAINING_PIXEL_ID)
  assert.equal(scripts.length, 0)
  assert.equal(entitlementAllowsMarketing(win, ready, ready.key), false)
  finishEntitlementLookup(win)
  setEntitlementLookupReady(win, true)
  assert.equal(entitlementAllowsMarketing(win, ready, ready.key), true)
  for (const patch of [{ loading: true }, { key: '|new-id' }, { status: 'error' }, { chapters: new Set([0]) }]) {
    const active = { __firstaidMarketingLoaded: true }
    assert.equal(entitlementAllowsMarketing(active, { ...ready, ...patch }, ready.key), false)
    assert.equal(active.__firstaidPrivateDocument, true)
  }
})
function fixture({ learner = { id: 'synthetic-id' }, response = { chapters: [], cpr: false }, active = false, retryActivatesSdk = false, fetchImpl, waitImpl } = {}) {
  let state, currentLearner = learner, notifications = 0
  const calls = [], win = { __firstaidMarketingLoaded: active, location: { href: 'https://firstaid.morroo.com/', replace: () => calls.push('replace') } }
  const source = readFileSync(new URL('../../src/stores/entitlementStore.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replaceAll('export ', '')
  const context = createContext({
    window: win, document: {}, Set,
    create: factory => { state = factory(patch => { state = { ...state, ...patch }; notifications++ }); return { getState: () => state } },
    useLearnerStore: { getState: () => ({ learner: currentLearner }) },
    beginEntitlementLookup, finishEntitlementLookup, setEntitlementLookupReady,
    revokeTrainingMarketing: () => calls.push('revoke'),
    fetch: async (url, options) => {
      assert.equal(url, '/api/entitlements'); assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store')
      assert.equal(JSON.parse(options.body).learnerId, currentLearner?.id)
      calls.push('fetch'); return fetchImpl ? fetchImpl() : { ok: response !== null, json: async () => response }
    },
    setTimeout: callback => { if (retryActivatesSdk) win.__firstaidMarketingLoaded = true; if (waitImpl) waitImpl(callback); else callback() },
  })
  const store = runInContext(source + '\nuseEntitlementStore', context)
  return { win, calls, get notifications() { return notifications }, get state() { return store.getState() }, refresh: session => store.getState().refresh(session), setLearner: value => { currentLearner = value } }
}
test('actual store stops same-key and changed-ID fetches before retiring a loaded SDK document', async () => {
  for (const learner of [{ id: 'synthetic-id' }, { id: 'changed-id' }]) {
    const f = fixture({ learner, active: true })
    await f.refresh(null)
    assert.deepEqual(f.calls, ['revoke', 'replace'])
    assert.equal(f.win.__firstaidPrivateDocument, true)
    assert.equal(entitlementLookupPending(f.win), true)
  }
})
test('actual retry checks boundary again before second request', async () => {
  const f = fixture({ response: null, retryActivatesSdk: true })
  await f.refresh(null)
  assert.deepEqual(f.calls, ['fetch', 'revoke', 'replace'])
})
test('actual store preserves private ownership and error results, and no-ID path clears stale state without fetch', async () => {
  const f = fixture({ response: { chapters: [0], cpr: true } })
  await f.refresh(null)
  assert.deepEqual([...f.state.chapters], [0]); assert.equal(f.state.cpr, true)
  assert.equal(entitlementLookupPending(f.win), true)
  f.setLearner(null); await f.refresh(null)
  assert.equal(f.calls.filter(x => x === 'fetch').length, 1)
  assert.equal(f.state.chapters.size, 0); assert.equal(f.state.cpr, false); assert.equal(f.state.key, '|')
  const failed = fixture({ response: null }); await failed.refresh(null)
  assert.equal(failed.state.status, 'error'); assert.equal(entitlementLookupPending(failed.win), true)
  for (const response of [{}, { chapters: [], cpr: null }, { chapters: ['0'], cpr: false }]) {
    const malformed = fixture({ response }); await malformed.refresh(null)
    assert.equal(malformed.state.status, 'error'); assert.equal(entitlementLookupPending(malformed.win), true)
  }
  const publicResult = fixture(); await publicResult.refresh(null)
  assert.equal(publicResult.state.status, 'ok'); assert.equal(entitlementLookupPending(publicResult.win), false)
})

test('Resource Timing cleanup verifies removal and fails closed on errors or unavailable APIs', () => {
  assert.equal(prepareMarketingResourceTimings({}), false)
  let entries = [{ name: 'https://firstaid.morroo.com/api/entitlements?learnerId=synthetic-id' }]
  const win = { performance: { clearResourceTimings: () => { entries = [] }, getEntriesByType: () => entries } }
  assert.equal(prepareMarketingResourceTimings(win), true); assert.equal(entries.length, 0)
  for (const performance of [{}, { clearResourceTimings() {}, getEntriesByType: () => [{}] }, { clearResourceTimings() { throw Error('synthetic') }, getEntriesByType: () => [] }]) {
    assert.equal(prepareMarketingResourceTimings({ performance }), false)
  }
  beginEntitlementLookup(win, () => {})
  assert.equal(prepareMarketingResourceTimings(win), false)
  finishEntitlementLookup(win); setEntitlementLookupReady(win, true)
  assert.equal(prepareMarketingResourceTimings(win), true)
})
test('older overlapping requests keep startup blocked until every attempt settles', () => {
  const win = {}, ready = empty()
  beginEntitlementLookup(win, () => {}); beginEntitlementLookup(win, () => {})
  finishEntitlementLookup(win); setEntitlementLookupReady(win, true)
  assert.equal(entitlementAllowsMarketing(win, ready, ready.key), false)
  finishEntitlementLookup(win)
  assert.equal(entitlementAllowsMarketing(win, ready, ready.key), true)
})

test('failed older attempt wakes readiness after its delay without retrying a superseded lookup', async () => {
  let count = 0, releaseDelay
  const f = fixture({
    fetchImpl: async () => ({ ok: ++count > 1, json: async () => ({ chapters: [], cpr: false }) }),
    waitImpl: callback => { releaseDelay = callback },
  })
  const older = f.refresh(null)
  while (!releaseDelay) await Promise.resolve()
  await f.refresh(null)
  assert.equal(entitlementLookupPending(f.win), true)
  const notifications = f.notifications
  releaseDelay(); await older
  assert.equal(entitlementLookupPending(f.win), false)
  assert.ok(f.notifications > notifications, 'App must rerender after the older attempt settles')
  assert.equal(f.calls.filter(x => x === 'fetch').length, 2)
  assert.equal(entitlementAllowsMarketing(f.win, f.state, '|synthetic-id'), true)
})
