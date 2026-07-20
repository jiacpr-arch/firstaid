import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken, reconcileLearner } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Learner joins a cohort (classroom) by its 6-char code. Upserts an enrollments
// row keyed (cohort_id, learner_id) so re-joining just refreshes name/phone.
// Progress itself keeps flowing through api/sync/push.js under the same
// learner_id — the instructor dashboard (api/cohorts/summary.js) joins on it.
//
// Identity mirrors sync/push: a LINE session token binds the enrollment to the
// authenticated learner (mismatching body learnerId is rejected); anonymous
// learners enroll under their local id. The rate limit also throttles guessing
// cohort codes.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'cohort-join', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''

  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId || !code) { res.status(400).json({ error: 'Missing learnerId or code' }); return }

  const { data: cohort, error: cErr } = await admin
    .from('cohorts')
    .select('id, name, code, deleted_at')
    .eq('code', code)
    .maybeSingle()
  if (cErr) { res.status(500).json({ error: cErr.message }); return }
  if (!cohort) { res.status(404).json({ error: 'Cohort not found' }); return }
  if (cohort.deleted_at) { res.status(410).json({ error: 'Cohort closed' }); return }

  const { error } = await admin
    .from('enrollments')
    .upsert(
      { cohort_id: cohort.id, learner_id: learnerId, name: name || null, phone: phone || null },
      { onConflict: 'cohort_id,learner_id' },
    )
  if (error) { res.status(500).json({ error: error.message }); return }

  res.status(200).json({ ok: true, cohortId: cohort.id, cohortName: cohort.name, code: cohort.code })
}
