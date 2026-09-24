import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileLearner, learnerIdFromToken, isLearnerIdBound, authFromToken } from './authLearner.js'

test('reconcileLearner: authenticated learner wins over body when they match', () => {
  assert.deepEqual(reconcileLearner('L1', 'L1'), { learnerId: 'L1', forbidden: false })
})

test('reconcileLearner: a token learner overrides an absent body learnerId', () => {
  assert.deepEqual(reconcileLearner(undefined, 'L1'), { learnerId: 'L1', forbidden: false })
})

test('reconcileLearner: mismatch between body and token is forbidden (cross-account)', () => {
  assert.deepEqual(reconcileLearner('victim', 'attacker'), { learnerId: null, forbidden: true })
})

test('reconcileLearner: anonymous (no token) falls back to the body learnerId', () => {
  assert.deepEqual(reconcileLearner('L2', null), { learnerId: 'L2', forbidden: false })
  assert.deepEqual(reconcileLearner(undefined, null), { learnerId: null, forbidden: false })
})

test('learnerIdFromToken returns null when there is no bearer token', async () => {
  const admin = { auth: { getUser() { throw new Error('should not be called') } } }
  assert.equal(await learnerIdFromToken(admin, { headers: {} }), null)
})

test('learnerIdFromToken maps a valid token to its line_identities learner_id', async () => {
  const admin = {
    auth: { async getUser(t) { return t === 'good' ? { data: { user: { id: 'auth-1' } } } : { error: 'bad' } } },
    from() {
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: { learner_id: 'learner-9' } } },
      }
    },
  }
  assert.equal(await learnerIdFromToken(admin, { headers: { authorization: 'Bearer good' } }), 'learner-9')
})

test('learnerIdFromToken returns null for an invalid token', async () => {
  const admin = { auth: { async getUser() { return { error: 'invalid' } } } }
  assert.equal(await learnerIdFromToken(admin, { headers: { authorization: 'Bearer bad' } }), null)
})

test('learnerIdFromToken falls back to jia_firstaid_hub_learner when line_identities has no mapping (Hub SSO, email-only adopt)', async () => {
  let rpcArgs
  const admin = {
    auth: { async getUser(t) { return t === 'good' ? { data: { user: { id: 'auth-2' } } } : { error: 'bad' } } },
    from() {
      return {
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: null } },
      }
    },
    async rpc(fn, args) { rpcArgs = { fn, args }; return { data: { learnerId: 'learner-hub-1' } } },
  }
  assert.equal(await learnerIdFromToken(admin, { headers: { authorization: 'Bearer good' } }), 'learner-hub-1')
  assert.equal(rpcArgs.fn, 'jia_firstaid_hub_learner')
  assert.deepEqual(rpcArgs.args, { payload: { userId: 'auth-2' } })
})

test('learnerIdFromToken returns null when neither line_identities nor the Hub resolver has a mapping', async () => {
  const admin = {
    auth: { async getUser() { return { data: { user: { id: 'auth-3' } } } } },
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } } } },
    async rpc() { return { data: { learnerId: null } } },
  }
  assert.equal(await learnerIdFromToken(admin, { headers: { authorization: 'Bearer good' } }), null)
})

test('learnerIdFromToken tolerates the Hub resolver failing (never throws)', async () => {
  const admin = {
    auth: { async getUser() { return { data: { user: { id: 'auth-4' } } } } },
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } } } },
    async rpc() { throw new Error('network down') },
  }
  assert.equal(await learnerIdFromToken(admin, { headers: { authorization: 'Bearer good' } }), null)
})

test('isLearnerIdBound: true when line_identities already has this learnerId', async () => {
  const admin = {
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: { learner_id: 'L1' } } } } },
    async rpc() { throw new Error('should not be called — line_identities already answered') },
  }
  assert.equal(await isLearnerIdBound(admin, 'L1'), true)
})

test('isLearnerIdBound: falls back to jia_firstaid_hub_learner when line_identities has no row', async () => {
  let rpcArgs
  const admin = {
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } } } },
    async rpc(fn, args) { rpcArgs = { fn, args }; return { data: { bound: true } } },
  }
  assert.equal(await isLearnerIdBound(admin, 'L2'), true)
  assert.equal(rpcArgs.fn, 'jia_firstaid_hub_learner')
  assert.deepEqual(rpcArgs.args, { payload: { learnerId: 'L2' } })
})

test('isLearnerIdBound: false when neither source has this learnerId', async () => {
  const admin = {
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } } } },
    async rpc() { return { data: { bound: false } } },
  }
  assert.equal(await isLearnerIdBound(admin, 'L3'), false)
})

test('isLearnerIdBound: fails safe (false) if the Hub resolver call throws', async () => {
  const admin = {
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: null } } } },
    async rpc() { throw new Error('network down') },
  }
  assert.equal(await isLearnerIdBound(admin, 'L4'), false)
})

test('authFromToken returns the account id alongside the learner (line_identities, Hub fallback, unlinked)', async () => {
  const admin = (lineRow, hub) => ({
    auth: { async getUser(t) { return t === 'good' ? { data: { user: { id: 'auth-7' } } } : { error: 'bad' } } },
    from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: lineRow } } } },
    async rpc() { if (hub instanceof Error) throw hub; return { data: hub } },
  })
  const req = { headers: { authorization: 'Bearer good' } }
  assert.deepEqual(await authFromToken(admin({ learner_id: 'L-line' }, null), req), { userId: 'auth-7', learnerId: 'L-line' })
  assert.deepEqual(await authFromToken(admin(null, { learnerId: 'L-hub' }), req), { userId: 'auth-7', learnerId: 'L-hub' })
  assert.deepEqual(await authFromToken(admin(null, { learnerId: null }), req), { userId: 'auth-7', learnerId: null })
  assert.deepEqual(await authFromToken(admin(null, new Error('rpc down')), req), { userId: 'auth-7', learnerId: null })
  assert.equal(await authFromToken(admin(null, null), { headers: { authorization: 'Bearer bad' } }), null)
  assert.equal(await authFromToken(admin(null, null), { headers: {} }), null)
})
