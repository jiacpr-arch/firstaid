// LINE Messaging API webhook — handles learner opt-out/opt-in for nurture
// messages. Configure this URL as the webhook in the LINE OA console.
//
// Verifies X-Line-Signature (HMAC-SHA256 of the raw body with the Messaging API
// channel secret) before acting. A learner texting "หยุด"/"ยกเลิก"/"stop" sets
// line_identities.nurture_opted_out = true; "เริ่ม"/"start" opts back in.
//
// Env: LINE_CHANNEL_SECRET (Messaging API channel secret — different from
// LINE_LOGIN_CHANNEL_SECRET used by login). When the secret is missing or the
// identities table is absent the handler degrades to a no-op 200.
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { replyLineMessage, pushLineMessage } from '../_lib/lineMessage.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'

// Disable Vercel's body parser so we can read the raw bytes for signature checks.
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const OPT_OUT_WORDS = ['หยุด', 'ยกเลิก', 'stop', 'unsubscribe']
const OPT_IN_WORDS = ['เริ่ม', 'start', 'subscribe']
const INTEREST_WORDS = ['สนใจ', 'เรียน', 'firstaid', 'first aid', 'cpr', 'aed', 'ปฐมพยาบาล']

const GREETING_MSG = `ยินดีต้อนรับสู่ Jia Training Center นะคะ 🎉
หากสนใจเรียนปฐมพยาบาล (First Aid) & CPR กับครู Jia พิมพ์ว่า "สนใจเรียน" ได้เลยค่ะ
หรือลองเรียนออนไลน์ฟรีได้ก่อนที่ https://firstaid.morroo.com`

const norm = (s) => String(s || '').trim().toLowerCase()
const matches = (text, words) => words.some((w) => norm(text) === norm(w) || norm(text).includes(norm(w)))

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.LINE_CHANNEL_SECRET
  // Fail closed: without the channel secret we cannot verify authenticity, so
  // reject rather than process forged events (which could flip opt-out flags or
  // trigger admin LINE pushes).
  if (!secret) {
    return res.status(500).json({ error: 'LINE_CHANNEL_SECRET not configured' })
  }
  const raw = await readRawBody(req)

  // Verify signature (constant-time) — reject tampered/forged calls.
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64')
  const got = req.headers['x-line-signature']
  const expectedBuf = Buffer.from(expected)
  const gotBuf = Buffer.from(String(got || ''))
  if (
    !got ||
    gotBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(gotBuf, expectedBuf)
  ) {
    return res.status(401).json({ error: 'bad signature' })
  }

  let body
  try {
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch {
    return res.status(200).json({ ok: true }) // ตอบ 200 เสมอ ไม่ให้ LINE retry
  }

  const admin = getSupabaseAdmin()
  const events = Array.isArray(body.events) ? body.events : []

  for (const ev of events) {
    const lineUserId = ev.source?.userId

    // ลูกค้าแอด OA → ส่ง greeting ชวนพิมพ์ว่าสนใจเรียน
    if (ev.type === 'follow') {
      await pushLineMessage(lineUserId, GREETING_MSG)
      continue
    }

    if (ev.type !== 'message' || ev.message?.type !== 'text') continue
    if (!lineUserId) continue
    const text = ev.message.text

    // ลูกค้าพิมพ์ว่าสนใจเรียน → ตอบกลับ + แจ้ง admin ทันที
    if (matches(text, INTEREST_WORDS)) {
      await Promise.all([
        replyLineMessage(ev.replyToken,
          'ขอบคุณที่สนใจนะคะ 😊 ทีมงานจะติดต่อกลับเร็ว ๆ นี้เลยค่ะ!\nระหว่างรอ ลองเรียนออนไลน์ฟรีได้เลยที่ https://firstaid.morroo.com'),
        notifyAdminLine(`📣 มีคนสนใจเรียน First Aid!\nLINE userId: ${lineUserId}\nข้อความ: "${text}"\nรีบ follow up ด่วน! 🎯`),
      ])
      continue
    }

    const optOut = matches(text, OPT_OUT_WORDS)
    const optIn = !optOut && matches(text, OPT_IN_WORDS)
    if (!optOut && !optIn) continue

    if (admin) {
      // อัปเดตเฉพาะแถวที่มีอยู่ (ผูกบัญชีตอนล็อกอินแล้ว) — swallow error ถ้าคอลัมน์/ตารางยังไม่มี
      await admin
        .from('line_identities')
        .update({
          nurture_opted_out: optOut,
          nurture_opted_out_at: optOut ? new Date().toISOString() : null,
        })
        .eq('line_user_id', lineUserId)
        .then(() => {}, () => {})
    }

    const reply = optOut
      ? 'รับทราบค่ะ เราจะหยุดส่งข้อความเตือนเรียนให้ 🙏 หากต้องการรับอีกครั้ง พิมพ์ "เริ่ม" ได้เลย'
      : 'ยินดีค่ะ 🎉 เราจะส่งข้อความเตือนเรียน/ข่าวคลาสให้ตามเดิม — พิมพ์ "หยุด" เพื่อยกเลิกได้ทุกเมื่อ'
    await replyLineMessage(ev.replyToken, reply)
  }

  return res.status(200).json({ ok: true })
}
