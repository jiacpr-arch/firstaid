import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCohortReport } from './cohortReport.js'

const learners = [
  { learnerId: 'a', name: 'A', lessonsRead: 2, quizzesPassed: 2, preTest: { score: 50, passed: false }, postTest: { score: 90, passed: true }, joinedAt: '2026-10-01T00:00:00Z' },
  { learnerId: 'b', name: 'B', lessonsRead: 1, quizzesPassed: 0, preTest: null, postTest: null, joinedAt: '2026-10-02T00:00:00Z' },
]
const board = {
  stations: [{ id: 's1', name: 'CPR', kind: 'exam' }, { id: 's2', name: 'AED', kind: 'practice' }],
  rows: [{ learnerId: 'a', checkins: { s1: { passed: true }, s2: { passed: null } } }],
}
const certs = { rows: [{ learnerId: 'a', theory: { state: 'hub' }, practical: { state: 'hub' } }, { learnerId: 'b', theory: { state: 'none' }, practical: { state: 'none' } }] }

test('รวมผลทุกส่วนของคลาส: ภาพรวม, ฐาน, ใบประกาศ, รายคน', () => {
  const r = buildCohortReport({ learners, totalLessons: 2, board, certs })
  assert.equal(r.total, 2)
  assert.equal(r.overview.ready, 1)
  assert.equal(r.overview.post.taken, 1)
  assert.equal(r.overview.post.passRate, 100)
  assert.equal(r.overview.avgImprovement, 40)
  assert.equal(r.overview.attended, 1)
  assert.equal(r.overview.practicalComplete, 1)
  assert.equal(r.overview.practicalCerts, 1)
  assert.equal(r.overview.complete, 1)
  assert.deepEqual(r.stationStats.map((s) => [s.name, s.came, s.passed]), [['CPR', 1, 1], ['AED', 1, 0]])
  assert.equal(r.period.from, '2026-10-01T00:00:00Z')

  const b = r.students.find((s) => s.learnerId === 'b')
  assert.equal(b.complete, false)
  assert.ok(b.missing.includes('ยังไม่ได้เช็คชื่อวันอบรม'))
  assert.ok(b.missing.includes('ยังไม่ได้ใบภาคปฏิบัติ'))
})

test('ไม่มีภาคปฏิบัติ/ใบประกาศ: ข้าม section นั้น ไม่นับเป็นสิ่งที่ขาด', () => {
  const r = buildCohortReport({ learners: [learners[0]], totalLessons: 2 })
  assert.equal(r.hasPractical, false)
  assert.equal(r.hasCerts, false)
  assert.equal(r.overview.practicalComplete, null)
  assert.equal(r.students[0].complete, true)
})
