import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { generateCertCode } from '../_lib/certCode.js'

const PASSING = 80

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { learnerId, learnerName } = req.body || {}
  if (!learnerId || !learnerName) { res.status(400).json({ error: 'Missing fields' }); return }

  // Verify the learner has a passing post-test attempt
  const { data: attempts } = await admin
    .from('exam_attempts')
    .select('score, passed')
    .eq('learner_id', learnerId)
    .eq('kind', 'post')
    .order('score', { ascending: false })
    .limit(1)
  const best = attempts?.[0]
  if (!best || !best.passed || best.score < PASSING) {
    res.status(409).json({ error: 'Post-test not passed' })
    return
  }

  // Idempotent: return existing if already issued
  const { data: existing } = await admin
    .from('certificates')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('kind', 'theory')
    .maybeSingle()
  if (existing) { res.status(200).json({ certificate: existing }); return }

  const cert = {
    learner_id: learnerId,
    kind: 'theory',
    code: generateCertCode(),
    issued_at: new Date().toISOString(),
    learner_name: learnerName,
  }
  const { data, error } = await admin.from('certificates').insert(cert).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ certificate: data })
}
