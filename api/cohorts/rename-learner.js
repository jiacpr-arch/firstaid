import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'

// ครูแก้ชื่อ (และเบอร์) ของนักเรียนในคลาส — แก้เฉพาะแถว enrollments ของคลาสนี้
// ใช้เคสนักเรียนเข้าคลาสด้วยชื่อ LINE/ชื่อเล่น แล้วครูอยากเห็นชื่อจริงในตาราง
// POST { cohortId, learnerId, name, phone? }
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const { cohortId, learnerId } = req.body || {}
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : ''
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 40) : null
  if (!cohortId || !learnerId || name.length < 2) {
    res.status(400).json({ error: 'Missing cohortId/learnerId or name too short' })
    return
  }

  const patch = { name }
  if (phone) patch.phone = phone
  const { data, error } = await admin
    .from('enrollments')
    .update(patch)
    .eq('cohort_id', cohortId)
    .eq('learner_id', learnerId)
    .select('learner_id, name, phone')
  if (error) { res.status(500).json({ error: error.message }); return }
  if (!data?.length) { res.status(404).json({ error: 'นักเรียนคนนี้ไม่ได้อยู่ในคลาสนี้' }); return }
  res.status(200).json({ ok: true, learner: data[0] })
}
