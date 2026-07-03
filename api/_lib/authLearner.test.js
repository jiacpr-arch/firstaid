import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileLearner, learnerIdFromToken } from './authLearner.js'

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
