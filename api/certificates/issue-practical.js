import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { generateCertCode } from '../_lib/certCode.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { attendanceId } = req.body || {}
  if (!attendanceId) { res.status(400).json({ error: 'Missing attendanceId' }); return }

  const { data: att, error: aErr } = await admin
    .from('attendance')
    .select('learner_id, learner_name, status, session_id')
    .eq('id', attendanceId)
    .single()
  if (aErr || !att) { res.status(404).json({ error: 'Attendance not found' }); return }
  if (att.status !== 'approved') { res.status(409).json({ error: 'Attendance not approved' }); return }

  const { data: session } = await admin
    .from('practical_sessions')
    .select('title, location, instructor_id')
    .eq('id', att.session_id)
    .single()

  // Require theory cert first
  const { data: theory } = await admin
    .from('certificates')
    .select('id')
    .eq('learner_id', att.learner_id)
    .eq('kind', 'theory')
    .maybeSingle()
  if (!theory) {
    // Defer — server hook will retry when theory cert is issued. For v1 just no-op.
    res.status(202).json({ ok: false, reason: 'Theory cert not yet issued — will retry' })
    return
  }

  // Idempotent
  const { data: existing } = await admin
    .from('certificates')
    .select('*')
    .eq('learner_id', att.learner_id)
    .eq('kind', 'practical')
    .maybeSingle()
  if (existing) { res.status(200).json({ certificate: existing }); return }

  const cert = {
    learner_id: att.learner_id,
    kind: 'practical',
    code: generateCertCode(),
    issued_at: new Date().toISOString(),
    learner_name: att.learner_name,
    source_ref: attendanceId,
    location: session?.location || null,
  }
  const { data, error } = await admin.from('certificates').insert(cert).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ certificate: data })
}
