import { generateCertCode } from './certCode.js'
import { notifyCertIssued } from './certNotify.js'

// ออกใบเซอร์ภาคปฏิบัติจากแถว attendance ที่อนุมัติแล้ว (idempotent)
// คืน { status, body } ให้ผู้เรียกส่งต่อเป็น HTTP response หรือใช้ภายในเซิร์ฟเวอร์
export async function issuePracticalCertificate(admin, attendanceId) {
  if (!attendanceId) return { status: 400, body: { error: 'Missing attendanceId' } }

  const { data: att, error: aErr } = await admin
    .from('attendance')
    .select('learner_id, learner_name, status, session_id')
    .eq('id', attendanceId)
    .single()
  if (aErr || !att) return { status: 404, body: { error: 'Attendance not found' } }
  if (att.status !== 'approved') return { status: 409, body: { error: 'Attendance not approved' } }

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
    // Defer — api/certificates/issue-theory.js retries (retryPracticalForLearner) once it is issued.
    return { status: 202, body: { ok: false, reason: 'Theory cert not yet issued — will retry' } }
  }

  // Idempotent
  const { data: existing } = await admin
    .from('certificates')
    .select('*')
    .eq('learner_id', att.learner_id)
    .eq('kind', 'practical')
    .maybeSingle()
  if (existing) return { status: 200, body: { certificate: existing } }

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
  if (error) {
    // Lost a race with a concurrent issue — return the row that won, no double ping.
    if (error.code === '23505') {
      const { data: winner } = await admin
        .from('certificates')
        .select('*')
        .eq('learner_id', att.learner_id)
        .eq('kind', 'practical')
        .maybeSingle()
      if (winner) return { status: 200, body: { certificate: winner } }
    }
    return { status: 500, body: { error: error.message } }
  }

  // A genuinely new practical cert means the learner just finished the in-person
  // session — alert the admin on LINE with the running tally for the day. Never
  // allowed to fail issuance: notifyCertIssued swallows its own errors.
  await notifyCertIssued(admin, {
    kind: 'practical',
    learnerName: data.learner_name,
    location: data.location,
    code: data.code,
    issuedAt: data.issued_at,
  })

  return { status: 200, body: { certificate: data } }
}

// ลองออกใบเซอร์ภาคปฏิบัติอีกครั้งเมื่อเงื่อนไขที่ขาดมาถึงทีหลัง — ใช้ตอนเพิ่งได้ใบเซอร์ทฤษฎี
// (issue-theory.js): นักเรียนที่มาเรียนจริง/สอบผ่านก่อนทำ post-test ผ่าน เดิมจะค้าง 202 ตลอดไป
// คงกติกาเดิมของระบบสถานี (instructor-checkin.js / station-checkin.js): รอบที่มีสถานี ใบเซอร์ออกเมื่อ
// สอบผ่านที่ฐานสอบเท่านั้น — รอบที่ไม่มีสถานี การเช็คชื่อที่อนุมัติแล้วพอ
// คืนผลของ issuePracticalCertificate หรือ null ถ้ายังไม่มีรอบไหนที่ออกได้
export async function retryPracticalForLearner(admin, learnerId) {
  const { data: rows, error } = await admin
    .from('attendance')
    .select('id, session_id, checked_in_at')
    .eq('learner_id', learnerId)
    .eq('status', 'approved')
    .order('checked_in_at', { ascending: false })
    .limit(10)
  if (error) throw error
  for (const att of rows || []) {
    if (await practicalExamSatisfied(admin, att.session_id, learnerId)) {
      return issuePracticalCertificate(admin, att.id)
    }
  }
  return null
}

async function practicalExamSatisfied(admin, sessionId, learnerId) {
  const { data: stations, error } = await admin
    .from('session_stations').select('id, kind').eq('session_id', sessionId)
  if (error) throw error
  if (!stations?.length) return true
  const examIds = new Set(stations.filter((st) => st.kind === 'exam').map((st) => st.id))
  if (!examIds.size) return false
  const { data: passes, error: pErr } = await admin
    .from('station_checkins')
    .select('station_id')
    .eq('session_id', sessionId)
    .eq('learner_id', learnerId)
    .eq('passed', true)
  if (pErr) throw pErr
  return (passes || []).some((p) => examIds.has(p.station_id))
}
