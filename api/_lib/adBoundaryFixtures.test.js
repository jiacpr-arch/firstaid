import test from 'node:test'
import assert from 'node:assert/strict'
import { createContext, runInContext } from 'node:vm'
import { GOOGLE_SDK_STUB, META_SDK_STUB } from '../../scripts/ad-boundary-fixtures.mjs'
import { installMarketingNavigationBoundary } from '../../src/lib/trainingNavigation.js'

// Execute only our synthetic fixtures. No browser, third-party SDK or network.
function fixture() {
  const records = [], handlers = {}, navigation = [], nativeHistory = []
  const win = {
    __documentId: 'synthetic-document',
    __firstaidMarketingLoaded: true,
    __firstaidGoogleLoaded: true,
    location: Object.assign(new URL('https://firstaid.morroo.com/'), {
      assign: target => navigation.push(['assign', target]),
      replace: target => navigation.push(['replace', target]),
    }),
    history: {}, dataLayer: [['event', 'page_view', { send_to: 'synthetic' }]],
    fbq: { queue: [['trackSingle', 'synthetic', 'PageView']] },
    __recordAdBoundary: (kind, value) => records.push({ kind, value: JSON.parse(JSON.stringify(value)) }),
    addEventListener: (name, callback) => { handlers['window:' + name] = callback },
    MutationObserver: class { observe() {} },
  }
  for (const method of ['pushState', 'replaceState']) {
    win.history[method] = (...args) => {
      nativeHistory.push([method, ...args])
      if (args[2] != null) win.location.href = new URL(args[2], win.location.href).href
    }
  }
  const doc = win.document = {
    referrer: '', head: {}, querySelectorAll: () => [], querySelector: () => null,
    getElementById: () => ({}), addEventListener: (name, callback) => { handlers['document:' + name] = callback },
  }
  win.window = win
  return { win, doc, records, handlers, navigation, nativeHistory, context: createContext(win) }
}

for (const [name, scripts] of [
  ['Meta then Google', [META_SDK_STUB, GOOGLE_SDK_STUB]],
  ['Google then Meta', [GOOGLE_SDK_STUB, META_SDK_STUB]],
]) {
  test(`mock SDKs share a document without lexical collisions: ${name}`, () => {
    const f = fixture()
    for (const source of scripts) runInContext(source, f.context)
    assert.equal(f.win.__stubSdkLoaded, true)
    assert.equal(f.win.__stubGoogleLoaded, true)
    assert.equal(f.records.filter(r => r.kind === 'call').length, 1)
    assert.equal(f.records.filter(r => r.kind === 'google').length, 1)
    f.win.fbq.callMethod('consent', 'revoke')
    f.win.dataLayer.push(['consent', 'update', { analytics_storage: 'denied' }])
    assert.equal(f.records.filter(r => r.kind === 'call').length, 2)
    assert.equal(f.records.filter(r => r.kind === 'google').length, 2)
  })
}

test('mock SDK variables remain private even with same-named globals and repeated script execution', () => {
  const f = fixture()
  runInContext('const record = "existing"; const queued = "existing"; const observe = "existing";', f.context)
  for (const source of [META_SDK_STUB, GOOGLE_SDK_STUB, META_SDK_STUB, GOOGLE_SDK_STUB]) runInContext(source, f.context)
  assert.equal(f.win.__stubSdkLoaded, true)
  assert.equal(f.win.__stubGoogleLoaded, true)
  assert.equal(runInContext('record', f.context), 'existing')
})

for (const method of ['pushState', 'replaceState']) {
  test(`later SDK ${method} wrapper can read the target while actual document location stays public`, () => {
    const f = fixture()
    installMarketingNavigationBoundary(f.win, f.doc, () => {})
    runInContext(GOOGLE_SDK_STUB, f.context)
    const path = '/auth/line/callback?code=synthetic'
    f.win.history[method](null, '', path)
    const argumentsSeen = f.records.filter(r => r.kind === 'googleHistoryArgument')
    assert.deepEqual(argumentsSeen.map(r => r.value), [{ documentId: 'synthetic-document', method, target: path }])
    assert.equal(f.win.location.href, 'https://firstaid.morroo.com/')
    assert.equal(f.nativeHistory.length, 0)
    assert.ok(f.records.filter(r => r.kind === 'googleObservation').every(r => r.value.url === 'https://firstaid.morroo.com/'))
    assert.deepEqual(f.navigation, [[method === 'pushState' ? 'assign' : 'replace', new URL(path, f.win.location.href).href]])
  })
}

test('captured public links never pass destination arguments through a later SDK history wrapper', () => {
  for (const path of ['/learn', '/learn/1', '/learn#chapter-1', '/schedule', '/game', '/call']) {
    const f = fixture()
    installMarketingNavigationBoundary(f.win, f.doc, () => {})
    runInContext(GOOGLE_SDK_STUB, f.context)
    let prevented = false, stopped = false
    const href = new URL(path, f.win.location.href).href
    f.handlers['document:click']({
      button: 0, target: { closest: () => ({ href, hasAttribute: () => false }) },
      preventDefault: () => { prevented = true }, stopImmediatePropagation: () => { stopped = true },
    })
    assert.equal(prevented, true)
    assert.equal(stopped, true)
    assert.deepEqual(f.records.filter(r => r.kind === 'googleHistoryArgument'), [])
    assert.deepEqual(f.navigation, [['assign', href]])
    assert.equal(f.win.location.href, 'https://firstaid.morroo.com/')
  }
})
