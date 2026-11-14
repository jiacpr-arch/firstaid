import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { classByInstructorCode, maskPhone } from '../_lib/instructorAuth.js'
import { loadCohortSummary } from '../_lib/cohortSummaryLoader.js'

// Instructor dashboard: aggregated progress for every learner enrolled in a
// cohort. The learner-data tables are RLS-no-policy (service-role only), so the
// browser client cannot read them directly — this endpoint is the only read path.
//
// Two ways in:
//   admin  — Bearer token, ?cohortId=  (หน้า /admin/teach)
//   ผู้สอน — header X-Instructor-Code (รหัส 8 ตัวของคลาส) ไม่ต้องมี cohortId (หน้า /class)
//            เห็นเฉพาะคลาสของรหัสนั้น อ่านอย่างเดียว เบอร์ผู้เรียนเหลือ 4 ตัวท้าย
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const admin = getSupabaseAdmin()

  const code = req.headers?.['x-instructor-code']
  if (code) {
    // กันไล่เดารหัส — ใช้ key เดียวกับทางเข้าด้วยรหัสอื่น ๆ (api/_lib/instructorAuth.js)
    if (rateLimited(req, res, { key: 'instructor-code', limit: 20, windowMs: 60_000 })) return
    try {
      const cls = await classByInstructorCode(admin, code)
      if (!cls) { res.status(403).json({ error: 'รหัสผู้สอนไม่ถูกต้อง หรือคลาสปิดไปแล้ว' }); return }
      const summary = await loadCohortSummary(admin, cls.cohortId)
      if (!summary) { res.status(404).json({ error: 'Cohort not found' }); return }
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ ok: true, via: 'code', sessionId: cls.sessionId, ...forInstructor(summary) })
    } catch (err) {
      res.status(500).json({ error: err.message || 'summary failed' })
    }
    return
  }

  const user = await requireAdmin(req, res)
  if (!user) return

  const cohortId = req.query?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }

  try {
    const summary = await loadCohortSummary(admin, cohortId)
    if (!summary) { res.status(404).json({ error: 'Cohort not found' }); return }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, ...summary })
  } catch (err) {
    res.status(500).json({ error: err.message || 'summary failed' })
  }
}

// สิ่งที่ผู้สอนภายนอกเห็น: ตัดเบอร์เหลือ 4 ตัวท้าย ไม่ส่ง learnerId (ใช้เปิดหน้ารายคนของแอดมินเท่านั้น)
export function forInstructor(summary) {
  return {
    ...summary,
    learners: (summary.learners || []).map((l, i) => ({
      ...l,
      learnerId: `row-${i + 1}`,
      phone: maskPhone(l.phone),
    })),
  }
}
