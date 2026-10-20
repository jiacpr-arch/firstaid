import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { findClassByInstructorCode } from '../_lib/classes.js'

// เชื่อมคลาสเดิมบนเครื่องอื่นด้วยรหัสผู้สอน — คืนข้อมูลคลาส (ไม่คืนรหัสผู้สอนกลับ)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'class-verify', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const r = await findClassByInstructorCode(admin, req.body?.instructorCode)
  if (!r.cls) { res.status(r.status).json({ error: r.error }); return }

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, ...r.cls })
}
