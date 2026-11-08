import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { grantPaidSession, isStripeConfigured, paidGrant, stripeApi } from '../_lib/stripeCheckout.js'
import { createPurchaseReceipt } from '../_lib/purchaseReceipt.js'

// GET /api/checkout/confirm?session_id=cs_… — หน้า /buy เรียกตอนลูกค้ากลับจาก Stripe
// ถาม Stripe ตรง ๆ แล้วให้สิทธิ์ทันที ไม่ต้องรอ webhook (ซ้ำกับ webhook ได้ เพราะ upsert)
// → { status: 'paid' | 'pending', chapter }
const SESSION_RE = /^cs_[A-Za-z0-9_]{10,200}$/

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'checkout-confirm', limit: 30, windowMs: 60_000 })) return
  if (!isStripeConfigured()) { res.status(503).json({ error: 'stripe_not_configured' }); return }

  const sessionId = String(req.query?.session_id || '')
  if (!SESSION_RE.test(sessionId)) { res.status(400).json({ error: 'invalid_session' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }
  const learnerId = await learnerIdFromToken(admin, req)
  if (!learnerId) { res.status(401).json({ error: 'login_required' }); return }

  try {
    const session = await stripeApi(`checkout/sessions/${encodeURIComponent(sessionId)}`)
    if (session.metadata?.learner_id !== learnerId) { res.status(403).json({ error: 'not_your_session' }); return }
    const chapter = Number(session.metadata?.chapter)
    if (!paidGrant(session)) { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ status: 'pending', chapter }); return }
    await grantPaidSession(admin, session)
    res.setHeader('Cache-Control', 'no-store')
    // Optional and disabled without its own production-only key. Never reuse
    // Stripe, webhook, Supabase or any public VITE_* credential for measurement.
    res.status(200).json({ status: 'paid', chapter, receipt: createPurchaseReceipt(session, process.env.FIRSTAID_PURCHASE_RECEIPT_SECRET) })
  } catch (err) {
    res.status(502).json({ error: err.message || 'stripe_error' })
  }
}
