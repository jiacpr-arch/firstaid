import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { generateVoucherCode } from '../_lib/voucherCode.js'

const MAX_COUNT = 100

// Generates a batch of single-use voucher codes for one chapter (or 0 = whole
// course). Sold manually via PromptPay/LINE in Phase 1 — the code is handed to
// the buyer after payment, then redeemed in-app via /api/entitlements/redeem.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'vouchers-create', limit: 20, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return

  const chapter = Number(req.body?.chapter)
  const count = Math.min(MAX_COUNT, Math.max(1, Number(req.body?.count) || 1))
  const priceThb = req.body?.priceThb != null ? Number(req.body.priceThb) : null
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > 4) {
    res.status(400).json({ error: 'Invalid chapter' })
    return
  }

  const rows = Array.from({ length: count }, () => ({
    code: generateVoucherCode(),
    chapter,
    price_thb: priceThb,
    created_by: user.id,
  }))

  const { data, error } = await admin.from('vouchers').insert(rows).select('code, chapter, price_thb, status, created_at')
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ vouchers: data })
}
