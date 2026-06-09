import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { sessionCode, learnerId, learnerName, learnerPhone } = req.body || {}
  if (!sessionCode || !learnerId || !learnerName) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }

  // Look up session by qr_token (session code)
  const { data: session, error: sErr } = await admin
    .from('practical_sessions')
    .select('id, closed_at')
    .eq('qr_token', sessionCode.toUpperCase())
    .single()
  if (sErr || !session) { res.status(404).json({ error: 'Session not found' }); return }
  if (session.closed_at) { res.status(410).json({ error: 'Session closed' }); return }

  const row = {
    session_id: session.id,
    learner_id: learnerId,
    learner_name: learnerName,
    learner_phone: learnerPhone || null,
    checked_in_at: new Date().toISOString(),
    status: 'pending',
  }
  // Upsert on (session_id, learner_id) to avoid duplicate check-ins
  const { error } = await admin
    .from('attendance')
    .upsert(row, { onConflict: 'session_id,learner_id' })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ ok: true })
}
