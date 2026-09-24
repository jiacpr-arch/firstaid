import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { parseVerifyQuery, visibleCertificate } from '../_lib/certVerify.js'

// Public check of a certificate by its code. Random FA- codes answer on the code alone; sequential
// ones (B-CPR, BCPR-YYYY-NNNN) need the printed name too — see _lib/certVerify.js.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (rateLimited(req, res, { key: 'cert-verify', limit: 30, windowMs: 60_000 })) return
  const q = parseVerifyQuery(req.query)
  if (q.error) { res.status(400).json({ error: q.error }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { data, error } = await admin
    .from('certificates')
    .select('code, kind, learner_name, issued_at, location')
    .eq('code', q.code)
    .maybeSingle()
  if (error) { res.status(500).json({ error: error.message }); return }
  const certificate = visibleCertificate(data, q)
  if (!certificate) { res.status(404).json({ error: 'Not found' }); return }
  res.status(200).json({ certificate })
}
