import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { checkoutItem, isStripeConfigured, sessionParams, stripeApi } from '../_lib/stripeCheckout.js'

// POST /api/checkout/create { chapter } → { url } ของหน้าชำระเงิน Stripe (บัตร / PromptPay)
// ต้องล็อกอินก่อน — สิทธิ์ผูกกับ learner_id ถาวรของบัญชี (ย้ายเครื่องก็เรียนต่อได้)
// 503 stripe_not_configured = ยังไม่ได้ตั้ง STRIPE_SECRET_KEY → หน้าเว็บกลับไปใช้ทาง LINE
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'checkout-create', limit: 10, windowMs: 60_000 })) return
  if (!isStripeConfigured()) { res.status(503).json({ error: 'stripe_not_configured' }); return }

  const item = checkoutItem(req.body?.chapter)
  if (!item) { res.status(400).json({ error: 'invalid_chapter' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const auth = await authFromToken(admin, req)
  if (!auth?.learnerId) { res.status(401).json({ error: 'login_required' }); return }

  try {
    const session = await stripeApi('checkout/sessions', sessionParams({ item, learnerId: auth.learnerId, userId: auth.userId }))
    res.status(200).json({ url: session.url })
  } catch (err) {
    res.status(502).json({ error: err.message || 'stripe_error' })
  }
}
