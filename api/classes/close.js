import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeClass } from '../_lib/instructorAuth.js'
import { closeClass } from '../_lib/classes.js'

// ปิดคลาส (แอดมิน หรือผู้ถือรหัสผู้สอนของคลาสนั้น) — หลังปิด รหัสผู้สอนใช้ไม่ได้อีก
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const cohortId = req.body?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }
  const actor = await authorizeClass(req, res, admin, { cohortId })
  if (!actor) return

  try {
    await closeClass(admin, cohortId)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'close failed' })
  }
}
