import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkHubIdentityLinked } from './hubIdentity.js'

test('checkHubIdentityLinked returns true and reports the right RPC call when the Hub knows this LINE user', async () => {
  let call
  const admin = { rpc(fn, args) { call = { fn, args }; return Promise.resolve({ data: { linked: true, userId: 'hub-1' } }) } }
  const linked = await checkHubIdentityLinked(admin, 'U123')
  assert.equal(linked, true)
  assert.equal(call.fn, 'jia_line_hub')
  assert.equal(call.args.action, 'identity')
  assert.deepEqual(call.args.payload, { lineUserId: 'U123' })
})

test('checkHubIdentityLinked returns false when the Hub has no account for this LINE user', async () => {
  const admin = { rpc() { return Promise.resolve({ data: { linked: false } }) } }
  assert.equal(await checkHubIdentityLinked(admin, 'U999'), false)
})

test('checkHubIdentityLinked never throws — a broken/unreachable RPC is treated as "not linked"', async () => {
  const admin = { rpc() { return Promise.reject(new Error('network down')) } }
  assert.equal(await checkHubIdentityLinked(admin, 'U1'), false)
})

test('checkHubIdentityLinked tolerates a malformed response shape', async () => {
  const admin = { rpc() { return Promise.resolve({ data: null }) } }
  assert.equal(await checkHubIdentityLinked(admin, 'U1'), false)
})
