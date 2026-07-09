import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Returns which chapters (0 = whole-course bundle, 1-4 = single chapter) the
// authenticated learner has purchased. Login required — entitlements only ever
// exist against the durable learner_id, never an anonymous local id.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'entitlements-list', limit: 60, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const learnerId = await learnerIdFromToken(admin, req)
  if (!learnerId) { res.status(401).json({ error: 'login_required' }); return }

  const { data, error } = await admin
    .from('lesson_entitlements')
    .select('chapter')
    .eq('learner_id', learnerId)
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ chapters: (data || []).map((r) => r.chapter) })
}
