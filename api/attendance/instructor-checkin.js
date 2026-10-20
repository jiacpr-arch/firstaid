import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { resolveStudent, approveAttendance, loadOpenSession } from '../_lib/attendanceCheckin.js'

// ครูสแกน QR ประจำตัวนักเรียน (payload) หรือติ๊กชื่อมือจากรายชื่อ cohort (learnerId)
// → บันทึกเข้าร่วม session และอนุมัติทันที
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return
  const admin = getSupabaseAdmin()

  const { sessionId, payload, learnerId } = req.body || {}
  if (!sessionId || (!payload && !learnerId)) { res.status(400).json({ error: 'Missing fields' }); return }

  const s = await loadOpenSession(admin, sessionId)
  if (s.error) { res.status(s.status).json({ error: s.error }); return }

  const r = await resolveStudent(admin, s.session, { payload, learnerId })
  if (r.error) { res.status(r.status).json({ error: r.error }); return }

  const a = await approveAttendance(admin, s.session, r.student, adminUser, r.method)
  if (a.error) { res.status(500).json({ error: a.error }); return }

  res.status(200).json({ ok: true, duplicate: a.duplicate, attendanceId: a.attendanceId, student: r.student })
}
