import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { createClass } from '../_lib/classes.js'

// แอดมินสร้างคลาสใหม่ (หน้า /admin/teach) — คืนรหัสคลาส (นักเรียน) + รหัสผู้ช่วย (สแกน/เช็คชื่อ)
// เฉพาะแอดมินเท่านั้น: ไม่มีการสร้างคลาสจากหน้าสาธารณะ
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  if (rateLimited(req, res, { key: 'class-create', limit: 30, windowMs: 60 * 60_000 })) return
  const admin = getSupabaseAdmin()

  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''
  const location = typeof req.body?.location === 'string' ? req.body.location.trim().slice(0, 120) : ''
  if (name.length < 2) { res.status(400).json({ error: 'กรุณาตั้งชื่อคลาส (อย่างน้อย 2 ตัวอักษร)' }); return }
  // คลาสรวม CPR + ปฐมพยาบาล (สร้างโค้ดเรียน CPR ออนไลน์ให้ด้วย — ดู api/_lib/classes.js)
  const includesCpr = req.body?.includesCpr === true
  const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.startsOn || '') ? req.body.startsOn : null
  const seatsNum = Number(req.body?.seats)
  const seats = Number.isInteger(seatsNum) && seatsNum > 0 ? Math.min(seatsNum, 500) : null

  try {
    const cls = await createClass(admin, {
      name, location: location || null, instructorName: req.body?.instructorName, includesCpr, startsOn, seats,
    })
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, ...cls })
  } catch (err) {
    console.error('class create failed', err)
    res.status(500).json({ error: 'สร้างคลาสไม่สำเร็จ ลองใหม่อีกครั้ง' })
  }
}
