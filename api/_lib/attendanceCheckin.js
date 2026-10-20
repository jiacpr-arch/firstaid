import { parseStudentQr } from './qrPayload.js'

// ใช้ร่วมกันระหว่าง instructor-checkin และ station-checkin

// หาตัวนักเรียนจาก QR (payload) หรือจากรายชื่อ cohort (learnerId — ชื่อมาจาก enrollments ฝั่งเซิร์ฟเวอร์)
// คืน { student, method } หรือ { error, status }
export async function resolveStudent(admin, session, { payload, learnerId }) {
  if (payload) {
    const student = parseStudentQr(payload)
    if (!student) return { status: 422, error: 'ไม่ใช่ QR นักเรียนของระบบนี้' }
    return { student, method: 'scan' }
  }
  if (!session.cohort_id) return { status: 422, error: 'Session ไม่ได้ผูกกับ cohort' }
  const { data: enr } = await admin
    .from('enrollments')
    .select('learner_id, name, phone')
    .eq('cohort_id', session.cohort_id)
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (!enr) return { status: 404, error: 'ไม่พบนักเรียนใน cohort นี้' }
  return {
    student: { id: enr.learner_id, name: enr.name || enr.learner_id, phone: enr.phone || null },
    method: 'manual',
  }
}

// บันทึกเข้าร่วม session และอนุมัติทันที (ครูเห็นตัวนักเรียนอยู่ตรงหน้า)
// actor = ผู้ใช้แอดมิน หรือ null เมื่อผู้ช่วยใช้รหัสผู้สอน
// สแกนซ้ำไม่แตะแถวที่อนุมัติแล้ว — คืน { attendanceId, duplicate } หรือ { error }
export async function approveAttendance(admin, session, student, actor, method) {
  const { data: existing } = await admin
    .from('attendance')
    .select('id, status')
    .eq('session_id', session.id)
    .eq('learner_id', student.id)
    .maybeSingle()
  if (existing?.status === 'approved') return { attendanceId: existing.id, duplicate: true }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('attendance')
    .upsert({
      session_id: session.id,
      learner_id: student.id,
      learner_name: student.name,
      learner_phone: student.phone,
      checked_in_at: now,
      status: 'approved',
      approved_by: actor?.id ?? null,
      approved_at: now,
      note: method,
    }, { onConflict: 'session_id,learner_id' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { attendanceId: data.id, duplicate: false }
}

// session ที่เปิดอยู่ หรือ { status, error }
export async function loadOpenSession(admin, sessionId) {
  const { data: session, error } = await admin
    .from('practical_sessions')
    .select('id, closed_at, cohort_id')
    .eq('id', sessionId)
    .single()
  if (error || !session) return { status: 404, error: 'Session not found' }
  if (session.closed_at) return { status: 410, error: 'Session closed' }
  return { session }
}

// session นี้มีสถานีหรือไม่ — มีสถานี: ใบเซอร์ออกเมื่อสอบผ่าน; ไม่มี: ออกตอนเช็คชื่อ (flow เดิม)
export async function sessionHasStations(admin, sessionId) {
  const { count } = await admin
    .from('session_stations').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
  return (count || 0) > 0
}
