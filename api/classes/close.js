import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { closeClass } from '../_lib/classes.js'

// แอดมินปิดคลาส — หลังปิด รหัสผู้ช่วยใช้ไม่ได้อีก (ไม่ลบข้อมูล)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const cohortId = req.body?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }

  try {
    await closeClass(admin, cohortId)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'close failed' })
  }
}
