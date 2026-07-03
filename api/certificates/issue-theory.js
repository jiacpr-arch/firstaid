import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { generateCertCode } from '../_lib/certCode.js'
import { notifyCertIssued } from '../_lib/certNotify.js'
import { scoreExam, POST_PASSING as PASSING } from '../_lib/examKey.js'
import { learnerIdFromToken, reconcileLearner } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'issue-theory', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const {
    learnerId,
    learnerName,
    learnerPhone,
    learnerEmail,
    consent,
    answers,
  } = req.body || {}
  // Contact details + PDPA consent are required for self-service issuance.
  if (!learnerId || !learnerName || !learnerPhone || !learnerEmail) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }
  if (!consent) { res.status(400).json({ error: 'Consent required' }); return }

  // Bind to the authenticated learner when a LINE session token is present, so a
  // cert can't be minted against someone else's learnerId.
  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const { forbidden } = reconcileLearner(learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }

  // Idempotent: a learner gets exactly one theory certificate. Return the existing
  // one before doing any writes so repeated taps never create duplicates.
  const { data: existing } = await admin
    .from('certificates')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('kind', 'theory')
    .maybeSingle()
  if (existing) { res.status(200).json({ certificate: existing }); return }

  // Eligibility must be backed by a server-scored post-test attempt — the score
  // is never taken from the client. Prefer an existing attempt row; if there
  // isn't one yet, score the submitted answers here against the real key.
  const { data: attempts } = await admin
    .from('exam_attempts')
    .select('score, passed')
    .eq('learner_id', learnerId)
    .eq('kind', 'post')
    .order('score', { ascending: false })
    .limit(1)
  let best = attempts?.[0]
  if ((!best || !best.passed || best.score < PASSING) && answers && typeof answers === 'object') {
    const result = scoreExam('post', answers)
    if (result.passed) {
      const { data: inserted } = await admin
        .from('exam_attempts')
        .insert({
          uuid: randomUUID(),
          learner_id: learnerId,
          kind: 'post',
          score: result.score,
          correct: result.correctCount,
          total: result.totalQuestions,
          passed: true,
          finished_at: new Date().toISOString(),
        })
        .select('score, passed')
        .single()
      best = inserted
    }
  }
  if (!best || !best.passed || best.score < PASSING) {
    res.status(409).json({ error: 'Post-test not passed' })
    return
  }

  const cert = {
    learner_id: learnerId,
    kind: 'theory',
    code: generateCertCode(),
    issued_at: new Date().toISOString(),
    learner_name: learnerName,
    learner_phone: learnerPhone,
    learner_email: learnerEmail,
    pdpa_consent_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from('certificates').insert(cert).select().single()
  if (error) {
    // Lost a race with a concurrent issue — return the row that won.
    if (error.code === '23505') {
      const { data: winner } = await admin
        .from('certificates')
        .select('*')
        .eq('learner_id', learnerId)
        .eq('kind', 'theory')
        .maybeSingle()
      if (winner) { res.status(200).json({ certificate: winner }); return }
    }
    res.status(500).json({ error: error.message })
    return
  }

  // A fresh theory cert means a real lead just finished the course — alert the
  // admin on LINE with the running tally for the day. Awaited (so the push
  // completes before the function freezes) but never allowed to fail issuance:
  // notifyCertIssued swallows its own errors.
  await notifyCertIssued(admin, {
    kind: 'theory',
    learnerName,
    learnerPhone,
    learnerEmail,
    score: best.score,
    code: data.code,
    issuedAt: data.issued_at,
  })

  res.status(200).json({ certificate: data })
}
