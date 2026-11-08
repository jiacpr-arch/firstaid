import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { cleanLocalLearnerId } from './entitlements.js'

function fixture(tokenLearnerId = null, { missingAdmin = false, resolveError = false } = {}) {
  const source = readFileSync(new URL('../entitlements/index.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace('export default async function handler', 'async function handler')
  const calls = [], admin = {}, output = { headers: {}, setHeader(k,v) { this.headers[k]=v }, status(code) { this.code=code; return this }, json(body) { this.body=body; return this } }
  const handler = runInContext(source + '\nhandler', createContext({
    applyCors: () => false, rateLimited: () => false,
    getSupabaseAdmin: () => missingAdmin ? null : admin,
    learnerIdFromToken: async (_admin, req) => { assert.equal(_admin,admin); calls.push(['auth',req.headers?.authorization]); return tokenLearnerId },
    cleanLocalLearnerId,
    resolveEntitlements: async (_admin, params) => {
      assert.equal(_admin,admin); calls.push(['resolve',JSON.parse(JSON.stringify(params))])
      if(resolveError) throw Error('synthetic failure')
      return { chapters: tokenLearnerId ? [0] : [], cpr: !!tokenLearnerId }
    },
  }))
  return { output,calls, run: (method,input) => handler({method,headers:{authorization:'Bearer synthetic-not-real'},query:{learnerId:input},body:{learnerId:input}},output) }
}
test('read-only POST and existing GET have identical authentication, ID validation and results', async () => {
  for(const token of [null,'synthetic-user-123']) for(const input of [undefined,null,5,{},'invalid!','short','synthetic-user-123','synthetic-local-456']) {
    const get=fixture(token),post=fixture(token)
    await get.run('GET',input); await post.run('POST',input)
    assert.deepEqual(post.calls,get.calls)
    assert.deepEqual(JSON.parse(JSON.stringify(post.output.body)),JSON.parse(JSON.stringify(get.output.body)))
    assert.equal(post.output.code,get.output.code); assert.equal(post.output.headers['Cache-Control'],'no-store')
  }
})
test('POST retains failures, rate-independent method guard and no mutation operations', async () => {
  for(const options of [{missingAdmin:true},{resolveError:true}]) {
    const get=fixture(null,options),post=fixture(null,options)
    await get.run('GET','synthetic-local-456'); await post.run('POST','synthetic-local-456')
    assert.equal(post.output.code,500); assert.equal(post.output.code,get.output.code)
    assert.deepEqual(JSON.parse(JSON.stringify(post.output.body)),JSON.parse(JSON.stringify(get.output.body)))
  }
  const denied=fixture(); await denied.run('DELETE','synthetic-local-456')
  assert.equal(denied.output.code,405); assert.equal(denied.calls.length,0)
  const source=readFileSync(new URL('../entitlements/index.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/\.(insert|update|upsert|delete)\(/)
})
