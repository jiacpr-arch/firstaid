import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { generateInstructorCode, verifySessionCode } from '../_lib/instructorAuth.js'

// รหัสผู้สอนต่อ session
//   POST { action:'verify', sessionId, code }  — สาธารณะ (จำกัดอัตรา) ใช้ตอนผู้ช่วยใส่รหัสที่หน้า /scan/:id
//   GET  ?sessionId=                           — แอดมิน: ดูรหัสปัจจุบัน
//   POST { action:'create'|'rotate', sessionId } — แอดมิน: สร้างรหัส (create ไม่ทับของเดิม) / เปลี่ยนรหัสใหม่
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  if (req.method === 'POST' && req.body?.action === 'verify') {
    if (rateLimited(req, res, { key: 'instructor-code-verify', limit: 10, windowMs: 60_000 })) return
    const { sessionId, code } = req.body
    if (!sessionId || !code) { res.status(400).json({ error: 'Missing fields' }); return }
    const v = await verifySessionCode(admin, sessionId, code)
    if (!v.ok) { res.status(v.status).json({ error: v.error }); return }
    res.status(200).json({ ok: true })
    return
  }

  const user = await requireAdmin(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const sessionId = req.query?.sessionId
    if (!sessionId) { res.status(400).json({ error: 'Missing sessionId' }); return }
    const { data, error } = await admin
      .from('practical_sessions').select('instructor_code').eq('id', sessionId).maybeSingle()
    if (error) { res.status(500).json({ error: error.message }); return }
    if (!data) { res.status(404).json({ error: 'Session not found' }); return }
    res.status(200).json({ code: data.instructor_code || null })
    return
  }

  if (req.method === 'POST') {
    const { action, sessionId } = req.body || {}
    if (!sessionId || !['create', 'rotate'].includes(action)) {
      res.status(400).json({ error: 'Missing fields' }); return
    }
    const { data: session } = await admin
      .from('practical_sessions').select('id, instructor_code').eq('id', sessionId).maybeSingle()
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }
    if (action === 'create' && session.instructor_code) {
      res.status(200).json({ code: session.instructor_code }); return
    }
    const code = generateInstructorCode()
    const { error } = await admin
      .from('practical_sessions').update({ instructor_code: code }).eq('id', sessionId)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ code })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
