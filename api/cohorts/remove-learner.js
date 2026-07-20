import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'

// เอาผู้เรียนออกจากคลาส (ลบแถว enrollments) — ใช้เก็บกวาดเคส join ผิดคลาส,
// join ซ้ำจากสองเครื่อง, หรือแถว anonymous เก่าที่ค้างหลังล็อกอิน LINE
// ลบเฉพาะ enrollment — ความคืบหน้าการเรียนของผู้เรียน (lesson_progress ฯลฯ) ไม่ถูกแตะ
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const { cohortId, learnerId } = req.body || {}
  if (!cohortId || !learnerId) { res.status(400).json({ error: 'Missing cohortId or learnerId' }); return }

  const { error, count } = await admin
    .from('enrollments')
    .delete({ count: 'exact' })
    .eq('cohort_id', cohortId)
    .eq('learner_id', learnerId)
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ ok: true, removed: count ?? 0 })
}
