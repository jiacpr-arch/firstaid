import test from 'node:test'
import assert from 'node:assert/strict'
import { matchCprProgress, phoneKey } from './cprProgress.js'

const A = '123e4567-e89b-42d3-a456-426614174aaa'
const B = '123e4567-e89b-42d3-a456-426614174bbb'

test('phoneKey normalizes Thai mobile formats to the last 9 digits', () => {
  assert.equal(phoneKey('081-234-5678'), '812345678')
  assert.equal(phoneKey('+66 81 234 5678'), '812345678')
  assert.equal(phoneKey('1234'), null)
  assert.equal(phoneKey(null), null)
})

test('matches CPR progress by phone and skips learners with no CPR activity', () => {
  const out = matchCprProgress({
    enrollments: [{ learner_id: A, phone: '0812345678' }, { learner_id: B, phone: '0899999999' }],
    redemptions: [{ phone_key: '812345678' }],
    students: [{ phone: '66812345678', status: 'กำลังเรียน', chapter_scores: { 1: 90, 2: 80, 3: 0 } }],
  })
  assert.deepEqual(out.get(A), { redeemed: true, modulesDone: 2, finalScore: null, completed: false })
  assert.equal(out.has(B), false)
})

test('keeps the most advanced row when a phone has several online_students rows', () => {
  const out = matchCprProgress({
    enrollments: [{ learner_id: A, phone: '0812345678' }],
    students: [
      { phone: '0812345678', status: 'กำลังเรียน', chapter_scores: { 1: 90 } },
      { phone: '0812345678', status: 'จบคอร์ส ✅', final_score: 92, completed_at: '2026-10-01T00:00:00Z', chapter_scores: {} },
    ],
  })
  assert.deepEqual(out.get(A), { redeemed: false, modulesDone: 0, finalScore: 92, completed: true })
})

test('learner without a usable phone is never matched', () => {
  const out = matchCprProgress({
    enrollments: [{ learner_id: A, phone: null }],
    redemptions: [{ phone_key: '812345678' }],
  })
  assert.equal(out.size, 0)
})
