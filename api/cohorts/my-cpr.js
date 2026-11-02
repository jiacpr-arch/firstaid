import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken, reconcileLearner, isLearnerIdBound } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { matchCprProgress, cprCompanyTag, phoneKey } from '../_lib/cprProgress.js'

// ความคืบหน้า CPR ออนไลน์ (cpr.morroo.com) ของ "ตัวเอง" สำหรับนักเรียนคลาสรวม CPR + ปฐมพยาบาล
// ใช้บังคับลำดับเรียน: แบนเนอร์คลาสโชว์ขั้น CPR และ Post-test ปฐมพยาบาลเปิดได้เมื่อเรียน CPR จบแล้ว
// (src/hooks/useClassCpr.js) — จับคู่ด้วยเบอร์โทรใน enrollment แบบเดียวกับ dashboard ครู
// (api/_lib/cprProgress.js) แต่หาแถว online_students ด้วยเบอร์ด้วย ไม่ใช่แค่แถวที่ติดแท็กคลาส
// เผื่อนักเรียนเรียน CPR จบไปก่อนแล้วโดยไม่ได้กรอกโค้ดคลาส
//
// POST { code, learnerId } → { includesCpr, cprPromoCode?, startsOn?, cpr: { redeemed, modulesDone, finalScore, completed } | null }
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'cohort-my-cpr', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId || !code) { res.status(400).json({ error: 'Missing learnerId or code' }); return }
  // บัญชีที่ล็อกอินแล้ว ต้องส่ง token มาเอง — กันคนอื่นเดา learnerId มาดูความคืบหน้า
  if (!tokenLearnerId && await isLearnerIdBound(admin, learnerId)) {
    res.status(401).json({ error: 'login_required' })
    return
  }

  const { data: cohort, error: cErr } = await admin
    .from('cohorts')
    .select('id, deleted_at, includes_cpr, cpr_promo_code, starts_on')
    .eq('code', code)
    .maybeSingle()
  if (cErr) { res.status(500).json({ error: cErr.message }); return }
  if (!cohort) { res.status(404).json({ error: 'Cohort not found' }); return }
  if (!cohort.includes_cpr || !cohort.cpr_promo_code || cohort.deleted_at) {
    res.status(200).json({ includesCpr: false })
    return
  }

  const { data: enrollment, error: eErr } = await admin
    .from('enrollments')
    .select('learner_id, phone')
    .eq('cohort_id', cohort.id)
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (eErr) { res.status(500).json({ error: eErr.message }); return }
  if (!enrollment) { res.status(404).json({ error: 'Not enrolled' }); return }

  const promo = cohort.cpr_promo_code
  const key = phoneKey(enrollment.phone)
  let cpr = null
  if (key) {
    const [r, tagged, byPhone] = await Promise.all([
      admin.from('lead_promo_redemptions').select('phone_key, redeemed_at').eq('code', promo).eq('phone_key', key),
      admin.from('online_students')
        .select('phone, status, final_score, completed_at, chapter_scores')
        .eq('company', cprCompanyTag(promo)),
      admin.from('online_students')
        .select('phone, status, final_score, completed_at, chapter_scores')
        .ilike('phone', `%${key}`)
        .limit(20),
    ])
    for (const q of [r, tagged, byPhone]) {
      if (q.error) { res.status(500).json({ error: q.error.message }); return }
    }
    const match = matchCprProgress({
      enrollments: [enrollment],
      redemptions: r.data || [],
      students: [...(tagged.data || []), ...(byPhone.data || [])],
    })
    cpr = match.get(learnerId) || null
  }

  res.status(200).json({ includesCpr: true, cprPromoCode: promo, startsOn: cohort.starts_on || null, cpr })
}
