import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Redeems a voucher code to grant a chapter (or the whole-course bundle, chapter 0)
// entitlement to the caller. Unlike sync/push, login is mandatory here — an
// entitlement must bind to the durable learner_id (line_identities) so it survives
// a device change, not the throwaway local/anonymous id.
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

  // Atomic claim: only succeeds if the code is still 'active'. A concurrent
  // redeem (or replay) loses this race and gets 0 rows back.
  const { data: voucher, error: claimErr } = await admin
    .from('vouchers')
    .update({ status: 'redeemed', redeemed_by: learnerId, redeemed_at: new Date().toISOString() })
    .eq('code', code)
    .eq('status', 'active')
    .select('code, chapter')
    .maybeSingle()

  if (claimErr) { res.status(500).json({ error: claimErr.message }); return }
  if (!voucher) { res.status(400).json({ error: 'invalid_code' }); return }

  const { error: grantErr } = await admin
    .from('lesson_entitlements')
    .upsert(
      { learner_id: learnerId, chapter: voucher.chapter, source: 'voucher', order_ref: voucher.code },
      { onConflict: 'learner_id,chapter' },
    )
  if (grantErr) { res.status(500).json({ error: grantErr.message }); return }

  res.status(200).json({ ok: true, chapter: voucher.chapter })
}
