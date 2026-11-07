import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'
import { issuePracticalCertificate } from '../_lib/issuePractical.js'
import { resolveStudent, approveAttendance, loadOpenSession } from '../_lib/attendanceCheckin.js'
import { missingPracticeStations, validateExamResult, planBulkCheckin, fullPassResult } from '../_lib/stationLogic.js'
import { FIRST_AID_CHECKLISTS } from '../../src/data/checklists/firstAidChecklists.js'
import { suggestedChecklistId } from '../../src/data/checkinStations.js'

// POST { sessionId, stationId, payload | learnerId }            → เช็คชื่อเข้าฐาน
// POST { action:'result', sessionId, stationId, learnerId, passed, score?, checklistId?, checklistItems?, note? }
//                                                               → บันทึกผลฐานสอบ
// POST { action:'undo', sessionId, stationId, learnerId }       → ยกเลิกการเช็คชื่อ/ผลของฐานนั้น
// POST { action:'bulk', sessionId, payload | learnerId, stationIds:[...], examPassed? }
//      → สแกนครั้งเดียว เช็คชื่อหลายฐานพร้อมกัน; examPassed:true = ฐานสอบที่เลือก "ผ่านครบทุกข้อ"
//        (คอร์สนี้ผู้ผ่านต้องทำได้ครบทุกข้ออยู่แล้ว) — ไม่ส่ง = เช็คชื่อฐานสอบไว้ รอให้คะแนนรายข้อ
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { action, sessionId, stationId, payload, learnerId } = req.body || {}
  const bulk = action === 'bulk'
  const actor = await authorizeInstructor(req, res, admin, sessionId)
  if (!actor) return
  if (!sessionId || (!stationId && !bulk) || (!payload && !learnerId)) {
    res.status(400).json({ error: 'Missing fields' }); return
  }

  const s = await loadOpenSession(admin, sessionId)
  if (s.error) { res.status(s.status).json({ error: s.error }); return }

  const { data: stations, error: stErr } = await admin
    .from('session_stations').select('id, name, kind').eq('session_id', sessionId)
  if (stErr) { res.status(500).json({ error: stErr.message }); return }
  const station = (stations || []).find((x) => x.id === stationId)
  if (!station && !bulk) { res.status(404).json({ error: 'ไม่พบสถานีนี้ใน session' }); return }

  const r = await resolveStudent(admin, s.session, { payload, learnerId })
  if (r.error) { res.status(r.status).json({ error: r.error }); return }
  const student = r.student

  if (bulk) {
    const { data: done, error: dErr } = await admin.from('station_checkins').select('station_id, passed')
      .eq('session_id', sessionId).eq('learner_id', student.id)
    if (dErr) { res.status(500).json({ error: dErr.message }); return }
    const plan = planBulkCheckin(stations || [], (done || []).map((d) => d.station_id), req.body.stationIds)
    if (!plan.ok) { res.status(409).json({ error: plan.error, student }); return }

    const a = await approveAttendance(admin, s.session, student, actor.user, r.method)
    if (a.error) { res.status(500).json({ error: a.error }); return }

    if (plan.insertIds.length) {
      const { error } = await admin.from('station_checkins').insert(plan.insertIds.map((id) => ({
        session_id: sessionId, station_id: id, learner_id: student.id, checked_in_by: actor.user?.id ?? null,
      })))
      if (error) { res.status(500).json({ error: error.message }); return }
    }

    // ฐานสอบ: ผ่านครบทุกข้อ (ใช้ใบประเมินที่ตรงกับชื่อฐาน) — ผลที่บันทึกไว้แล้วไม่ทับ
    const examPassed = req.body.examPassed === true
    let passedExam = false
    if (examPassed) {
      const already = new Map((done || []).map((d) => [d.station_id, d.passed]))
      for (const id of plan.examIds) {
        if (already.get(id) != null) { passedExam = passedExam || already.get(id) === true; continue }
        const st = stations.find((x) => x.id === id)
        const checklistId = suggestedChecklistId(st.name)
        const full = fullPassResult(checklistId ? FIRST_AID_CHECKLISTS[checklistId] : null)
        const { error } = await admin.from('station_checkins').update({
          passed: true, score: full.score, checklist_id: checklistId, checklist_items: full.items,
          note: 'ผ่านครบทุกข้อ — ผู้สอนบันทึกแบบรวม',
        }).eq('station_id', id).eq('learner_id', student.id)
        if (error) { res.status(500).json({ error: error.message }); return }
        passedExam = true
      }
    }
    // ใบเซอร์ภาคปฏิบัติออกเมื่อสอบผ่าน (เหมือนบันทึกผลทีละฐาน)
    if (passedExam && a.attendanceId) await issuePracticalCertificate(admin, a.attendanceId).catch(() => {})
    res.status(200).json({
      ok: true, student, attendanceId: a.attendanceId || null,
      added: plan.insertIds.length, examIds: plan.examIds, examPassed: passedExam,
    })
    return
  }

  if (action === 'undo') {
    const { error } = await admin.from('station_checkins')
      .delete().eq('station_id', stationId).eq('learner_id', student.id)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ ok: true, student })
    return
  }

  if (action === 'result') {
    if (station.kind !== 'exam') { res.status(422).json({ error: 'บันทึกผลได้เฉพาะฐานสอบ' }); return }
    const { passed, checklistId, checklistItems, note } = req.body
    if (typeof passed !== 'boolean') { res.status(400).json({ error: 'Missing passed' }); return }
    const id = typeof checklistId === 'string' ? checklistId.slice(0, 60) : null
    const v = validateExamResult({
      checklist: id ? FIRST_AID_CHECKLISTS[id] || null : null, checklistId: id, checklistItems, passed,
    })
    if (!v.ok) { res.status(422).json({ error: v.error }); return }
    const { data: existing } = await admin.from('station_checkins').select('id')
      .eq('station_id', stationId).eq('learner_id', student.id).maybeSingle()
    if (!existing) { res.status(409).json({ error: 'ต้องเช็คชื่อเข้าฐานสอบก่อนบันทึกผล' }); return }
    const { error } = await admin.from('station_checkins').update({
      passed,
      score: v.score,
      checklist_id: id,
      checklist_items: v.items,
      note: typeof note === 'string' ? note.slice(0, 500) : null,
    }).eq('id', existing.id)
    if (error) { res.status(500).json({ error: error.message }); return }
    const a = await approveAttendance(admin, s.session, student, actor.user, r.method)
    // ในคลาสที่มีสถานี ใบเซอร์ภาคปฏิบัติออกเมื่อสอบผ่านเท่านั้น
    if (passed && a.attendanceId) await issuePracticalCertificate(admin, a.attendanceId).catch(() => {})
    res.status(200).json({ ok: true, student, attendanceId: a.attendanceId || null })
    return
  }

  // เช็คชื่อเข้าฐาน — ฐานสอบต้องผ่านฐานฝึกครบก่อน
  if (station.kind === 'exam') {
    const { data: done } = await admin.from('station_checkins').select('station_id')
      .eq('session_id', sessionId).eq('learner_id', student.id)
    const missing = missingPracticeStations(stations, (done || []).map((d) => d.station_id))
    if (missing.length > 0) {
      res.status(409).json({
        error: `ยังเช็คชื่อฐานฝึกไม่ครบ: ${missing.map((m) => m.name).join(', ')}`,
        student,
      })
      return
    }
  }

  const a = await approveAttendance(admin, s.session, student, actor.user, r.method)
  if (a.error) { res.status(500).json({ error: a.error }); return }

  const { data: existing } = await admin.from('station_checkins').select('id, passed')
    .eq('station_id', stationId).eq('learner_id', student.id).maybeSingle()
  if (existing) {
    res.status(200).json({ ok: true, duplicate: true, student, passed: existing.passed, attendanceId: a.attendanceId })
    return
  }
  const { error } = await admin.from('station_checkins').insert({
    session_id: sessionId,
    station_id: stationId,
    learner_id: student.id,
    checked_in_by: actor.user?.id ?? null,
  })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ ok: true, duplicate: false, student, passed: null, attendanceId: a.attendanceId })
}
