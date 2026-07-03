import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'
import { rateLimited, sanitizeLine } from '../_lib/rateLimit.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (rateLimited(req, res, { key: 'checkin', limit: 10, windowMs: 60_000 })) return
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
    .select('id, title, location, closed_at, kind')
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

  // Notify admin for booth check-ins (leads) — fire and forget
  if (session.kind === 'booth') {
    const loc = session.location ? ` (${sanitizeLine(session.location, 60)})` : ''
    notifyAdminLine(
      `📋 check-in บูธ${loc}\nชื่อ: ${sanitizeLine(learnerName)}\nโทร: ${sanitizeLine(learnerPhone || '—', 40)}\nรหัส: ${sanitizeLine(sessionCode, 12).toUpperCase()}`
    ).catch(() => {})
  }

  res.status(200).json({ ok: true })
}
