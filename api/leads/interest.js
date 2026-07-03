import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'
import { rateLimited, sanitizeLine } from '../_lib/rateLimit.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'interest', limit: 5, windowMs: 60_000 })) return

  const { name, phone, learnerId, source } = req.body || {}
  if (!name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: 'name and phone required' })
    return
  }

  const admin = getSupabaseAdmin()
  if (admin) {
    await admin.from('course_interest').insert({
      learner_id: learnerId || null,
      name: name.trim().slice(0, 120),
      phone: phone.trim().slice(0, 40),
      source: source || 'unknown',
    }).catch((err) => console.error('course_interest insert failed', err))
  }

  await notifyAdminLine(
    `🎯 สนใจคลาสปฏิบัติ\nชื่อ: ${sanitizeLine(name)}\nโทร: ${sanitizeLine(phone, 40)}\nSource: ${sanitizeLine(source || 'unknown', 40)}`
  )

  res.status(200).json({ ok: true })
}
