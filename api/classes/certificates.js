import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { loadClassCertificates, resendPendingPractical, publicRows } from '../_lib/classCertificates.js'

// แท็บ "ผล & ใบประกาศ" ของหน้าคลาส — แอดมินเท่านั้น
// GET ?cohortId=…                         → { rows, totals, hubError }
// POST { cohortId, action: 'resend' }     → ส่งผลภาคปฏิบัติที่ค้างเข้าระบบกลาง { sent, issued, pending }
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  if (rateLimited(req, res, { key: 'class-certificates', limit: 60, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()

  const cohortId = req.method === 'GET' ? req.query?.cohortId : req.body?.cohortId
  if (typeof cohortId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cohortId)) { res.status(400).json({ error: 'Missing cohortId' }); return }
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'POST') {
      if (req.body?.action !== 'resend') { res.status(400).json({ error: 'Unknown action' }); return }
      const out = await resendPendingPractical(admin, cohortId)
      if (out.error) { res.status(502).json({ error: out.error }); return }
      res.status(200).json(out)
      return
    }
    const { rows, totals, hubError } = await loadClassCertificates(admin, cohortId)
    res.status(200).json({ rows: publicRows(rows), totals, hubError })
  } catch (err) {
    console.error('class certificates failed', err)
    res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' })
  }
}
