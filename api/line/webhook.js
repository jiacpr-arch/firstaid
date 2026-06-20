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
import { replyLineMessage } from '../_lib/lineMessage.js'

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

const norm = (s) => String(s || '').trim().toLowerCase()
const matches = (text, words) => words.some((w) => norm(text) === norm(w) || norm(text).includes(norm(w)))

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.LINE_CHANNEL_SECRET
  const raw = await readRawBody(req)

  // Verify signature — reject tampered/forged calls. Skip only if no secret set.
  if (secret) {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64')
    const got = req.headers['x-line-signature']
    if (!got || got !== expected) return res.status(401).json({ error: 'bad signature' })
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
    if (ev.type !== 'message' || ev.message?.type !== 'text') continue
    const lineUserId = ev.source?.userId
    const text = ev.message.text
    if (!lineUserId) continue

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
