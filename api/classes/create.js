import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited, sanitizeLine } from '../_lib/rateLimit.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'
import { createClass } from '../_lib/classes.js'

// ผู้สอนสร้างคลาสใหม่จากในแอป (ไม่ต้องมีบัญชี แบบ ACLS) — คืนรหัสคลาส + รหัสผู้สอน
// เปิดสาธารณะ จึงจำกัดอัตราต่อ IP และแจ้งแอดมินทาง LINE ทุกครั้งที่มีคลาสใหม่
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'class-create', limit: 5, windowMs: 60 * 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''
  const location = typeof req.body?.location === 'string' ? req.body.location.trim().slice(0, 120) : ''
  if (name.length < 2) { res.status(400).json({ error: 'กรุณาตั้งชื่อคลาส (อย่างน้อย 2 ตัวอักษร)' }); return }

  try {
    const cls = await createClass(admin, { name, location: location || null })
    // ไม่ส่งรหัสผู้สอนเข้า LINE — แจ้งแค่ว่ามีคลาสใหม่
    notifyAdminLine(
      `🆕 มีคนสร้างคลาสใหม่จากแอป\nชื่อ: ${sanitizeLine(name, 80)}\nรหัสคลาส: ${cls.classCode}`,
    ).catch(() => {})
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, ...cls })
  } catch (err) {
    console.error('class create failed', err)
    res.status(500).json({ error: 'สร้างคลาสไม่สำเร็จ ลองใหม่อีกครั้ง' })
  }
}
