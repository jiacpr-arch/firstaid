import test from 'node:test'
import assert from 'node:assert/strict'
import { validateGradeRequest, pickStudentRow, mergeScores, buildStudentWrite, cprLearnerTag, CPR_COMPLETED_STATUS } from './cprCourse.js'
import { matchCprProgress } from './cprProgress.js'

const five = [0, 1, 2, 3, 4]
const ten = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

test('validateGradeRequest enforces the per-module question count grade-quiz expects', () => {
  assert.equal(validateGradeRequest({ moduleId: 1, questions: five, answers: five }), null)
  assert.equal(validateGradeRequest({ moduleId: 7, questions: ten, answers: ten }), null)
  assert.equal(validateGradeRequest({ moduleId: 7, questions: five, answers: five }), 'bad payload')
  assert.equal(validateGradeRequest({ moduleId: 8, questions: five, answers: five }), 'unknown module')
  assert.equal(validateGradeRequest({ moduleId: 1, questions: five, answers: [0, 1, 2, 3, 'x'] }), 'bad payload')
})

test('pickStudentRow: class rows match tag + phone; paid rows match the learner tag', () => {
  const rows = [
    { id: 'own', company: null, phone: '0812345678' },
    { id: 'other', company: 'firstaid-class:JIA-FA-OTHER', phone: '0812345678' },
    { id: 'mine', company: 'firstaid-class:JIA-FA-ABC', phone: '66812345678' },
  ]
  const cls = { tag: 'firstaid-class:JIA-FA-ABC', matchPhone: true }
  assert.equal(pickStudentRow(rows, { ...cls, phone: '081-234-5678' }).id, 'mine')
  assert.equal(pickStudentRow(rows, { ...cls, phone: '0899999999' }), null)
  const paid = [{ id: 'p1', company: cprLearnerTag('L1'), phone: '' }]
  assert.equal(pickStudentRow(paid, { tag: cprLearnerTag('L1'), matchPhone: false }).id, 'p1')
  assert.equal(pickStudentRow(paid, { tag: cprLearnerTag('L2'), matchPhone: false }), null)
})

test('mergeScores keeps the best score per module', () => {
  assert.deepEqual(mergeScores({ 1: 100 }, 1, 80), { 1: 100 })
  assert.deepEqual(mergeScores(null, 2, 80), { 2: 80 })
})

test('buildStudentWrite: failed attempt writes nothing; first pass inserts a tagged pre-course row', () => {
  const owner = { name: ' สมชาย ใจดี ', phone: '081-234-5678', tag: 'firstaid-class:JIA-FA-ABC', preCourse: true }
  assert.equal(buildStudentWrite({ owner, moduleId: 1, graded: { passed: false, score: 40 } }), null)
  const w = buildStudentWrite({ owner, moduleId: 1, graded: { passed: true, score: 80 } })
  assert.equal(w.op, 'insert')
  assert.deepEqual(w.row, {
    name: 'สมชาย ใจดี', phone: '0812345678', company: 'firstaid-class:JIA-FA-ABC',
    pre_course: true, status: 'กำลังเรียน', chapter_scores: { 1: 80 },
  })
})

test('buildStudentWrite: passing the final marks the class row completed so the teacher sees it', () => {
  const now = new Date('2026-11-07T03:00:00Z')
  const existing = { id: 'row1', chapter_scores: { 1: 100, 2: 80 }, completed_at: null, final_score: null }
  const w = buildStudentWrite({ existing, owner: { tag: 'firstaid-class:JIA-FA-ABC' }, moduleId: 7, graded: { passed: true, score: 90 }, now })
  assert.equal(w.op, 'update')
  assert.equal(w.id, 'row1')
  assert.deepEqual(w.patch, {
    chapter_scores: { 1: 100, 2: 80, 7: 90 },
    status: CPR_COMPLETED_STATUS, completed_at: now.toISOString(), final_score: 90, renew_date: '2027-05-07',
  })
  // matchCprProgress (dashboard ครู + my-cpr) อ่านแถวนี้เป็น "เรียนจบ"
  const out = matchCprProgress({
    enrollments: [{ learner_id: 'L', phone: '0812345678' }],
    students: [{ phone: '0812345678', ...w.patch }],
  })
  assert.equal(out.get('L').completed, true)
  assert.equal(out.get('L').modulesDone, 3)
})

test('buildStudentWrite: a paid learner without a phone gets a non-pre-course row tagged with their id', () => {
  const w = buildStudentWrite({ owner: { tag: cprLearnerTag('L1'), name: '', phone: '' }, moduleId: 2, graded: { passed: true, score: 100 } })
  assert.deepEqual(w.row, {
    name: 'ผู้เรียน firstaid', phone: '', company: 'firstaid-learner:L1',
    pre_course: false, status: 'กำลังเรียน', chapter_scores: { 2: 100 },
  })
})
