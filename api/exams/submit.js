import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { scoreExam } from '../_lib/examKey.js'
import { learnerIdFromToken, reconcileLearner } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Server-authoritative exam scoring. The client submits the raw answer map and
// the server scores it against the real key (never trusting a client score),
// records the attempt in exam_attempts, and returns the result. This is what
// backs theory-certificate eligibility.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'exam-submit', limit: 20, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { kind, answers, learnerId } = req.body || {}
  if (kind !== 'pre' && kind !== 'post') { res.status(400).json({ error: 'Invalid kind' }); return }
  if (!answers || typeof answers !== 'object') { res.status(400).json({ error: 'Missing answers' }); return }

  // Bind identity to the authenticated learner when a token is present; reject a
  // token that claims a different learnerId than the body.
  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const { learnerId: effectiveLearnerId, forbidden } = reconcileLearner(learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!effectiveLearnerId) { res.status(400).json({ error: 'Missing learnerId' }); return }

  const result = scoreExam(kind, answers)

  const { error } = await admin.from('exam_attempts').insert({
    uuid: randomUUID(),
    learner_id: effectiveLearnerId,
    kind,
    score: result.score,
    correct: result.correctCount,
    total: result.totalQuestions,
    passed: result.passed,
    finished_at: new Date().toISOString(),
  })
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json(result)
}
