import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'

const BUCKET = 'lesson-media'

// จุดเดียวสำหรับงานเขียนสื่อบทเรียนของแอดมิน (แทนการเขียนตรงด้วย anon key ซึ่ง
// ต้องเปิด RLS กว้างจนใครก็เขียนได้) — ทุก action ผ่าน requireAdmin
//   action: 'sign-upload' { path, contentType }  → คืน { token, path } ให้ client
//           อัปไฟล์เองผ่าน uploadToSignedUrl (รองรับไฟล์ใหญ่ ไม่ติด body limit)
//   action: 'insert'      { row }                → insert public.lesson_media
//   action: 'delete'      { id }                 → delete public.lesson_media
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'media-admin', limit: 60, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return

  const { action } = req.body || {}

  if (action === 'sign-upload') {
    const { path } = req.body
    // จำกัด path ให้อยู่ในโฟลเดอร์ images/ หรือ videos/ และเป็นอักขระปลอดภัยเท่านั้น
    if (!/^(images|videos)\/[a-z0-9][a-z0-9.-]*$/.test(path || '')) {
      res.status(400).json({ error: 'Invalid path' })
      return
    }
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ token: data.token, path: data.path })
    return
  }

  if (action === 'insert') {
    const { row } = req.body
    if (!row || typeof row !== 'object') { res.status(400).json({ error: 'Missing row' }); return }
    const ALLOWED = ['content_type', 'lesson_id', 'after_step', 'step_id', 'kind', 'url', 'youtube', 'caption', 'alt']
    const clean = Object.fromEntries(Object.entries(row).filter(([k]) => ALLOWED.includes(k)))
    const { data, error } = await admin.from('lesson_media').insert(clean).select().single()
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ row: data })
    return
  }

  if (action === 'delete') {
    const { id } = req.body
    if (!id) { res.status(400).json({ error: 'Missing id' }); return }
    const { error } = await admin.from('lesson_media').delete().eq('id', id)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ ok: true })
    return
  }

  res.status(400).json({ error: 'Unknown action' })
}
