import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { sendClassReminders } from '../_lib/classReminder.js'

// ผู้สอน/แอดมินกด "ส่ง LINE เตือน" ในแท็บภาพรวม — dryRun: true คืนตัวเลข + ตัวอย่างข้อความก่อน
// (ไม่ส่งจริง) แล้วหน้าเว็บให้ยืนยันอีกครั้งก่อนเรียกแบบส่งจริง
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const cohortId = req.body?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }
  const dryRun = req.body?.dryRun !== false

  if (!dryRun && !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    res.status(500).json({ error: 'ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN' })
    return
  }

  try {
    const result = await sendClassReminders(admin, cohortId, { kind: 'manual', dryRun })
    if (!result) { res.status(404).json({ error: 'Cohort not found' }); return }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, ...result })
  } catch (err) {
    const missingTable = /class_reminder_log/.test(err?.message || '')
    res.status(500).json({
      error: missingTable ? 'ยังไม่ได้สร้างตาราง class_reminder_log (supabase/class-reminders.sql)' : (err.message || 'remind failed'),
    })
  }
}
