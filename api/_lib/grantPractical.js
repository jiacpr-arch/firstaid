import { loadClassCertificates } from './classCertificates.js'
import { issuePracticalCertificate } from './issuePractical.js'

// "ให้ผ่านภาคปฏิบัติ" ย้อนหลังจากแท็บใบประกาศของคลาส (/admin/teach) — ใช้เมื่อวันอบรมครูไม่ได้บันทึกผล
// ฐานสอบในแอป (หน้าสแกนต้องสแกน QR จากมือถือนักเรียน ทำย้อนหลังไม่ได้) แอดมินยืนยันว่าประเมินแล้วผ่านจริง
//
// กติกา: ให้ได้เฉพาะคนที่ "มาอบรมแล้ว" (attendance อนุมัติแล้ว) และยังไม่มีใบภาคปฏิบัติ — คนที่ไม่มาไม่มีทาง
// ได้ใบจากทางนี้ รอบที่มีสถานี: บันทึกผ่านที่ฐานสอบ (หมายเหตุว่าให้ผ่านย้อนหลังโดยใคร) แล้วออกใบด้วย
// issuePracticalCertificate ตัวเดียวกับหน้าสแกน — ยังไม่มีใบทฤษฎีจะรอไว้ แล้วออกเองเมื่อผ่าน Post-test
// (retryPracticalForLearner) รอบที่ไม่มีสถานี การเช็คชื่อที่อนุมัติแล้วพอ ออกใบได้เลย

// ฐานสอบที่ใช้บันทึก: ชื่อมีคำว่า "สอบ" ก่อน ไม่งั้นฐานสอบตัวสุดท้ายตามลำดับ
export function pickExamStation(stations = []) {
  const exams = stations.filter((s) => s.kind === 'exam')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return exams.find((s) => /สอบ/.test(s.name || '')) || exams[exams.length - 1] || null
}

export async function grantPractical(admin, cohortId, learnerIds, actor, { issue = issuePracticalCertificate, load = loadClassCertificates } = {}) {
  const wanted = new Set(learnerIds)
  const { rows } = await load(admin, cohortId)
  const out = { issued: [], waitingTheory: [], skipped: [] }
  const stationsBySession = new Map()
  const note = `ให้ผ่านภาคปฏิบัติย้อนหลัง (แท็บใบประกาศ) โดย ${actor?.email || actor?.id || 'แอดมิน'}`

  for (const r of rows) {
    if (!wanted.has(r.learnerId)) continue
    wanted.delete(r.learnerId)
    const name = r.name || '(ไม่ระบุชื่อ)'
    if (!r._grant) {
      out.skipped.push({ name, reason: r.attended ? 'มีใบภาคปฏิบัติแล้ว' : 'ไม่ได้มาอบรม' })
      continue
    }
    const { attendanceId, sessionId } = r._grant

    if (!stationsBySession.has(sessionId)) {
      const { data, error } = await admin.from('session_stations')
        .select('id, name, kind, sort_order').eq('session_id', sessionId)
      if (error) throw error
      stationsBySession.set(sessionId, data || [])
    }
    const stations = stationsBySession.get(sessionId)
    if (stations.length) {
      const exam = pickExamStation(stations)
      if (!exam) { out.skipped.push({ name, reason: 'รอบอบรมนี้ไม่มีฐานสอบ' }); continue }
      const result = { passed: true, note }
      const { data: existing, error: xErr } = await admin.from('station_checkins').select('id')
        .eq('station_id', exam.id).eq('learner_id', r.learnerId).maybeSingle()
      if (xErr) throw xErr
      const { error } = existing
        ? await admin.from('station_checkins').update(result).eq('id', existing.id)
        : await admin.from('station_checkins').insert({
          session_id: sessionId, station_id: exam.id, learner_id: r.learnerId,
          checked_in_by: actor?.id ?? null, ...result,
        })
      if (error) throw error
    }

    const res = await issue(admin, attendanceId)
    if (res.status === 200) out.issued.push(name)
    else if (res.status === 202) out.waitingTheory.push(name)
    else out.skipped.push({ name, reason: res.body?.error || 'ออกใบไม่สำเร็จ' })
  }
  if (wanted.size) out.skipped.push({ name: `(ไม่อยู่ในคลาสนี้ ${wanted.size} คน)`, reason: 'ไม่พบในคลาส' })
  return out
}
