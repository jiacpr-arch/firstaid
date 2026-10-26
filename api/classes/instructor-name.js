import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { cleanInstructorName } from '../_lib/classes.js'

// ชื่อผู้สอนของรอบอบรม (practical_sessions.instructor_name) — พิมพ์บนใบประกาศภาคปฏิบัติของระบบกลาง
// GET ?sessionId=… อ่าน, POST { sessionId, instructorName } ตั้ง/แก้ (ว่าง = ไม่ระบุ) — แอดมินเท่านั้น
// ใบที่ระบบกลางออกไปแล้วไม่เปลี่ยนตาม: ชื่อนี้ใช้กับผลที่ส่งหลังจากนี้
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  if (rateLimited(req, res, { key: 'class-instructor-name', limit: 60, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()

  const sessionId = req.method === 'GET' ? req.query?.sessionId : req.body?.sessionId
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) { res.status(400).json({ error: 'Missing sessionId' }); return }

  if (req.method === 'POST') {
    const raw = req.body?.instructorName
    const name = cleanInstructorName(raw)
    if (typeof raw === 'string' && raw.trim() && !name) { res.status(400).json({ error: 'ชื่อผู้สอนสั้นเกินไป' }); return }
    const { error } = await admin.from('practical_sessions').update({ instructor_name: name }).eq('id', sessionId)
    if (error) { console.error('instructor name update failed', error); res.status(500).json({ error: 'บันทึกไม่สำเร็จ' }); return }
  }

  const { data, error } = await admin.from('practical_sessions').select('instructor_name').eq('id', sessionId).maybeSingle()
  if (error || !data) { res.status(404).json({ error: 'ไม่พบรอบอบรมนี้' }); return }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ instructorName: data.instructor_name || '' })
}
