import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { grantPaidSession, verifyStripeSignature } from '../_lib/stripeCheckout.js'

// Stripe webhook → ให้สิทธิ์หมวดที่ซื้อ
// ลงทะเบียนใน Stripe Dashboard: https://firstaid.morroo.com/api/checkout/webhook
// events: checkout.session.completed, checkout.session.async_payment_succeeded
//
// ต้องใช้ raw body ในการตรวจลายเซ็น — Vercel parse req.body แบบ lazy (เมื่อถูกอ่านเท่านั้น)
// ที่นี่จึงอ่าน stream เองและห้ามแตะ req.body
async function readRaw(req) {
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const raw = await readRaw(req)
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
    res.status(400).json({ error: 'invalid_signature' })
    return
  }

  let event
  try { event = JSON.parse(raw) } catch { res.status(400).json({ error: 'bad_json' }); return }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    res.status(200).json({ received: true, ignored: event.type })
    return
  }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  try {
    // PromptPay ที่ยังไม่จ่ายจะมา completed พร้อม payment_status=unpaid → paidGrant คืน null, รอ async_payment_succeeded
    const grant = await grantPaidSession(admin, event.data?.object)
    res.status(200).json({ received: true, granted: !!grant })
  } catch (err) {
    console.error('checkout webhook grant failed', err)
    res.status(500).json({ error: 'grant_failed' }) // ให้ Stripe ส่งซ้ำ
  }
}
