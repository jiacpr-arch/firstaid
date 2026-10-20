import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { issuePracticalCertificate } from '../_lib/issuePractical.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'issue-practical', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  // Practical certs are only issued from the admin session-management UI —
  // the endpoint must never be callable by (or for) an arbitrary attendanceId.
  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return

  const { attendanceId } = req.body || {}
  const result = await issuePracticalCertificate(admin, attendanceId)
  res.status(result.status).json(result.body)
}
