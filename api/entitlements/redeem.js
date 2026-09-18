import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Redeems a code to grant a chapter (or the whole-course bundle, chapter 0)
// entitlement to the caller. Login is mandatory — an entitlement must bind to
// the durable learner_id (line_identities) so it survives a device change.
//
// Two code shapes, distinguished by vouchers.max_uses:
//   • max_uses IS NULL → legacy single-use voucher (one buyer, permanent unless
//     valid_days is set). Claimed atomically via status active→redeemed.
//   • max_uses IS NOT NULL → multi-use "class code": many learners may redeem the
//     same code until use_count hits max_uses (0 = unlimited). Each redemption
//     grants access that expires valid_days after that learner redeemed.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'entitlements-redeem', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const learnerId = await learnerIdFromToken(admin, req)
  if (!learnerId) { res.status(401).json({ error: 'login_required' }); return }

  const code = String(req.body?.code || '').trim().toUpperCase()
  if (!code) { res.status(400).json({ error: 'Missing code' }); return }

  const { data: voucher, error: lookupErr } = await admin
    .from('vouchers')
    .select('code, chapter, status, valid_days, max_uses, use_count')
    .eq('code', code)
    .maybeSingle()
  if (lookupErr) { res.status(500).json({ error: lookupErr.message }); return }
  if (!voucher) { res.status(400).json({ error: 'invalid_code' }); return }

  const multiUse = voucher.max_uses != null

  if (!multiUse) {
    // Legacy single-use: atomic claim — only succeeds if still 'active'. A
    // concurrent redeem (or replay) loses this race and gets 0 rows back.
    const { data: claimed, error: claimErr } = await admin
      .from('vouchers')
      .update({ status: 'redeemed', redeemed_by: learnerId, redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .eq('status', 'active')
      .select('code')
      .maybeSingle()
    if (claimErr) { res.status(500).json({ error: claimErr.message }); return }
    if (!claimed) { res.status(400).json({ error: 'invalid_code' }); return }
  } else {
    // Multi-use class code. Idempotent for a learner who already redeemed it:
    // don't burn another use, just re-grant (refreshes expiry).
    const alreadyMine = await hasEntitlementFromCode(admin, learnerId, voucher.chapter, code)
    if (voucher.status && voucher.status !== 'active') { res.status(400).json({ error: 'invalid_code' }); return }
    if (!alreadyMine) {
      const capped = voucher.max_uses !== 0 // 0 = unlimited
      if (capped && voucher.use_count >= voucher.max_uses) {
        res.status(400).json({ error: 'code_exhausted' })
        return
      }
      // Optimistic-concurrency increment: guard on the use_count we just read so
      // two simultaneous redeems can't both consume the last remaining use.
      const { data: bumped, error: bumpErr } = await admin
        .from('vouchers')
        .update({ use_count: voucher.use_count + 1 })
        .eq('code', code)
        .eq('use_count', voucher.use_count)
        .select('code')
        .maybeSingle()
      if (bumpErr) { res.status(500).json({ error: bumpErr.message }); return }
      if (!bumped) { res.status(409).json({ error: 'busy_retry' }); return }
    }
  }

  const expiresAt = voucher.valid_days
    ? new Date(Date.now() + voucher.valid_days * 86_400_000).toISOString()
    : null

  const { error: grantErr } = await admin
    .from('lesson_entitlements')
    .upsert(
      { learner_id: learnerId, chapter: voucher.chapter, source: 'voucher', order_ref: voucher.code, expires_at: expiresAt },
      { onConflict: 'learner_id,chapter' },
    )
  if (grantErr) { res.status(500).json({ error: grantErr.message }); return }

  res.status(200).json({ ok: true, chapter: voucher.chapter, expires_at: expiresAt })
}

// True if this learner already holds a still-valid entitlement granted by this
// exact code — used to make multi-use redemption idempotent per learner.
async function hasEntitlementFromCode(admin, learnerId, chapter, code) {
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('lesson_entitlements')
    .select('order_ref, expires_at')
    .eq('learner_id', learnerId)
    .eq('chapter', chapter)
    .eq('order_ref', code)
    .maybeSingle()
  if (!data) return false
  return data.expires_at == null || data.expires_at > nowIso
}
