import { verifyPurchaseReceipt } from '../_lib/purchaseReceipt.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Same-origin, credentials-free verification of the minimal measurement token.
// No Stripe/DB calls, identity lookup, fulfillment or event dispatch occurs here.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (req.headers?.origin !== 'https://firstaid.morroo.com') return res.status(403).json({ error: 'origin_not_allowed' })
  if (rateLimited(req, res, { key: 'purchase-receipt', limit: 30, windowMs: 60_000 })) return
  const receipt = verifyPurchaseReceipt(req.body?.receipt, process.env.FIRSTAID_PURCHASE_RECEIPT_SECRET)
  if (!receipt) return res.status(400).json({ error: 'invalid_receipt' })
  return res.status(200).json(receipt)
}
