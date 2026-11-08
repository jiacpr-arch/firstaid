import test from 'node:test'
import assert from 'node:assert/strict'
import { GOOGLE_CONSENT_KEY, ATTRIBUTION_TTL, readGoogleGrant, saveGoogleChoice, remainingGoogleSeconds, installGoogleExpiryGuard, retainGoogleAttribution, googleCookieFlags } from '../../public/google-attribution.js'
import { safeMarketingQuery } from '../../src/lib/trainingAds.js'
function fixture() {
  const local = new Map(), session = new Map(), handlers = {}, timers = [], cookies = []
  const storage = m => ({ getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) })
  const win = { localStorage: storage(local), sessionStorage: storage(session), Event, dispatchEvent: e => handlers[e.type]?.(e), addEventListener: (k,f) => { handlers[k]=f }, removeEventListener: k => { delete handlers[k] }, setTimeout: (f,ms) => { timers.push({f,ms}); return timers.length }, clearTimeout() {} }
  const doc = { get cookie() { return 'firstaid_attribution_v2_ga=synthetic; unrelated=value' }, set cookie(v) { cookies.push(v) } }
  return {win,doc,local,session,handlers,timers,cookies}
}
test('legacy, malformed, expired, future and rolled grants cannot authorize advertising', () => {
  const f=fixture(), now=Date.now()
  for (const value of ['granted',JSON.stringify({version:1,mode:'ads',issuedAt:now,expiresAt:now+ATTRIBUTION_TTL}),JSON.stringify({version:2,mode:'ads',issuedAt:now-ATTRIBUTION_TTL,expiresAt:now}),JSON.stringify({version:2,mode:'ads',issuedAt:now+1,expiresAt:now+1+ATTRIBUTION_TTL}),JSON.stringify({version:2,mode:'ads',issuedAt:now,expiresAt:now+ATTRIBUTION_TTL+1})]) {
    f.local.set(GOOGLE_CONSENT_KEY,value);assert.equal(readGoogleGrant(f.win,now),null)
  }
  assert.equal(saveGoogleChoice(f.win,f.doc,'ads',now),true)
  assert.equal(readGoogleGrant(f.win,now).mode,'ads')
  assert.equal(remainingGoogleSeconds(f.win,now+60000),86338)
  assert.equal(readGoogleGrant(f.win,now+ATTRIBUTION_TTL),null)
})
test('ordinary retirement preserves only qualified new namespace without extending grant', () => {
  const f=fixture(), now=Date.now()
  saveGoogleChoice(f.win,f.doc,'ads',now);const original=f.local.get(GOOGLE_CONSENT_KEY);f.cookies.length=0
  assert.equal(retainGoogleAttribution(f.win,f.doc,now+60000),true)
  assert.equal(f.local.get(GOOGLE_CONSENT_KEY),original)
  assert.equal(f.cookies.some(x=>x.startsWith('firstaid_attribution_v2_ga=')),false,'Retirement must not copy cookies across domains')
  assert.ok(f.cookies.every(x=>!x.startsWith('unrelated=')))
  saveGoogleChoice(f.win,f.doc,'denied',now)
  assert.equal(retainGoogleAttribution(f.win,f.doc,now),false)
})
test('same-tab first grant arms expiry after guard starts without a grant', () => {
  const f=fixture();let expired=0
  const dispose=installGoogleExpiryGuard(f.win,f.doc,()=>expired++)
  assert.equal(expired,1);assert.equal(f.timers.length,0)
  saveGoogleChoice(f.win,f.doc,'ads')
  assert.equal(f.timers.length,1);assert.ok(f.timers[0].ms<=ATTRIBUTION_TTL+1)
  f.local.set(GOOGLE_CONSENT_KEY,'denied');f.timers[0].f()
  assert.equal(expired,2);assert.ok(f.cookies.some(x=>x.startsWith('firstaid_attribution_v2_ga=; Max-Age=0')))
  dispose();assert.equal(f.handlers['firstaid-google-consent-change'],undefined)
})
test('storage restrictions fail closed and session withdrawal wins', () => {
  const f=fixture();saveGoogleChoice(f.win,f.doc,'ads');f.session.set(GOOGLE_CONSENT_KEY+'_denied','1');assert.equal(readGoogleGrant(f.win),null)
  f.win.sessionStorage.getItem=()=>{throw Error('restricted')};assert.equal(readGoogleGrant(f.win),null)
})
test('bounded documented click query supports Google formats and rejects unsafe values', () => {
  assert.equal(safeMarketingQuery('?gclid=synthetic_click&gbraid=synthetic_braid&wbraid=synthetic_wbraid&gclsrc=aw.ds&gad_source=1&gad_campaignid=1234567890'),true)
  for(const q of ['?gclid=synthetic&gclid=duplicate','?gbraid=email%40example.com','?gclsrc=unknown','?gad_source=123','?gad_campaignid=email','?unknown=x','?gclid='+ 'x'.repeat(257),'?utm_campaign=0812345678']) assert.equal(safeMarketingQuery(q),false,q)
})

test('supported cookie flags contain only secure attributes and immutable absolute deadline', () => {
  const deadline=Date.now()+86400000
  assert.equal(googleCookieFlags(deadline),'SameSite=Lax;Secure;Expires='+new Date(deadline).toUTCString())
  assert.equal(googleCookieFlags(Date.now()-1),null)
  assert.equal(googleCookieFlags('unsafe'),null)
})

test('opaque click allowlist rejects numeric phone-like values for every vendor key', () => {
  for (const key of ['gclid','gbraid','wbraid','fbclid']) {
    assert.equal(safeMarketingQuery('?'+key+'=0812345678'),false,key)
    assert.equal(safeMarketingQuery('?'+key+'=66812345678'),false,key)
    assert.equal(safeMarketingQuery('?'+key+'=synthetic_click_123'),true,key)
  }
})
