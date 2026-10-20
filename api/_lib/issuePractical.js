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
    // Defer — server hook will retry when theory cert is issued. For v1 just no-op.
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
