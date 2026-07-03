// Daily LINE nurture cron — pushes one re-engagement message per learner based
// on their progress. Triggered by Vercel cron (see vercel.json) and gated by
// CRON_SECRET. Reuses pushLineMessage (Messaging API) + the service-role
// Supabase client.
//
// Depends on the `line_identities` table from the LINE Login feature (PR #29):
// it maps line_user_id -> learner_id. Until that table exists this endpoint
// returns { skipped: true } without sending anything, so it is safe to ship
// ahead of the login feature.
//
// Consent model: implied (learner logged in with LINE + added @jiacpr). Every
// message carries an opt-out footer; opting out is recorded by api/line/webhook.js
// into line_identities.nurture_opted_out, which we filter on here.
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { pushLineMessage } from '../_lib/lineMessage.js'
import { TOTAL_LESSONS } from '../../src/courses/firstaid/lessons.js'

// TOTAL_LESSONS is imported from the course content so it can never drift.
const ALMOST_DONE_AT = TOTAL_LESSONS - 2 // อ่านครบเท่านี้ขึ้นไป = ใกล้จบ
const ABANDONED_AFTER_DAYS = 3
const ABANDONED_COOLDOWN_DAYS = 7
const MAX_PER_RUN = 200 // กัน rate limit + runaway

const APP_URL = process.env.VITE_PUBLIC_BASE_URL || 'https://firstaid.morroo.com'
const FOOTER = '\n\n— พิมพ์ "หยุด" หากไม่ต้องการรับข้อความแบบนี้'

function messageFor(campaign, { lessonsRead }) {
  if (campaign === 'completed') {
    return (
      '🎉 ยินดีด้วย! คุณเรียนจบหลักสูตรปฐมพยาบาลออนไลน์แล้ว 🙌\n\n' +
      'ทฤษฎีแน่นแล้ว — ก้าวต่อไปคือ "ลงมือจริง" มาฝึกกดหน้าอก + ใช้ AED กับหุ่นจริง ' +
      'ในคลาส practical กับครู Jia เพื่อให้ช่วยคนได้จริงตอนฉุกเฉิน\n\n' +
      `สนใจรอบอบรม ทักแชทนี้ได้เลย 👉 ${APP_URL}/certificate` + FOOTER
    )
  }
  if (campaign === 'almost_done') {
    const remain = Math.max(1, TOTAL_LESSONS - lessonsRead)
    return (
      `🎓 อีกนิดเดียว! เหลืออีกแค่ ${remain} บท ก็ทำ Post-test รับใบประกาศได้แล้ว\n\n` +
      `มาเรียนต่อให้จบกันนะ 👉 ${APP_URL}/learn` + FOOTER
    )
  }
  // abandoned
  return (
    `📚 เรียนค้างไว้นะ (เรียนไปแล้ว ${lessonsRead} บท) กลับมาเรียนต่อกัน อีกนิดก็จบแล้ว 💪\n\n` +
    `เรียนต่อเลย 👉 ${APP_URL}/learn` + FOOTER
  )
}

export default async function handler(req, res) {
  const { CRON_SECRET } = process.env
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(200).json({ ok: true, skipped: true, reason: 'supabase not configured' })

  // 1) ผู้เรียนที่ล็อกอิน LINE และยังไม่ opt-out — ตารางมาจาก PR #29
  const { data: identities, error: idErr } = await admin
    .from('line_identities')
    .select('line_user_id, learner_id, nurture_opted_out')
    .or('nurture_opted_out.is.null,nurture_opted_out.eq.false')
  if (idErr) {
    // ตารางยังไม่มี (PR #29 ยังไม่ merge) หรือ query พัง — ข้ามอย่างนิ่ม
    return res.status(200).json({ ok: true, skipped: true, reason: idErr.message })
  }
  if (!identities?.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no recipients' })

  const learnerIds = [...new Set(identities.map((r) => r.learner_id).filter(Boolean))]

  // 2) ดึง progress + ประวัติส่ง แบบ bulk แล้วจัดกลุ่มใน JS (เลี่ยง N+1)
  const [{ data: progress }, { data: exams }, { data: logs }] = await Promise.all([
    admin.from('lesson_progress').select('learner_id, lesson_id, read_at').in('learner_id', learnerIds),
    admin.from('exam_attempts').select('learner_id, kind, passed').in('learner_id', learnerIds),
    admin.from('line_nurture_log').select('learner_id, campaign, sent_at').in('learner_id', learnerIds),
  ])

  const byLearner = new Map()
  const ensure = (id) => {
    if (!byLearner.has(id)) byLearner.set(id, { lessons: new Set(), lastReadAt: null, postPassed: false, logs: [] })
    return byLearner.get(id)
  }
  for (const r of progress || []) {
    const e = ensure(r.learner_id)
    e.lessons.add(r.lesson_id)
    if (!e.lastReadAt || r.read_at > e.lastReadAt) e.lastReadAt = r.read_at
  }
  for (const r of exams || []) {
    if (r.kind === 'post' && r.passed) ensure(r.learner_id).postPassed = true
  }
  for (const r of logs || []) ensure(r.learner_id).logs.push(r)

  const now = Date.now()
  const daysAgo = (d) => now - d * 24 * 60 * 60 * 1000
  const sentCampaign = (e, c) => e.logs.some((l) => l.campaign === c)
  const sentCampaignSince = (e, c, ts) =>
    e.logs.some((l) => l.campaign === c && new Date(l.sent_at).getTime() >= ts)

  // 3) เลือก campaign เดียวต่อคน (ลำดับความสำคัญ completed > almost_done > abandoned)
  const toSend = []
  for (const { line_user_id, learner_id } of identities) {
    if (!line_user_id || !learner_id) continue
    const e = byLearner.get(learner_id)
    if (!e) continue
    const lessonsRead = e.lessons.size
    if (lessonsRead === 0) continue

    let campaign = null
    if (e.postPassed) {
      if (!sentCampaign(e, 'completed')) campaign = 'completed'
    } else if (lessonsRead >= ALMOST_DONE_AT) {
      if (!sentCampaign(e, 'almost_done')) campaign = 'almost_done'
    } else if (
      e.lastReadAt &&
      new Date(e.lastReadAt).getTime() <= daysAgo(ABANDONED_AFTER_DAYS) &&
      !sentCampaignSince(e, 'abandoned', daysAgo(ABANDONED_COOLDOWN_DAYS))
    ) {
      campaign = 'abandoned'
    }
    if (campaign) toSend.push({ line_user_id, learner_id, campaign, lessonsRead })
    if (toSend.length >= MAX_PER_RUN) break
  }

  // 4) ส่ง + log (ส่งไม่สำเร็จไม่ log เพื่อให้รอบหน้าลองใหม่)
  let sent = 0
  for (const item of toSend) {
    const result = await pushLineMessage(item.line_user_id, messageFor(item.campaign, item))
    if (result.ok) {
      sent += 1
      await admin
        .from('line_nurture_log')
        .insert({ learner_id: item.learner_id, line_user_id: item.line_user_id, campaign: item.campaign })
        .then(() => {}, () => {})
    }
  }

  return res.status(200).json({ ok: true, candidates: toSend.length, sent })
}
