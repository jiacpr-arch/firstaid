import { test } from 'node:test'
import assert from 'node:assert/strict'
import { postTest, preTest } from '../../src/courses/firstaid/exams.js'
import { scoreExam, POST_PASSING } from './examKey.js'

const allCorrect = (exam) => Object.fromEntries(exam.questions.map((q) => [q.id, q.correctId]))
const allWrong = (exam) => Object.fromEntries(exam.questions.map((q) => [q.id, '__nope__']))

test('scoreExam gives 100 and passes when every post-test answer is correct', () => {
  const r = scoreExam('post', allCorrect(postTest))
  assert.equal(r.score, 100)
  assert.equal(r.correctCount, postTest.questions.length)
  assert.equal(r.passed, true)
})

test('scoreExam gives 0 and fails for all-wrong answers (forgery attempt)', () => {
  const r = scoreExam('post', allWrong(postTest))
  assert.equal(r.score, 0)
  assert.equal(r.passed, false)
})

test('scoreExam ignores unknown answer maps — empty object never passes', () => {
  // This is the closed forgery hole: a caller who cannot supply real correct
  // answers cannot reach a passing score no matter what score they *claim*.
  assert.equal(scoreExam('post', {}).passed, false)
  assert.equal(scoreExam('post', null).passed, false)
})

test('scoreExam enforces the 80% post-test threshold', () => {
  const answers = {}
  const need = Math.ceil((POST_PASSING / 100) * postTest.questions.length)
  // Answer exactly (need - 1) correctly → should still fail.
  postTest.questions.slice(0, need - 1).forEach((q) => { answers[q.id] = q.correctId })
  assert.equal(scoreExam('post', answers).passed, false)
  // One more correct → passes.
  answers[postTest.questions[need - 1].id] = postTest.questions[need - 1].correctId
  assert.equal(scoreExam('post', answers).passed, true)
})

test('scoreExam scores the pre-test (informational, no passing threshold)', () => {
  const r = scoreExam('pre', allCorrect(preTest))
  assert.equal(r.score, 100)
  assert.equal(r.totalQuestions, preTest.questions.length)
})

test('scoreExam throws on an unknown exam kind', () => {
  assert.throws(() => scoreExam('midterm', {}), /unknown exam kind/)
})
