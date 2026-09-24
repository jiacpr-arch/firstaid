import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordExamsAtHub } from './hubResults.js'

const attempt = { uuid: 'a1', kind: 'post', score: 90, correct: 18, total: 20, passed: true, finished_at: '2026-09-24T05:00:00Z' }

test('recordExamsAtHub sends each attempt to jia_results with the account id, attempt uuid and raw counts', async () => {
  const calls = []
  const admin = { async rpc(fn, args) { calls.push({ fn, args }); return { data: {}, error: null } } }
  const out = await recordExamsAtHub(admin, 'user-1', [attempt, { ...attempt, uuid: 'p1', kind: 'pre', correct: 7, total: 10 }])
  assert.deepEqual(out, { recorded: 2, failed: 0 })
  assert.equal(calls[0].fn, 'jia_results')
  assert.deepEqual(calls[0].args, {
    action: 'record',
    payload: { sourceClient: 'firstaid', userId: 'user-1', courseId: 'firstaid', kind: 'post', correct: 18, total: 20, attemptRef: 'a1', finishedAt: '2026-09-24T05:00:00Z' },
  })
  assert.equal(calls[1].args.payload.kind, 'pre')
  // the Hub computes score/pass itself: neither is sent
  assert.equal('score' in calls[0].args.payload, false)
  assert.equal('passed' in calls[0].args.payload, false)
})

test('recordExamsAtHub does nothing without an account or for malformed rows', async () => {
  const admin = { async rpc() { throw new Error('should not be called') } }
  assert.deepEqual(await recordExamsAtHub(admin, null, [attempt]), { recorded: 0, failed: 0 })
  assert.deepEqual(await recordExamsAtHub(admin, 'user-1', null), { recorded: 0, failed: 0 })
  assert.deepEqual(await recordExamsAtHub(admin, 'user-1', [{ ...attempt, uuid: '' }, { ...attempt, kind: 'quiz' }, { ...attempt, total: null }]), { recorded: 0, failed: 0 })
})

test('recordExamsAtHub never throws when the Hub refuses or is unreachable', async () => {
  const refusing = { async rpc() { return { data: null, error: { message: 'หลักสูตรนี้ยังไม่เปิดรับผลสอบกลาง' } } } }
  assert.deepEqual(await recordExamsAtHub(refusing, 'user-1', [attempt]), { recorded: 0, failed: 1 })
  const down = { async rpc() { throw new Error('fetch failed') } }
  assert.deepEqual(await recordExamsAtHub(down, 'user-1', [attempt, attempt]), { recorded: 0, failed: 2 })
})
