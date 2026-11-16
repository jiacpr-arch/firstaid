import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { checkoutItem, isStripeConfigured, parseBuyer, sessionParams, stripeApi } from '../_lib/stripeCheckout.js'
import { resolvePurchaseLearner } from '../_lib/guestClaim.js'

// POST /api/checkout/create { chapter, name?, phone? } → { url } ของหน้าชำระเงิน Stripe (บัตร / PromptPay)
// ล็อกอินอยู่ — สิทธิ์ผูกกับ learner_id ถาวรของบัญชี (ย้ายเครื่องก็เรียนต่อได้) เหมือนเดิม
// ไม่ได้ล็อกอิน — ซื้อแบบ guest ต้องมีชื่อ + เบอร์ (400 buyer_required) แล้วผูกกับบัญชีทีหลังที่ /api/checkout/claim
// 503 stripe_not_configured = ยังไม่ได้ตั้ง STRIPE_SECRET_KEY → หน้าเว็บกลับไปใช้ทาง LINE
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'checkout-create', limit: 10, windowMs: 60_000 })) return
  if (!isStripeConfigured()) { res.status(503).json({ error: 'stripe_not_configured' }); return }

  // ทุกทางที่ไม่สำเร็จ log เหตุผลไว้ (ไม่มีข้อมูลส่วนตัว) — หน้า /buy ไม่ส่ง analytics โดยตั้งใจ
  // (checkoutAnalyticsBoundary) จึงต้องดูสาเหตุจาก runtime log ฝั่งเซิร์ฟเวอร์เท่านั้น
  const fail = (status, error) => {
    console.warn('checkout create failed', status, error)
    res.status(status).json({ error })
  }

  const item = checkoutItem(req.body?.chapter)
  if (!item) { fail(400, 'invalid_chapter'); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const auth = await authFromToken(admin, req)
  if (!auth) {
    // จ่ายก่อน ล็อกอินทีหลัง: ห้าม log ชื่อ/เบอร์ — ส่งไป Stripe metadata เท่านั้น
    const buyer = parseBuyer(req.body)
    if (!buyer) { fail(400, 'buyer_required'); return }
    try {
      const session = await stripeApi('checkout/sessions', sessionParams({ item, buyer }))
      res.status(200).json({ url: session.url })
    } catch (err) {
      fail(502, err.message || 'stripe_error')
    }
    return
  }

  // ล็อกอินแล้วแต่บัญชียังไม่ผูกกับผู้เรียน (เช่นบัญชีแอดมิน/อีเมลที่ไม่ได้เข้าผ่านด่าน LINE/Hub ของแอปนี้)
  // → ผูกกับผู้เรียนในเครื่องด้วยกติกาเดียวกับตอนล็อกอิน Hub (api/auth/hub.js): ปฏิเสธถ้า id นั้นเป็นของบัญชีอื่น
  const learnerId = await resolvePurchaseLearner(admin, auth, req.body?.learnerId, 'checkout create')
  if (!learnerId) { fail(409, 'account_not_linked'); return }

  try {
    const session = await stripeApi('checkout/sessions', sessionParams({ item, learnerId, userId: auth.userId }))
    res.status(200).json({ url: session.url })
  } catch (err) {
    fail(502, err.message || 'stripe_error')
  }
}
