import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOpenAIConsentChoice, OPENAI_CONSENT_KEY, OPENAI_IMAGE_URL, eligibleOpenAIDocument, loadTrainingOpenAI, readOpenAIConsent, saveOpenAIConsent, revokeTrainingOpenAI } from '../../src/lib/trainingOpenAIAds.js'
import { installMarketingConsentStorageGuard } from '../../src/lib/trainingMarketing.js'
import { installMarketingLifecycleGuard } from '../../src/lib/trainingAds.js'
import { revokeTrainingMarketing } from '../../src/lib/trainingMarketing.js'
function storage() {
  const values = new Map()
  return { get length() { return values.size }, key: i => [...values.keys()][i], getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }
}
function fixture() {
  const images = [], listeners = {}
  const win = { location: { hostname: 'firstaid.morroo.com', pathname: '/', search: '', hash: '', href: 'https://firstaid.morroo.com/', origin: 'https://firstaid.morroo.com', reload() { win.reloads++ }, assign(href) { win.assigned=href }, replace(href) { win.assigned=href } }, reloads: 0, localStorage: storage(), sessionStorage: storage(), navigator: {}, history: { pushState() {}, replaceState() {} }, addEventListener: (k,fn) => { (listeners[k] ||= []).push(fn) }, removeEventListener() {} }
  const doc = { referrer: '', cookie: '', body: { appendChild: x => images.push(x) }, addEventListener() {}, createElement(tag) { assert.equal(tag,'img'); return { style:{}, removeAttribute(k) { delete this[k] }, remove() { this.removed=true } } } }
  return {win,doc,images,dispatch: (key,event={}) => listeners[key]?.forEach(fn=>fn(event))}
}
const load = f => loadTrainingOpenAI(f.win,f.doc,{publicLanding:true})
test('no image before own fresh grant; other vendors never grant OpenAI', () => {
  const f=fixture()
  for(const key of ['firstaid_jia_training_meta_consent_v2','firstaid_jia_training_google_consent_v1']) f.win.localStorage.setItem(key,'granted')
  assert.equal(load(f),false); assert.equal(readOpenAIConsent(f.win),null); assert.equal(f.images.length,0)
  assert.equal(saveOpenAIConsent(f.win,'granted'),true); assert.equal(load(f),true); assert.equal(load(f),false)
  const image=f.images[0]
  assert.equal(image.src,OPENAI_IMAGE_URL);assert.equal(image.referrerPolicy,'origin');assert.equal(image.style.display,'none')
  assert.equal(image.width,1);assert.equal(image.height,1);assert.equal(image.alt,'')
  assert.deepEqual([...new URL(image.src).searchParams], [['pid','QGaBG3DEsN1QQ4mvnw3Jdu'],['event','page_viewed'],['data[type]','contents']])
  assert.equal(f.win.oaiq,undefined);assert.equal(f.win.gtag,undefined);assert.equal(f.win.fbq,undefined)
})
test('unresolved/private/auth/unsafe document or storage failures fail closed', () => {
  const mutations=[f=>f.win.location.search='?oppref=opaque',f=>f.win.location.search='?email=private',f=>f.win.location.hash='#private',f=>f.win.location.pathname='/learn',f=>f.doc.referrer='https://firstaid.morroo.com/learn/1',f=>f.win.__firstaidPrivateDocument=true,f=>f.win.__firstaidMarketingRevoked=true,f=>f.win.navigator.webdriver=true,f=>f.win.localStorage.setItem('sb-test-auth-token','secret'),f=>f.win.localStorage.getItem=()=>{throw Error()},f=>f.win.sessionStorage.getItem=()=>{throw Error()}]
  for(const mutate of mutations) { const f=fixture();saveOpenAIConsent(f.win,'granted');mutate(f);assert.equal(load(f),false);assert.equal(f.images.length,0) }
  const f=fixture();saveOpenAIConsent(f.win,'granted');assert.equal(loadTrainingOpenAI(f.win,f.doc),false)
})
test('query never enters image URL; denial and partial-grant rollback survive', () => {
  const f=fixture();f.win.location.search='?utm_source=google&gclid=abcdefgh';saveOpenAIConsent(f.win,'granted');assert.equal(load(f),true);assert.equal(f.images[0].src,OPENAI_IMAGE_URL)
  f.win.localStorage.setItem=()=>{throw Error()};assert.equal(saveOpenAIConsent(f.win,'denied'),true);assert.equal(readOpenAIConsent(f.win),'denied')
  const g=fixture();g.win.sessionStorage.removeItem=()=>{throw Error()};assert.equal(saveOpenAIConsent(g.win,'granted'),false);assert.notEqual(readOpenAIConsent(g.win),'granted');assert.equal(load(g),false)
})
test('private navigation tears down before history mutation, and revoke never retries', () => {
  const f=fixture();saveOpenAIConsent(f.win,'granted');load(f);f.win.history.pushState(null,'','/learn')
  assert.equal(f.win.assigned,'https://firstaid.morroo.com/learn');assert.equal(f.win.__firstaidPrivateDocument,true);assert.equal(f.win.__firstaidOpenAIRevoked,true);assert.equal(f.images[0].src,undefined);assert.equal(load(f),false)
})
test('cross-tab withdrawal and bfcache restore terminate loaded document', () => {
  const f=fixture();installMarketingConsentStorageGuard(f.win,f.doc);saveOpenAIConsent(f.win,'granted');load(f);f.win.localStorage.setItem(OPENAI_CONSENT_KEY,'denied');f.dispatch('storage',{key:OPENAI_CONSENT_KEY});assert.equal(f.win.reloads,1);assert.equal(f.images[0].removed,true)
  const g=fixture();installMarketingLifecycleGuard(g.win,g.doc,revokeTrainingMarketing);saveOpenAIConsent(g.win,'granted');load(g);g.dispatch('pagehide');g.dispatch('pageshow',{persisted:true});assert.equal(g.win.reloads,1);assert.equal(load(g),false)
})
test('image failure is non-blocking and never retried', () => {
  const f=fixture();saveOpenAIConsent(f.win,'granted');f.doc.body.appendChild=()=>{throw Error()};assert.equal(load(f),false);assert.equal(load(f),false);revokeTrainingOpenAI(f.win);assert.equal(eligibleOpenAIDocument(f.win,f.doc,true),false)
})

