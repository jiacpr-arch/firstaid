import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'

const PAGE_SIZE = 200

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'vouchers-list', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return

  const { data, error } = await admin
    .from('vouchers')
    .select('code, chapter, status, price_thb, valid_days, max_uses, use_count, redeemed_by, redeemed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ vouchers: data || [] })
}
