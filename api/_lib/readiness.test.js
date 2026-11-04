import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyReadiness, summarizeReadiness } from './readiness.js'

const opts = { totalLessons: 24 }

test('passing the post-test means ready, with nothing missing', () => {
  const r = classifyReadiness({ lessonsRead: 10, postTest: { score: 80, passed: true } }, opts)
  assert.deepEqual(r, { status: 'ready', missing: [] })
})

test('a learner with no activity is not started', () => {
  const r = classifyReadiness({ lessonsRead: 0, quizzesPassed: 0, preTest: null, postTest: null }, opts)
  assert.equal(r.status, 'not_started')
  assert.deepEqual(r.missing, ['ยังไม่ได้อ่าน 24 บทเรียน', 'ยังไม่ได้ทำ Post-test'])
})

test('partial progress is in progress and lists what is left', () => {
  const r = classifyReadiness({ lessonsRead: 10, quizzesPassed: 8, postTest: null }, opts)
  assert.equal(r.status, 'in_progress')
  assert.deepEqual(r.missing, ['ยังไม่ได้อ่าน 14 บทเรียน', 'ยังไม่ได้ทำ Post-test'])
})

test('all lessons read but post-test not passed is almost ready', () => {
  const r = classifyReadiness({ lessonsRead: 24, postTest: { score: 55, passed: false } }, opts)
  assert.equal(r.status, 'almost')
  assert.deepEqual(r.missing, ['Post-test ยังไม่ผ่าน (ดีที่สุด 55%)'])
})

test('only a pre-test counts as having started', () => {
  assert.equal(classifyReadiness({ lessonsRead: 0, preTest: { score: 30, passed: false } }, opts).status, 'in_progress')
})

test('summary counts each status', () => {
  const s = summarizeReadiness([
    { lessonsRead: 1, postTest: { score: 90, passed: true } },
    { lessonsRead: 24, postTest: null },
    { lessonsRead: 5 },
    { lessonsRead: 0 },
    { lessonsRead: 0 },
  ], opts)
  assert.deepEqual(s, { total: 5, ready: 1, almost: 1, in_progress: 1, not_started: 2 })
})

test('CPR class: post-test passed but CPR online not finished is not ready', () => {
  const o = { totalLessons: 24, requireCpr: true }
  const none = classifyReadiness({ lessonsRead: 24, postTest: { score: 90, passed: true }, cpr: null }, o)
  assert.equal(none.status, 'almost')
  assert.deepEqual(none.missing, ['ยังไม่ได้เรียน CPR & AED ออนไลน์'])
  const partial = classifyReadiness({ lessonsRead: 24, postTest: { score: 90, passed: true }, cpr: { modulesDone: 3, completed: false } }, o)
  assert.deepEqual(partial.missing, ['CPR & AED ออนไลน์ยังไม่จบ (3/7 บท)'])
  const done = classifyReadiness({ lessonsRead: 24, postTest: { score: 90, passed: true }, cpr: { modulesDone: 7, completed: true } }, o)
  assert.deepEqual(done, { status: 'ready', missing: [] })
})

test('CPR requirement is off for normal classes', () => {
  const r = classifyReadiness({ lessonsRead: 24, postTest: { score: 90, passed: true }, cpr: null }, { totalLessons: 24 })
  assert.equal(r.status, 'ready')
})
