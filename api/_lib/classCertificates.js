import { HUB_RESULTS_CLIENT, HUB_COURSE_ID } from './hubResults.js'
import { recordPracticalAtHub } from './hubPractical.js'

// แท็บ "ผล & ใบประกาศ" ของหน้าคลาส (/admin/teach): ต่อนักเรียน 1 แถว — ได้ใบจากระบบกลาง JIA แล้วหรือยัง
// (ทฤษฎีออนไลน์ + ปฏิบัติ) และถ้ายัง ติดอะไร ใบที่ผู้เรียนเห็นคือใบของระบบกลาง; แถว certificates ของแอปนี้
// เป็นแค่หลักฐานว่าผ่านเกณฑ์ของแอปแล้ว (theory = ผ่าน post-test, practical = ผ่านวันปฏิบัติ)

export const CERT_STATE = {
  hub: 'hub', // ได้ใบจากระบบกลางแล้ว
  waiting: 'waiting', // ผ่านเกณฑ์ที่นี่แล้ว แต่ระบบกลางยังไม่ออกใบ
  none: 'none', // ยังไม่ผ่านเกณฑ์
}

const issuedOf = (list, kind) =>
  (list || []).find((c) => c.courseId === HUB_COURSE_ID && c.status === 'issued' && (kind === 'practical' ? c.kind === 'practical' : c.kind !== 'practical')) || null

const pick = (c) => c && { number: c.number, verifyPath: c.verifyPath, issuedAt: c.issuedAt }

// rows ของ enrollments + certificates ของแอปนี้ + line_identities + ใบจากระบบกลางต่อบัญชี → แถวของแท็บ
// attendance: แถว attendance ที่อนุมัติแล้วของรอบอบรมในคลาสนี้ [{ id, learner_id, session_id }] — ใช้บอกว่า
// ใครมาอบรมจริง และเปิดให้ "ให้ผ่านภาคปฏิบัติ" ได้เฉพาะคนที่มาแล้วแต่ยังไม่มีใบ (grantPractical.js)
export function buildClassCertificates({ enrollments = [], certificates = [], identities = [], hubByUser = {}, attendance = [] }) {
  const attendedBy = new Map()
  for (const a of attendance) if (a.learner_id && !attendedBy.has(a.learner_id)) attendedBy.set(a.learner_id, a)
  const own = new Map()
  for (const c of certificates) own.set(`${c.learner_id}:${c.kind}`, c)
  const userOf = new Map(identities.map((i) => [i.learner_id, i.auth_user_id]))

  const rows = enrollments.map((e) => {
    const userId = userOf.get(e.learner_id) || null
    const hub = userId ? hubByUser[userId] || [] : []
    const hubTheory = issuedOf(hub, 'online')
    const hubPractical = issuedOf(hub, 'practical')
    const ownTheory = own.get(`${e.learner_id}:theory`)
    const ownPractical = own.get(`${e.learner_id}:practical`)

    const theory = hubTheory ? { state: CERT_STATE.hub, ...pick(hubTheory) }
      : ownTheory ? { state: CERT_STATE.waiting, reason: userId ? 'ให้นักเรียนเปิดหน้าใบประกาศเพื่อรับใบจากระบบกลาง' : 'นักเรียนยังไม่ได้เข้าสู่ระบบด้วย LINE' }
        : { state: CERT_STATE.none, reason: 'ยังไม่ผ่าน Post-test' }
    const practical = hubPractical ? { state: CERT_STATE.hub, ...pick(hubPractical) }
      : ownPractical ? {
        state: CERT_STATE.waiting,
        reason: !userId ? 'นักเรียนยังไม่ได้เข้าสู่ระบบด้วย LINE'
          : !hubTheory ? 'รอใบภาคทฤษฎีจากระบบกลางก่อน'
            : 'ยังไม่ได้ส่งผลเข้าระบบกลาง — กด "ส่งผลที่ค้าง"',
      }
        : attendedBy.has(e.learner_id)
          ? { state: CERT_STATE.none, reason: 'มาอบรมแล้ว แต่ยังไม่ได้บันทึกผลสอบ — ติ๊กให้ผ่านภาคปฏิบัติได้' }
          : { state: CERT_STATE.none, reason: 'ยังไม่ได้มาอบรมภาคปฏิบัติ' }
    const att = attendedBy.get(e.learner_id)

    return {
      learnerId: e.learner_id,
      name: e.name || '',
      phone: e.phone || '',
      group: e.group_label || null,
      hasAccount: !!userId,
      attended: !!att,
      theory,
      practical,
      // ใช้ตอนกด "ส่งผลที่ค้าง" เท่านั้น (ไม่ส่งออกไปหน้าเว็บ)
      _resend: practical.state === CERT_STATE.waiting && userId ? { userId, attendanceId: ownPractical.source_ref } : null,
      // ให้ผ่านภาคปฏิบัติได้: มาอบรม (อนุมัติแล้ว) แต่ยังไม่มีใบภาคปฏิบัติ — คนที่ไม่มาไม่มีทางได้ใบจากปุ่มนี้
      _grant: att && !ownPractical && !hubPractical ? { attendanceId: att.id, sessionId: att.session_id } : null,
    }
  })

  const count = (k, s) => rows.filter((r) => r[k].state === s).length
  return {
    rows,
    totals: {
      learners: rows.length,
      theoryHub: count('theory', CERT_STATE.hub),
      theoryWaiting: count('theory', CERT_STATE.waiting),
      practicalHub: count('practical', CERT_STATE.hub),
      practicalWaiting: count('practical', CERT_STATE.waiting),
      resendable: rows.filter((r) => r._resend).length,
      grantable: rows.filter((r) => r._grant).length,
    },
  }
}

