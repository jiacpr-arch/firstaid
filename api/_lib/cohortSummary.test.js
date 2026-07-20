import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCohortSummary } from './cohortSummary.js'

const A = '123e4567-e89b-42d3-a456-426614174aaa'
const B = '123e4567-e89b-42d3-a456-426614174bbb'
const S1 = 'aaaa1111-0000-4000-8000-000000000001'

test('empty cohort returns no learners', () => {
  const out = buildCohortSummary({})
  assert.deepEqual(out.learners, [])
  assert.deepEqual(out.sessions, [])
})

test('enrolled learner with no progress gets zeroed row', () => {
  const out = buildCohortSummary({
    enrollments: [{ learner_id: A, name: 'สมชาย', phone: '081', joined_at: '2026-07-01T00:00:00Z' }],
  })
  assert.equal(out.learners.length, 1)
  const row = out.learners[0]
  assert.equal(row.name, 'สมชาย')
  assert.equal(row.lessonsRead, 0)
  assert.equal(row.quizzesPassed, 0)
  assert.equal(row.preTest, null)
  assert.equal(row.postTest, null)
  assert.equal(row.scenariosPassed, 0)
  assert.equal(row.gameBest, null)
})

test('progress of non-enrolled learners is excluded', () => {
  const out = buildCohortSummary({
    enrollments: [{ learner_id: A, joined_at: '2026-07-01T00:00:00Z' }],
    lessonProgress: [
      { learner_id: A, lesson_id: 'l1', read_at: '2026-07-02T00:00:00Z' },
      { learner_id: B, lesson_id: 'l1', read_at: '2026-07-02T00:00:00Z' },
    ],
  })
  assert.equal(out.learners.length, 1)
  assert.equal(out.learners[0].lessonsRead, 1)
})

test('distinct counting: repeat lesson/scenario rows count once', () => {
  const out = buildCohortSummary({
    enrollments: [{ learner_id: A, joined_at: '2026-07-01T00:00:00Z' }],
    lessonProgress: [
      { learner_id: A, lesson_id: 'l1', read_at: '2026-07-02T00:00:00Z' },
      { learner_id: A, lesson_id: 'l1', read_at: '2026-07-03T00:00:00Z' },
      { learner_id: A, lesson_id: 'l2', read_at: '2026-07-03T00:00:00Z' },
    ],
    quizAttempts: [
      { learner_id: A, lesson_id: 'l1', passed: false, finished_at: '2026-07-02T00:00:00Z' },
      { learner_id: A, lesson_id: 'l1', passed: true, finished_at: '2026-07-03T00:00:00Z' },
      { learner_id: A, lesson_id: 'l1', passed: true, finished_at: '2026-07-04T00:00:00Z' },
    ],
    simulationRuns: [
      { learner_id: A, scenario_id: 's1', passed: true, finished_at: '2026-07-02T00:00:00Z' },
      { learner_id: A, scenario_id: 's1', passed: true, finished_at: '2026-07-03T00:00:00Z' },
      { learner_id: A, scenario_id: 's2', passed: false, finished_at: '2026-07-03T00:00:00Z' },
    ],
  })
  const row = out.learners[0]
  assert.equal(row.lessonsRead, 2)
  assert.equal(row.quizzesPassed, 1)
  assert.equal(row.scenariosPassed, 1)
})

test('best exam per kind: highest score, passed if any attempt passed', () => {
  const out = buildCohortSummary({
    enrollments: [{ learner_id: A, joined_at: '2026-07-01T00:00:00Z' }],
    examAttempts: [
      { learner_id: A, kind: 'pre', score: 40, passed: false, finished_at: '2026-07-02T00:00:00Z' },
      { learner_id: A, kind: 'post', score: 85, passed: true, finished_at: '2026-07-03T00:00:00Z' },
      { learner_id: A, kind: 'post', score: 60, passed: false, finished_at: '2026-07-04T00:00:00Z' },
    ],
  })
  const row = out.learners[0]
  assert.deepEqual(row.preTest, { score: 40, passed: false })
  assert.deepEqual(row.postTest, { score: 85, passed: true })
})

test('game best keeps highest score; attendance maps only cohort sessions', () => {
  const out = buildCohortSummary({
    enrollments: [{ learner_id: A, joined_at: '2026-07-01T00:00:00Z' }],
    gameResults: [
      { learner_id: A, score: 100, grade: 'A', won: true, finished_at: '2026-07-02T00:00:00Z' },
      { learner_id: A, score: 163, grade: 'S', won: true, finished_at: '2026-07-03T00:00:00Z' },
    ],
    sessions: [{ id: S1, title: 'ฐาน CPR' }],
    attendance: [
      { learner_id: A, session_id: S1, status: 'approved' },
      { learner_id: A, session_id: 'other-session', status: 'pending' },
    ],
  })
  const row = out.learners[0]
  assert.deepEqual(row.gameBest, { score: 163, grade: 'S', won: true })
  assert.deepEqual(row.attendance, { [S1]: 'approved' })
  assert.deepEqual(out.sessions, [{ id: S1, title: 'ฐาน CPR' }])
})

test('learners sorted by joinedAt ascending', () => {
  const out = buildCohortSummary({
    enrollments: [
      { learner_id: B, joined_at: '2026-07-05T00:00:00Z' },
      { learner_id: A, joined_at: '2026-07-01T00:00:00Z' },
    ],
  })
  assert.deepEqual(out.learners.map((l) => l.learnerId), [A, B])
})
