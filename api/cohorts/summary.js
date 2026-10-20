import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeClass } from '../_lib/instructorAuth.js'
import { loadCohortSummary } from '../_lib/cohortSummaryLoader.js'

// Instructor dashboard: aggregated progress for every learner enrolled in a
// cohort. The learner-data tables are RLS-no-policy (service-role only), so the
// browser client cannot read them directly — this endpoint (admin or the class instructor code)
// is the only read path.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const cohortId = req.query?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }
  // แอดมิน หรือผู้สอนที่ถือรหัสผู้สอนของคลาสนี้
  const actor = await authorizeClass(req, res, admin, { cohortId })
  if (!actor) return

  try {
    const summary = await loadCohortSummary(admin, cohortId)
    if (!summary) { res.status(404).json({ error: 'Cohort not found' }); return }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, ...summary })
  } catch (err) {
    res.status(500).json({ error: err.message || 'summary failed' })
  }
}
