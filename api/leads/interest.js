import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { name, phone, learnerId, source } = req.body || {}
  if (!name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: 'name and phone required' })
    return
  }

  const admin = getSupabaseAdmin()
  if (admin) {
    await admin.from('course_interest').insert({
      learner_id: learnerId || null,
      name: name.trim(),
      phone: phone.trim(),
      source: source || 'unknown',
    }).catch((err) => console.error('course_interest insert failed', err))
  }

  await notifyAdminLine(
    `🎯 สนใจคลาสปฏิบัติ\nชื่อ: ${name.trim()}\nโทร: ${phone.trim()}\nSource: ${source || 'unknown'}`
  )

  res.status(200).json({ ok: true })
}
