import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { anonymousLanding, eligibleLanding, loadTrainingPixel, revokeTrainingPixel } from '../../src/lib/trainingAds.js'
const landing = { hostname: 'firstaid.morroo.com', pathname: '/', search: '', hash: '' }
const progress = { loaded: true, loading: false, readLessonIds: new Set(), passedScenarioIds: new Set(), preTestDone: false, postTestDone: false }

test('only a clean production public landing is eligible', () => {
  assert.equal(eligibleLanding(landing), true)
  for (const patch of [{ hostname: 'localhost' }, { hostname: 'firstaid-eight.vercel.app' }, { pathname: '/admin' }, { pathname: '/post-test' }, { search: '?email=private@example.test' }, { hash: '#token' }]) assert.equal(eligibleLanding({ ...landing, ...patch }), false)
  assert.equal(eligibleLanding(landing, 'https://emr.morroo.com/patients/123'), false)
  assert.equal(eligibleLanding(landing, 'https://example.test/?token=private'), false)
})

test('identity and any learning progress block advertising', () => {
  assert.equal(anonymousLanding({ id: 'anonymous' }, progress, true), true)
  for (const key of ['name', 'phone', 'email', 'lineUserId', 'cohortCode', 'lineAdded', 'lineSkippedAt']) assert.equal(anonymousLanding({ [key]: 'private' }, progress, true), false)
  for (const patch of [{ loaded: false }, { loading: true }, { preTestDone: true }, { postTestDone: true }, { readLessonIds: new Set(['lesson']) }, { passedScenarioIds: new Set(['scenario']) }]) assert.equal(anonymousLanding({}, { ...progress, ...patch }, true), false)
})

test('one SDK, explicit consent, no automatic collection or user fields', () => {
  const scripts = [], win = {}, doc = { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } }
  loadTrainingPixel(win, doc, '1524889459310260')
  loadTrainingPixel(win, doc, '1524889459310260')
  assert.equal(scripts.length, 1)
  assert.deepEqual(win.fbq.queue, [['set', 'autoConfig', false, '1524889459310260'], ['consent', 'grant'], ['init', '1524889459310260'], ['trackSingle', '1524889459310260', 'PageView']])
  revokeTrainingPixel(win, doc)
  assert.deepEqual(win.fbq.queue.at(-1), ['consent', 'revoke'])
})

test('private screens are not rendered until a fresh document is loaded', () => {
  const source = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /if \(leaveMarketingDocument\) return null/)
  assert.match(source, /window\.location\.replace\(window\.location\.href\)/)
  const landing = readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(landing, /fbqTrack\('track', 'Lead'/)
  assert.match(landing, /fbqTrack\('track', 'Contact'/)
})

test('unverified legacy dataset stays disabled even when its env variable exists', () => {
  const source = readFileSync(new URL('../../src/components/MetaPixel.jsx', import.meta.url), 'utf8')
  assert.match(source, /const VERIFIED_META_PIXEL_ID = ''/)
  assert.match(source, /import\.meta\.env\.VITE_META_PIXEL_ID === VERIFIED_META_PIXEL_ID/)
})
