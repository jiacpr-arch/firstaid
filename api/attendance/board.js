import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'

// กระดานสถานี: นักเรียนทุกคนที่เช็คชื่อใน session × ฐานทั้งหมด
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const sessionId = req.query?.sessionId
  if (!sessionId) { res.status(400).json({ error: 'Missing sessionId' }); return }
  const actor = await authorizeInstructor(req, res, admin, sessionId)
  if (!actor) return

  const { data: session } = await admin
    .from('practical_sessions').select('cohort_id').eq('id', sessionId).maybeSingle()

  const [st, att, ck, en] = await Promise.all([
    admin.from('session_stations').select('id, name, kind, sort_order')
      .eq('session_id', sessionId).order('sort_order').order('created_at'),
    admin.from('attendance').select('learner_id, learner_name, learner_phone, status')
      .eq('session_id', sessionId).neq('status', 'rejected').order('checked_in_at'),
    admin.from('station_checkins')
      .select('station_id, learner_id, checked_in_at, passed, score, checklist_id')
      .eq('session_id', sessionId),
    // กลุ่มฝึก A–D อยู่ที่ enrollments ของคลาส (api/attendance/group.js)
    session?.cohort_id
      ? admin.from('enrollments').select('learner_id, group_label').eq('cohort_id', session.cohort_id)
      : Promise.resolve({ data: [], error: null }),
  ])
  const err = st.error || att.error || ck.error || en.error
  if (err) { res.status(500).json({ error: err.message }); return }

  const byLearner = new Map()
  for (const c of ck.data || []) {
    if (!byLearner.has(c.learner_id)) byLearner.set(c.learner_id, {})
    byLearner.get(c.learner_id)[c.station_id] = {
      checkedInAt: c.checked_in_at, passed: c.passed, score: c.score, checklistId: c.checklist_id,
    }
  }
  const groups = new Map((en.data || []).map((e) => [e.learner_id, e.group_label || null]))
  const rows = (att.data || []).map((a) => ({
    learnerId: a.learner_id,
    name: a.learner_name,
    phone: a.learner_phone,
    groupLabel: groups.get(a.learner_id) || null,
    checkins: byLearner.get(a.learner_id) || {},
  }))
  res.status(200).json({ stations: st.data || [], rows })
}
