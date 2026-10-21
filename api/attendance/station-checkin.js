import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'
import { issuePracticalCertificate } from '../_lib/issuePractical.js'
import { resolveStudent, approveAttendance, loadOpenSession } from '../_lib/attendanceCheckin.js'
import { missingPracticeStations, validateExamResult } from '../_lib/stationLogic.js'
import { FIRST_AID_CHECKLISTS } from '../../src/data/checklists/firstAidChecklists.js'

// POST { sessionId, stationId, payload | learnerId }            → เช็คชื่อเข้าฐาน
// POST { action:'result', sessionId, stationId, learnerId, passed, score?, checklistId?, checklistItems?, note? }
//                                                               → บันทึกผลฐานสอบ
// POST { action:'undo', sessionId, stationId, learnerId }       → ยกเลิกการเช็คชื่อ/ผลของฐานนั้น
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { action, sessionId, stationId, payload, learnerId } = req.body || {}
  const actor = await authorizeInstructor(req, res, admin, sessionId)
  if (!actor) return
  if (!sessionId || !stationId || (!payload && !learnerId)) {
    res.status(400).json({ error: 'Missing fields' }); return
  }

  const s = await loadOpenSession(admin, sessionId)
  if (s.error) { res.status(s.status).json({ error: s.error }); return }

  const { data: stations, error: stErr } = await admin
    .from('session_stations').select('id, name, kind').eq('session_id', sessionId)
  if (stErr) { res.status(500).json({ error: stErr.message }); return }
  const station = (stations || []).find((x) => x.id === stationId)
  if (!station) { res.status(404).json({ error: 'ไม่พบสถานีนี้ใน session' }); return }

  const r = await resolveStudent(admin, s.session, { payload, learnerId })
  if (r.error) { res.status(r.status).json({ error: r.error }); return }
  const student = r.student

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
