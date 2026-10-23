import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { parseVerifyQuery, visibleCertificate, publicExam } from '../_lib/certVerify.js'
import { POST_PASSING } from '../_lib/examKey.js'

// Public check of a certificate by its code. Random FA- codes answer on the code alone; sequential
// ones (B-CPR, BCPR-YYYY-NNNN) need the printed name too — see _lib/certVerify.js. A theory
// certificate also answers with the post-test it was issued on (score, pass mark, passed).
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (rateLimited(req, res, { key: 'cert-verify', limit: 30, windowMs: 60_000 })) return
  const q = parseVerifyQuery(req.query)
  if (q.error) { res.status(400).json({ error: q.error }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { data, error } = await admin
    .from('certificates')
    .select('code, kind, learner_id, learner_name, issued_at, location')
    .eq('code', q.code)
    .maybeSingle()
  if (error) { res.status(500).json({ error: error.message }); return }
  const visible = visibleCertificate(data, q)
  if (!visible) { res.status(404).json({ error: 'Not found' }); return }
  const { learner_id: learnerId, ...certificate } = visible
  if (certificate.kind === 'theory' && learnerId) {
    const { data: attempts } = await admin
      .from('exam_attempts')
      .select('score, correct, total, passed, finished_at')
      .eq('learner_id', learnerId)
      .eq('kind', 'post')
      .order('score', { ascending: false })
      .limit(1)
    certificate.exam = publicExam(attempts?.[0], POST_PASSING)
  }
  res.status(200).json({ certificate })
}
