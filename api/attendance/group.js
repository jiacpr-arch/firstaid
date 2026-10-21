import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeClass } from '../_lib/instructorAuth.js'

const GROUPS = new Set(['A', 'B', 'C', 'D', 'E', 'F'])

// ตั้งกลุ่มฝึก (A–D) ให้นักเรียนในวันเรียนจริง — แอดมิน หรือผู้ช่วยที่ใช้รหัสของคลาส/รอบนั้น
// POST { sessionId | cohortId, learnerId, groupLabel }  (groupLabel ว่าง = เอาออกจากกลุ่ม)
// ระบุ session ได้ → ใช้ cohort ของ session นั้นเสมอ (รหัสผู้ช่วยของรอบหนึ่งแก้คลาสอื่นไม่ได้)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { sessionId = null, learnerId } = req.body || {}
  let cohortId = sessionId ? null : req.body?.cohortId || null
  const groupLabel = req.body?.groupLabel ? String(req.body.groupLabel).toUpperCase() : null
  if ((!sessionId && !cohortId) || !learnerId || (groupLabel && !GROUPS.has(groupLabel))) {
    res.status(400).json({ error: 'Missing class/learnerId or invalid group' })
    return
  }

  const actor = await authorizeClass(req, res, admin, { sessionId, cohortId })
  if (!actor) return

  if (sessionId) {
    const { data: session } = await admin
      .from('practical_sessions').select('cohort_id').eq('id', sessionId).maybeSingle()
    cohortId = session?.cohort_id || null
    if (!cohortId) { res.status(404).json({ error: 'Session has no class' }); return }
  }

  const { data, error } = await admin
    .from('enrollments')
    .update({ group_label: groupLabel })
    .eq('cohort_id', cohortId)
    .eq('learner_id', learnerId)
    .select('learner_id')
  if (error) { res.status(500).json({ error: error.message }); return }
  if (!data?.length) { res.status(404).json({ error: 'นักเรียนคนนี้ไม่ได้อยู่ในคลาสนี้' }); return }
  res.status(200).json({ ok: true, groupLabel })
}