test('OpenAI rejects HTTP, nonstandard ports and an existing SDK integration', () => {
  for (const origin of ['http://firstaid.morroo.com', 'https://firstaid.morroo.com:8443']) {
    const f=fixture();saveOpenAIConsent(f.win,'granted');f.win.location.origin=origin
    assert.equal(eligibleOpenAIDocument(f.win,f.doc,true),false);assert.equal(load(f),false);assert.equal(f.images.length,0)
  }
  const f=fixture();saveOpenAIConsent(f.win,'granted');f.win.oaiq=()=>{}
  assert.equal(load(f),false);assert.equal(f.images.length,0)
})


import { loadTrainingGoogle, saveGoogleConsent } from '../../src/lib/trainingGoogleAds.js'
import { installMarketingNavigationBoundary } from '../../src/lib/trainingNavigation.js'
for (const order of ['google-first', 'openai-first']) {
  test(`mixed-vendor teardown retains every callback: ${order}`, () => {
    const f=fixture(), images=f.images
    const create=f.doc.createElement
    f.doc.createElement=tag=>tag==='script'?{}:create(tag)
    f.doc.head={appendChild() {}}
    let assigns=0
    f.win.location.assign=href=>{assigns++;f.win.assigned=href}
    saveOpenAIConsent(f.win,'granted');saveGoogleConsent(f.win,'granted')
    const google=()=>loadTrainingGoogle(f.win,f.doc,{publicLanding:true})
    if (order==='google-first') { assert.equal(google(),true);assert.equal(load(f),true) }
    else { assert.equal(load(f),true);assert.equal(google(),true) }
    f.win.history.pushState(null,'','/learn')
    assert.equal(assigns,1);assert.equal(f.win.assigned,'https://firstaid.morroo.com/learn')
    for(const key of ['__firstaidMarketingRevoked','__firstaidMetaRevoked','__firstaidGoogleRevoked','__firstaidOpenAIRevoked']) assert.equal(f.win[key],true,key)
    assert.equal(images[0].removed,true);assert.equal(images[0].src,undefined)
  })
}
test('a failing navigation revoker cannot prevent other cleanup or full navigation', () => {
  const f=fixture();let cleanup=0,assigns=0
  installMarketingNavigationBoundary(f.win,f.doc,()=>{throw Error('vendor failure')})
  const later=()=>{cleanup++}
  installMarketingNavigationBoundary(f.win,f.doc,later)
  installMarketingNavigationBoundary(f.win,f.doc,later)
  f.win.__firstaidMarketingLoaded=true;f.win.location.assign=()=>{assigns++}
  f.win.history.pushState(null,'','/learn')
  assert.equal(cleanup,1);assert.equal(assigns,1)
})

test('partial grant plus failed rollback revokes and selects no-ads fallback before reload', () => {
  const f=fixture();let wroteGrant=false
  const set=f.win.localStorage.setItem
  f.win.localStorage.setItem=(key,value)=>{
    if (wroteGrant) throw Error('all later local writes fail')
    set(key,value);wroteGrant=true
  }
  f.win.sessionStorage.removeItem=()=>{throw Error('session denial cannot be removed')}
  f.win.sessionStorage.setItem=()=>{throw Error('all session writes fail')}
  assert.equal(applyOpenAIConsentChoice(f.win,'granted'),'denied')
  assert.equal(f.win.localStorage.getItem(OPENAI_CONSENT_KEY),'granted','reproduce the stale grant')
  assert.equal(f.win.__firstaidOpenAIRevoked,true)
  assert.equal(new URL(f.win.assigned).searchParams.get('marketing_consent'),'denied')
  assert.equal(load(f),false);assert.equal(f.images.length,0)
  // A fresh document has no revoked global, but its fallback URL stays excluded.
  delete f.win.__firstaidOpenAIRevoked
  f.win.location.search=new URL(f.win.assigned).search
  assert.equal(load(f),false)
})