export const publicRows = (rows) => rows.map(({ _resend, _grant, ...r }) => ({ ...r, canResend: !!_resend, canGrant: !!_grant }))

// โหลดทุกอย่างของคลาสเดียว (สูงสุด 200 คน — เท่ากับเพดานของระบบกลาง) Throws on database errors.
export async function loadClassCertificates(admin, cohortId) {
  const { data: enrollments, error: eErr } = await admin
    .from('enrollments')
    .select('learner_id, name, phone, group_label')
    .eq('cohort_id', cohortId)
    .order('joined_at')
    .limit(200)
  if (eErr) throw eErr
  const ids = [...new Set((enrollments || []).map((e) => e.learner_id))]
  if (!ids.length) return { ...buildClassCertificates({}), hubError: null }

  const [{ data: certificates, error: cErr }, { data: identities, error: iErr }] = await Promise.all([
    admin.from('certificates').select('learner_id, kind, source_ref').in('learner_id', ids),
    admin.from('line_identities').select('learner_id, auth_user_id').in('learner_id', ids),
  ])
  if (cErr) throw cErr
  if (iErr) throw iErr

  // ใครมาอบรมจริง: attendance ที่อนุมัติแล้วของรอบอบรมในคลาสนี้ (ล่าสุดก่อน)
  const { data: sessions, error: sErr } = await admin.from('practical_sessions').select('id').eq('cohort_id', cohortId)
  if (sErr) throw sErr
  let attendance = []
  const sessionIds = (sessions || []).map((x) => x.id)
  if (sessionIds.length) {
    const { data, error } = await admin.from('attendance')
      .select('id, learner_id, session_id, checked_in_at')
      .in('session_id', sessionIds)
      .eq('status', 'approved')
      .order('checked_in_at', { ascending: false })
    if (error) throw error
    attendance = data || []
  }

  // ระบบกลางล่มไม่ทำให้ทั้งแท็บพัง: แสดงสถานะฝั่งนี้ พร้อมบอกว่าเช็คระบบกลางไม่ได้
  let hubByUser = {}
  let hubError = null
  const userIds = [...new Set((identities || []).map((i) => i.auth_user_id).filter(Boolean))]
  if (userIds.length) {
    try {
      const { data, error } = await admin.rpc('jia_results', {
        action: 'certificatesForUsers', payload: { sourceClient: HUB_RESULTS_CLIENT, userIds },
      })
      if (error) throw error
      hubByUser = data?.users || {}
    } catch (err) {
      console.error('class certificates: hub lookup failed (non-fatal)', err)
      hubError = 'เช็คใบจากระบบกลางไม่ได้ตอนนี้'
    }
  }
  return { ...buildClassCertificates({ enrollments, certificates, identities, hubByUser, attendance }), hubError }
}

// "ส่งผลที่ค้าง": ส่งผลภาคปฏิบัติของทุกคนที่ผ่านที่นี่แล้วแต่ยังไม่มีใบจากระบบกลาง (ซ้ำได้ ระบบกลางกันซ้ำเอง)
export async function resendPendingPractical(admin, cohortId) {
  const { rows, hubError } = await loadClassCertificates(admin, cohortId)
  if (hubError) return { error: hubError }
  const out = { sent: 0, issued: 0, pending: [] }
  for (const r of rows) {
    if (!r._resend) continue
    const res = await recordPracticalAtHub(admin, { learnerId: r.learnerId, ...r._resend })
    out.sent += 1
    if (res.certificate) out.issued += 1
    else out.pending.push({ name: r.name, reason: res.pending || res.failed || res.skipped || 'ยังออกไม่ได้' })
  }
  return out
}
