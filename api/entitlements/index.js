import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Returns which chapters (0 = whole-course bundle, 1-4 = single chapter) the
// authenticated learner currently has access to. Login required — entitlements
// only ever exist against the durable learner_id, never an anonymous local id.
// A row with a non-null expires_at in the past is treated as no longer granted,
// so time-limited (e.g. 1-month class) codes lapse without any cleanup job.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'entitlements-list', limit: 60, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const learnerId = await learnerIdFromToken(admin, req)
  if (!learnerId) { res.status(401).json({ error: 'login_required' }); return }

  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('lesson_entitlements')
    .select('chapter, expires_at')
    .eq('learner_id', learnerId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ chapters: (data || []).map((r) => r.chapter) })
}
