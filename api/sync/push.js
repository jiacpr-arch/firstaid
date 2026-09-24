import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { scoreExam } from '../_lib/examKey.js'
import { authFromToken, reconcileLearner, isLearnerIdBound } from '../_lib/authLearner.js'
import { recordExamsAtHub } from '../_lib/hubResults.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Batch sync of offline-first learner progress from the client's Dexie store to
// Supabase, so instructor dashboards can see real progress and data survives a
// device/browser change. All writes are idempotent (upsert on the natural key)
// so re-sending the same rows is a no-op.
//
// Identity: when a LINE session token is present the rows are bound to the
// authenticated learner (a mismatching learnerId is rejected); anonymous learners
// (no login) sync best-effort under their local learnerId — but never under a
// learnerId already bound to a real account (same rule as issue-theory), or anyone
// who knew a bound id could write progress/exam rows into that learner's record,
// which the Hub reads as the learner's firstaid evidence. Exam attempts are
// always re-scored from the submitted answers here — the client score is ignored —
// and, for an authenticated learner, also sent to the Hub's central exam record.
const MAX_ROWS = 500

function cap(arr) {
  return Array.isArray(arr) ? arr.slice(0, MAX_ROWS) : []
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'sync-push', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const auth = await authFromToken(admin, req)
  const tokenLearnerId = auth?.learnerId || null
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId) { res.status(400).json({ error: 'Missing learnerId' }); return }
  // The client keeps unsynced rows and retries, so a learner who is simply logged out on this
  // device loses nothing — the rows go up with their token after the next login.
  if (!tokenLearnerId && await isLearnerIdBound(admin, learnerId)) {
    res.status(403).json({ error: 'Login required for this learnerId' })
    return
  }

  const lessonProgress = cap(body.lessonProgress)
  const quizAttempts = cap(body.quizAttempts)
  const simulationRuns = cap(body.simulationRuns)
  const examAttempts = cap(body.examAttempts)

  try {
    if (lessonProgress.length) {
      const rows = lessonProgress
        .filter((r) => r.lessonId)
        .map((r) => ({
          learner_id: learnerId,
          lesson_id: r.lessonId,
          read_at: r.readAt || new Date().toISOString(),
        }))
      const { error } = await admin.from('lesson_progress').upsert(rows, { onConflict: 'learner_id,lesson_id' })
      if (error) throw error
    }

    if (quizAttempts.length) {
      const rows = quizAttempts
        .filter((r) => r.uuid && r.lessonId)
        .map((r) => ({
          uuid: r.uuid,
          learner_id: learnerId,
          lesson_id: r.lessonId,
          score: r.score ?? 0,
          correct: r.correctCount ?? null,
          total: r.totalQuestions ?? null,
          passed: r.passed ?? null,
          finished_at: r.finishedAt || new Date().toISOString(),
        }))
      const { error } = await admin.from('quiz_attempts').upsert(rows, { onConflict: 'uuid' })
      if (error) throw error
    }

    if (simulationRuns.length) {
      const rows = simulationRuns
        .filter((r) => r.uuid && r.scenarioId)
        .map((r) => ({
          uuid: r.uuid,
          learner_id: learnerId,
          scenario_id: r.scenarioId,
          score: r.score ?? null,
          total: r.total ?? null,
          passed: r.passed ?? null,
          finished_at: r.finishedAt || new Date().toISOString(),
        }))
      const { error } = await admin.from('simulation_runs').upsert(rows, { onConflict: 'uuid' })
      if (error) throw error
    }

    if (examAttempts.length) {
      const rows = examAttempts
        .filter((r) => r.uuid && (r.kind === 'pre' || r.kind === 'post') && r.answers)
        .map((r) => {
          const result = scoreExam(r.kind, r.answers)
          return {
            uuid: r.uuid,
            learner_id: learnerId,
            kind: r.kind,
            score: result.score,
            correct: result.correctCount,
            total: result.totalQuestions,
            passed: result.passed,
            finished_at: r.finishedAt || new Date().toISOString(),
          }
        })
      if (rows.length) {
        const { error } = await admin.from('exam_attempts').upsert(rows, { onConflict: 'uuid' })
        if (error) throw error
        if (tokenLearnerId) await recordExamsAtHub(admin, auth.userId, rows)
      }
    }

    res.status(200).json({
      ok: true,
      synced: {
        lessonProgress: lessonProgress.length,
        quizAttempts: quizAttempts.length,
        simulationRuns: simulationRuns.length,
        examAttempts: examAttempts.length,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'sync failed' })
  }
}
