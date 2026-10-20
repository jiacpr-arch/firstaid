import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { parseStudentQr } from '../_lib/qrPayload.js'

// ครูสแกน QR ประจำตัวนักเรียน → บันทึกเข้าร่วม session และอนุมัติทันที
// (ครูเห็นตัวนักเรียนอยู่ตรงหน้า จึงไม่ต้องรออนุมัติซ้ำเหมือนนักเรียนเช็คชื่อเอง)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return
  const admin = getSupabaseAdmin()

  const { sessionId, payload } = req.body || {}
  if (!sessionId || !payload) { res.status(400).json({ error: 'Missing fields' }); return }

  const student = parseStudentQr(payload)
  if (!student) { res.status(422).json({ error: 'ไม่ใช่ QR นักเรียนของระบบนี้' }); return }

  const { data: session, error: sErr } = await admin
    .from('practical_sessions')
    .select('id, closed_at')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) { res.status(404).json({ error: 'Session not found' }); return }
  if (session.closed_at) { res.status(410).json({ error: 'Session closed' }); return }

  const now = new Date().toISOString()
  const { data: existing } = await admin
    .from('attendance')
    .select('id, status')
    .eq('session_id', session.id)
    .eq('learner_id', student.id)
    .maybeSingle()

  // สแกนซ้ำ: ไม่เปลี่ยนเวลา/สถานะที่อนุมัติแล้ว
  if (existing?.status === 'approved') {
    res.status(200).json({ ok: true, duplicate: true, attendanceId: existing.id, student })
    return
  }

  const row = {
    session_id: session.id,
    learner_id: student.id,
    learner_name: student.name,
    learner_phone: student.phone,
    checked_in_at: now,
    status: 'approved',
    approved_by: adminUser.id,
    approved_at: now,
    note: 'scan',
  }
  const { data, error } = await admin
    .from('attendance')
    .upsert(row, { onConflict: 'session_id,learner_id' })
    .select('id')
    .single()
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ ok: true, duplicate: false, attendanceId: data.id, student })
}
