import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLearnerDetail, computeGaps } from './learnerDetail.js'

const base = {
  enrollment: { learner_id: 'L1', name: 'สมชาย', phone: '081', joined_at: '2026-10-01T00:00:00Z' },
  lessonProgress: [
    { lesson_id: 'duty', read_at: '2026-10-02T00:00:00Z' },
    { lesson_id: 'safety', read_at: '2026-10-03T00:00:00Z' },
  ],
  quizAttempts: [
    { lesson_id: 'duty', passed: false, finished_at: '2026-10-02T01:00:00Z' },
    { lesson_id: 'duty', passed: true, finished_at: '2026-10-02T02:00:00Z' },
  ],
  examAttempts: [
    { kind: 'pre', score: 40, passed: false, finished_at: '2026-10-02T03:00:00Z' },
    { kind: 'pre', score: 60, passed: true, finished_at: '2026-10-04T03:00:00Z' },
  ],
  simulationRuns: [{ scenario_id: 'duty-consent', passed: true, finished_at: '2026-10-05T00:00:00Z' }],
  gameResults: [{ score: 5, grade: 'C' }, { score: 9, grade: 'A', won: true }],
  sessions: [{ id: 'S1', title: 'รอบ 1', starts_at: '2026-10-20T00:00:00Z' }],
  attendance: [{ session_id: 'S1', status: 'approved', checked_in_at: '2026-10-20T08:00:00Z' }],
  stations: [
    { id: 'st2', session_id: 'S1', name: 'สอบ', kind: 'exam', sort_order: 1 },
    { id: 'st1', session_id: 'S1', name: 'CPR', kind: 'practice', sort_order: 0 },
    { id: 'st3', session_id: 'S1', name: 'สำลัก', kind: 'practice', sort_order: 2 },
  ],
  stationCheckins: [{ station_id: 'st1', checked_in_at: '2026-10-20T08:30:00Z', passed: null, score: null }],
  certificates: [
    { kind: 'theory', code: 'T-1', issued_at: '2026-10-06T00:00:00Z' },
    { kind: 'practical', code: 'P-1', issued_at: '2026-10-21T00:00:00Z', revoked_at: '2026-10-22T00:00:00Z' },
  ],
}

test('folds one learner rows: dedupes lessons/quizzes, orders exams newest first, best game score', () => {
  const d = buildLearnerDetail(base)
  assert.deepEqual(d.lessons.readIds, ['duty', 'safety'])
  assert.deepEqual(d.lessons.quizPassedIds, ['duty'])
  assert.deepEqual(d.exams.pre.map((e) => e.score), [60, 40])
  assert.deepEqual(d.scenariosPassedIds, ['duty-consent'])
  assert.equal(d.game.score, 9)
  assert.equal(d.learner.lastActivity, '2026-10-20T08:30:00Z')
})

test('stations are ordered by sort_order and carry check-in state', () => {
  const [s] = buildLearnerDetail(base).sessions
  assert.deepEqual(s.stations.map((x) => x.name), ['CPR', 'สอบ', 'สำลัก'])
  assert.equal(s.stations[0].checkedInAt, '2026-10-20T08:30:00Z')
  assert.equal(s.stations[1].checkedInAt, null)
  assert.equal(s.attendance.status, 'approved')
})

test('revoked certificates are not shown as issued', () => {
  const d = buildLearnerDetail(base)
  assert.equal(d.certificates.theory.code, 'T-1')
  assert.equal(d.certificates.practical, null)
})

test('computeGaps lists what is still missing', () => {
  const d = buildLearnerDetail(base)
  const g = computeGaps(d, { lessonIds: ['duty', 'safety', 'assess'], scenarioIds: ['duty-consent', 'other'] })
  assert.deepEqual(g.lessonsUnread, ['assess'])
  assert.deepEqual(g.quizzesNotPassed, ['safety'])
  assert.deepEqual(g.scenariosNotPassed, ['other'])
  assert.equal(g.preTestMissing, false)
  assert.equal(g.postTestMissing, true)
  assert.deepEqual(g.stationsMissing.map((s) => s.name), ['สำลัก'])
  assert.deepEqual(g.examStationsNotPassed.map((s) => s.name), ['สอบ'])
})

test('a learner with no data yields empty but well-formed detail', () => {
  const d = buildLearnerDetail({ enrollment: { learner_id: 'L2' } })
  assert.equal(d.learner.lastActivity, null)
  assert.deepEqual(d.sessions, [])
  assert.equal(d.game, null)
  assert.equal(computeGaps(d, { lessonIds: ['a'] }).lessonsUnread.length, 1)
})
