import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { checkoutItem, isStripeConfigured, sessionParams, stripeApi } from '../_lib/stripeCheckout.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// POST /api/checkout/create { chapter } → { url } ของหน้าชำระเงิน Stripe (บัตร / PromptPay)
// ต้องล็อกอินก่อน — สิทธิ์ผูกกับ learner_id ถาวรของบัญชี (ย้ายเครื่องก็เรียนต่อได้)
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
  if (!auth) { fail(401, 'login_required'); return }

  // ล็อกอินแล้วแต่บัญชียังไม่ผูกกับผู้เรียน (เช่นบัญชีแอดมิน/อีเมลที่ไม่ได้เข้าผ่านด่าน LINE/Hub ของแอปนี้)
  // → ผูกกับผู้เรียนในเครื่องด้วยกติกาเดียวกับตอนล็อกอิน Hub (api/auth/hub.js): ปฏิเสธถ้า id นั้นเป็นของบัญชีอื่น
  let learnerId = auth.learnerId
  if (!learnerId) {
    const candidate = String(req.body?.learnerId || '')
    if (UUID_RE.test(candidate)) {
      const { data: adopted, error: adoptErr } = await admin.rpc('jia_firstaid_hub_adopt', {
        payload: { userId: auth.userId, learnerId: candidate },
      })
      if (adoptErr) console.error('checkout create: adopt failed', adoptErr.message)
      if (adopted?.ok && adopted.learnerId) learnerId = adopted.learnerId
    }
    if (!learnerId) { fail(409, 'account_not_linked'); return }
  }

  try {
    const session = await stripeApi('checkout/sessions', sessionParams({ item, learnerId, userId: auth.userId }))
    res.status(200).json({ url: session.url })
  } catch (err) {
    fail(502, err.message || 'stripe_error')
  }
}
