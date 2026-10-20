import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'

// รายชื่อนักเรียนของ cohort ที่ผูกกับ session (enrollments อ่านได้เฉพาะ service role)
// ใช้ทำรายการเช็คชื่อมือในหน้า AdminSessionDetail
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
    .from('practical_sessions').select('id, cohort_id').eq('id', sessionId).single()
  if (!session) { res.status(404).json({ error: 'Session not found' }); return }
  if (!session.cohort_id) { res.status(200).json({ roster: [] }); return }

  const { data, error } = await admin
    .from('enrollments')
    .select('learner_id, name, phone')
    .eq('cohort_id', session.cohort_id)
    .order('name')
    .limit(500)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ roster: data || [] })
}
