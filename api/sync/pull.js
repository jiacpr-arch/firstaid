import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Restores a learner's progress from Supabase back down to a new device/browser
// after LINE login — the counterpart to push.js. Unlike push, this ALWAYS
// requires a valid session token: an anonymous caller could otherwise pull any
// learner's exam history/PII just by guessing a learnerId, so there is no
// body/query learnerId fallback here.
const CAP = 500

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'sync-pull', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const learnerId = await learnerIdFromToken(admin, req)
  if (!learnerId) { res.status(401).json({ error: 'Login required' }); return }

  try {
    const [lessonProgress, quizAttempts, examAttempts, simulationRuns, certificates] = await Promise.all([
      admin.from('lesson_progress').select('lesson_id, read_at').eq('learner_id', learnerId).limit(CAP),
      admin.from('quiz_attempts').select('uuid, lesson_id, score, correct, total, passed, finished_at').eq('learner_id', learnerId).limit(CAP),
      admin.from('exam_attempts').select('uuid, kind, score, correct, total, passed, finished_at').eq('learner_id', learnerId).limit(CAP),
      admin.from('simulation_runs').select('uuid, scenario_id, score, total, passed, finished_at').eq('learner_id', learnerId).limit(CAP),
      admin.from('certificates').select('id, kind, code, issued_at, learner_name, location').eq('learner_id', learnerId),
    ])
    for (const r of [lessonProgress, quizAttempts, examAttempts, simulationRuns, certificates]) {
      if (r.error) throw r.error
    }

    res.status(200).json({
      ok: true,
      learnerId,
      lessonProgress: lessonProgress.data.map((r) => ({ lessonId: r.lesson_id, readAt: r.read_at })),
      quizAttempts: quizAttempts.data.map((r) => ({
        uuid: r.uuid, lessonId: r.lesson_id, score: r.score, correctCount: r.correct,
        totalQuestions: r.total, passed: r.passed, finishedAt: r.finished_at,
      })),
      examAttempts: examAttempts.data.map((r) => ({
        uuid: r.uuid, kind: r.kind, score: r.score, correctCount: r.correct,
        totalQuestions: r.total, passed: r.passed, finishedAt: r.finished_at,
      })),
      simulationRuns: simulationRuns.data.map((r) => ({
        uuid: r.uuid, scenarioId: r.scenario_id, score: r.score, total: r.total,
        passed: r.passed, finishedAt: r.finished_at,
      })),
      certificates: certificates.data.map((r) => ({
        id: r.id, kind: r.kind, code: r.code, issuedAt: r.issued_at,
        learnerName: r.learner_name, location: r.location,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'pull failed' })
  }
}
