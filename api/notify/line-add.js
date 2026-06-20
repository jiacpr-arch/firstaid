import { notifyAdminLine } from '../_lib/lineNotify.js'
import { applyCors } from '../_lib/cors.js'

// เรียกจาก client เมื่อผู้เรียนกด "ฉันแอดแล้ว" ใน LinePopup หลังเรียนจบบทแรก
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { learnerId } = req.body || {}

  await notifyAdminLine(
    `📚 มีคนสนใจเรียน First Aid!\nแอด @jiacpr แล้ว และกำลังเรียนอยู่\n${learnerId ? `learner: ${learnerId}` : ''}\nติดตามชวนมาเรียน Practical ได้เลย 🎯`
  )

  res.status(200).json({ ok: true })
}
