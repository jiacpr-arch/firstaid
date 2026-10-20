import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'
import { resolveStudent, approveAttendance, loadOpenSession, sessionHasStations } from '../_lib/attendanceCheckin.js'
import { issuePracticalCertificate } from '../_lib/issuePractical.js'

// ครูสแกน QR ประจำตัวนักเรียน (payload) หรือติ๊กชื่อมือจากรายชื่อ cohort (learnerId)
// → บันทึกเข้าร่วม session และอนุมัติทันที; session ที่ไม่มีสถานีจะออกใบเซอร์ภาคปฏิบัติให้เลย
// เรียกได้ทั้งแอดมิน (Bearer) และผู้ช่วยที่ใช้รหัสผู้สอน (X-Instructor-Code)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { sessionId, payload, learnerId } = req.body || {}
  const actor = await authorizeInstructor(req, res, admin, sessionId)
  if (!actor) return
  if (!sessionId || (!payload && !learnerId)) { res.status(400).json({ error: 'Missing fields' }); return }

  const s = await loadOpenSession(admin, sessionId)
  if (s.error) { res.status(s.status).json({ error: s.error }); return }

  const r = await resolveStudent(admin, s.session, { payload, learnerId })
  if (r.error) { res.status(r.status).json({ error: r.error }); return }

  const a = await approveAttendance(admin, s.session, r.student, actor.user, r.method)
  if (a.error) { res.status(500).json({ error: a.error }); return }

  if (!a.duplicate && !(await sessionHasStations(admin, sessionId))) {
    await issuePracticalCertificate(admin, a.attendanceId).catch(() => {})
  }

  res.status(200).json({ ok: true, duplicate: a.duplicate, attendanceId: a.attendanceId, student: r.student })
}
