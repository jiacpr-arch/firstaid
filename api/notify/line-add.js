import { notifyAdminLine } from '../_lib/lineNotify.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited, sanitizeLine } from '../_lib/rateLimit.js'

// เรียกจาก client เมื่อผู้เรียนกด "ฉันแอดแล้ว" ใน LinePopup หลังเรียนจบบทแรก
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'line-add', limit: 5, windowMs: 60_000 })) return

  const { learnerId } = req.body || {}
  const learnerLine = learnerId ? `learner: ${sanitizeLine(learnerId, 40)}` : ''

  await notifyAdminLine(
    `📚 มีคนสนใจเรียน First Aid!\nแอด @jiacpr แล้ว และกำลังเรียนอยู่\n${learnerLine}\nติดตามชวนมาเรียน Practical ได้เลย 🎯`
  )

  res.status(200).json({ ok: true })
}
