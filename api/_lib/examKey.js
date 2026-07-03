// Server-side exam scoring. The answer key is derived from the same course
// content the client renders (exams.js is pure data, no browser deps), so the
// server never has to trust a client-supplied score. correctId is already in the
// client bundle, so importing it here exposes nothing new.
import { preTest, postTest } from '../../src/courses/firstaid/exams.js'

const EXAMS = { pre: preTest, post: postTest }

// Scores a { questionId: choiceId } answer map against the real key.
// Returns { score, correctCount, totalQuestions, passed } — score is 0–100.
export function scoreExam(kind, answers) {
  const exam = EXAMS[kind]
  if (!exam) throw new Error(`unknown exam kind: ${kind}`)
  const a = answers && typeof answers === 'object' ? answers : {}
  const totalQuestions = exam.questions.length
  const correctCount = exam.questions.filter((q) => a[q.id] === q.correctId).length
  const score = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0
  const passing = exam.passingScore ?? 0
  return { score, correctCount, totalQuestions, passed: score >= passing }
}

export const POST_PASSING = postTest.passingScore ?? 80
