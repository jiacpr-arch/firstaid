import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const code = (req.query?.code || '').toString().toUpperCase()
  if (!code) { res.status(400).json({ error: 'Missing code' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { data, error } = await admin
    .from('certificates')
    .select('code, kind, learner_name, issued_at, location')
    .eq('code', code)
    .maybeSingle()
  if (error) { res.status(500).json({ error: error.message }); return }
  if (!data) { res.status(404).json({ error: 'Not found' }); return }
  res.status(200).json({ certificate: data })
}
