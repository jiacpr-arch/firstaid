import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { generateVoucherCode } from '../_lib/voucherCode.js'

const MAX_COUNT = 100

// Generates voucher/class codes for one chapter (or 0 = whole course). Sold or
// handed out via PromptPay/LINE off-app, then redeemed in-app via
// /api/entitlements/redeem.
//
// Body:
//   chapter   0-4 (0 = whole-course bundle)                        required
//   count     how many distinct codes to mint (1-100)              default 1
//   priceThb  price recorded on each code                          optional
//   validDays access lasts this many days after each redemption;   optional
//             omit/null = permanent
//   maxUses   omit/null = single-use voucher (one buyer per code); optional
//             a number = multi-use class code (0 = unlimited uses,
//             >0 = that many redemptions share one code)
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

  const validDays = req.body?.validDays != null ? Number(req.body.validDays) : null
  if (validDays != null && (!Number.isInteger(validDays) || validDays < 1)) {
    res.status(400).json({ error: 'Invalid validDays' })
    return
  }

  const maxUses = req.body?.maxUses != null ? Number(req.body.maxUses) : null
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 0)) {
    res.status(400).json({ error: 'Invalid maxUses' })
    return
  }

  const rows = Array.from({ length: count }, () => ({
    code: generateVoucherCode(),
    chapter,
    price_thb: priceThb,
    valid_days: validDays,
    max_uses: maxUses,
    created_by: user.id,
  }))

  const { data, error } = await admin
    .from('vouchers')
    .insert(rows)
    .select('code, chapter, price_thb, valid_days, max_uses, use_count, status, created_at')
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ vouchers: data })
}
