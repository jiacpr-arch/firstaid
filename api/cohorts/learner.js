import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { buildLearnerDetail } from '../_lib/learnerDetail.js'

// หน้ารายละเอียดต่อนักเรียน: ความคืบหน้าเรียนออนไลน์ + เช็คชื่อ/ฐานปฏิบัติของคลาสนี้ + ใบเซอร์
// ตาราง progress เป็น service-role only จึงอ่านผ่าน endpoint นี้ (requireAdmin) เท่านั้น
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const cohortId = req.query?.cohortId
  const learnerId = req.query?.learnerId
  if (!cohortId || !learnerId) { res.status(400).json({ error: 'Missing cohortId or learnerId' }); return }

  try {
    // นักเรียนต้องอยู่ในคลาสนี้จริง — กันดึงข้อมูลคนนอกคลาสผ่าน id
    const { data: enrollment, error: eErr } = await admin
      .from('enrollments')
      .select('learner_id, name, phone, joined_at')
      .eq('cohort_id', cohortId)
      .eq('learner_id', learnerId)
      .maybeSingle()
    if (eErr) throw eErr
    if (!enrollment) { res.status(404).json({ error: 'Learner not found in this cohort' }); return }

    const { data: cohort } = await admin.from('cohorts').select('id, name').eq('id', cohortId).maybeSingle()
    const { data: sessions, error: sErr } = await admin
      .from('practical_sessions').select('id, title, starts_at')
      .eq('cohort_id', cohortId).order('starts_at')
    if (sErr) throw sErr
    const sessionIds = (sessions || []).map((s) => s.id)

    const own = (table, columns) => admin.from(table).select(columns).eq('learner_id', learnerId)
    const [lp, qa, ea, sr, gr, att, certs] = await Promise.all([
      own('lesson_progress', 'lesson_id, read_at'),
      own('quiz_attempts', 'lesson_id, passed, finished_at'),
      own('exam_attempts', 'kind, score, passed, finished_at'),
      own('simulation_runs', 'scenario_id, passed, finished_at'),
      own('game_results', 'score, grade, won, finished_at'),
      sessionIds.length
        ? own('attendance', 'session_id, status, checked_in_at').in('session_id', sessionIds)
        : { data: [] },
      own('certificates', 'kind, code, issued_at, revoked_at'),
    ])
    for (const r of [lp, qa, ea, sr, gr, att, certs]) if (r.error) throw r.error

    let stations = []
    let stationCheckins = []
    if (sessionIds.length) {
      const [st, ck] = await Promise.all([
        admin.from('session_stations').select('id, session_id, name, kind, sort_order').in('session_id', sessionIds),
        own('station_checkins', 'station_id, checked_in_at, passed, score').in('session_id', sessionIds),
      ])
      if (st.error) throw st.error
      if (ck.error) throw ck.error
      stations = st.data || []
      stationCheckins = ck.data || []
    }

    const detail = buildLearnerDetail({
      enrollment,
      lessonProgress: lp.data || [],
      quizAttempts: qa.data || [],
      examAttempts: ea.data || [],
      simulationRuns: sr.data || [],
      gameResults: gr.data || [],
      sessions: sessions || [],
      attendance: att.data || [],
      stations,
      stationCheckins,
      certificates: certs.data || [],
    })

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, cohort: cohort ? { id: cohort.id, name: cohort.name } : null, ...detail })
  } catch (err) {
    res.status(500).json({ error: err.message || 'learner detail failed' })
  }
}
