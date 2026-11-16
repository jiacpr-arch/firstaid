import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { CLAIM_COOKIE, clearClaimCookie, isStripeConfigured, readCookie, stripeApi } from '../_lib/stripeCheckout.js'
import { claimGuestPurchase } from '../_lib/guestClaim.js'

// POST /api/checkout/claim { learnerId? } (ต้องล็อกอิน + cookie fa_checkout_claim จาก /api/checkout/return)
// ผูกการซื้อแบบ guest เข้ากับบัญชีที่ล็อกอินอยู่ → { status: 'paid', chapter, receipt? } | { status: 'pending' }
// 401 login_required · 404 no_claim (ไม่มี cookie / ไม่ใช่ guest ของ firstaid / ยอดไม่ตรง) · 409 claimed (บัญชีอื่นได้ไปแล้ว)
// | account_not_linked — รายละเอียดใน api/_lib/guestClaim.js
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  res.setHeader('Cache-Control', 'no-store')
  if (rateLimited(req, res, { key: 'checkout-claim', limit: 20, windowMs: 60_000 })) return
  if (!isStripeConfigured()) { res.status(503).json({ error: 'stripe_not_configured' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  try {
    const auth = await authFromToken(admin, req)
    const out = await claimGuestPurchase({
      admin,
      auth,
      sessionId: readCookie(req.headers?.cookie, CLAIM_COOKIE),
      learnerCandidate: req.body?.learnerId,
      fetchSession: (id) => stripeApi(`checkout/sessions/${encodeURIComponent(id)}`),
      receiptSecret: process.env.FIRSTAID_PURCHASE_RECEIPT_SECRET,
    })
    if (out.clear) res.setHeader('Set-Cookie', clearClaimCookie())
    if (out.status >= 400) console.warn('checkout claim', out.status, out.body.error)
    res.status(out.status).json(out.body)
  } catch (err) {
    console.error('checkout claim failed', err?.message || err)
    res.status(500).json({ error: 'claim_failed' })
  }
}
