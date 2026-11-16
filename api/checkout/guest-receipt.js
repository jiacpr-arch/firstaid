import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { RECEIPT_COOKIE, clearReceiptCookie, isStripeConfigured, readCookie, stripeApi } from '../_lib/stripeCheckout.js'
import { guestPurchaseReceipt } from '../_lib/guestClaim.js'

// POST /api/checkout/guest-receipt (ไม่ต้องล็อกอิน, cookie fa_checkout_receipt 15 นาทีจาก /api/checkout/return)
// → { status: 'paid', receipt } | { status: 'pending' } | 404 no_receipt — ใบวัดผลการซื้อของผู้ซื้อ guest
// ให้สิทธิ์เรียนไม่ได้ ไม่มีข้อมูลผู้ซื้อ; การส่งให้ผู้ให้บริการโฆษณาต้องผ่านความยินยอมที่ /api/checkout/receipt-page เหมือนเดิม
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  res.setHeader('Cache-Control', 'no-store')
  if (rateLimited(req, res, { key: 'checkout-guest-receipt', limit: 20, windowMs: 60_000 })) return
  if (!isStripeConfigured()) { res.status(503).json({ error: 'stripe_not_configured' }); return }
  const out = await guestPurchaseReceipt({
    sessionId: readCookie(req.headers?.cookie, RECEIPT_COOKIE),
    fetchSession: (id) => stripeApi(`checkout/sessions/${encodeURIComponent(id)}`),
    receiptSecret: process.env.FIRSTAID_PURCHASE_RECEIPT_SECRET,
  })
  if (out.clear) res.setHeader('Set-Cookie', clearReceiptCookie())
  res.status(out.status).json(out.body)
}
