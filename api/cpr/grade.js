import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken, reconcileLearner, isLearnerIdBound } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { cprCompanyTag, phoneKey } from '../_lib/cprProgress.js'
import { CPR_FINAL_MODULE_ID, validateGradeRequest, pickClassRow, buildStudentWrite } from '../_lib/cprCourse.js'

// ตรวจแบบทดสอบ CPR & AED ออนไลน์ที่เรียนในเว็บนี้ (หน้า /cpr — คลาสรวม CPR + ปฐมพยาบาล)
// 1) ต้องเป็นนักเรียนในคลาสรวม CPR (cohorts.includes_cpr) — คอร์ส CPR สำหรับคนทั่วไปยังขายที่ cpr.morroo.com
// 2) ส่งต่อให้ edge function grade-quiz (jia-online) ตรวจ — เฉลยอยู่ที่นั่นที่เดียว; ข้อสอบปลายภาคต้องล็อกอิน
//    (แนบ access token ของผู้เรียนต่อไป) grade-quiz จะบันทึกผลเข้าระบบกลาง JIA → ได้ใบประกาศ CPR ที่ Hub
// 3) สอบผ่าน → บันทึกคะแนนลง online_students (แถวที่ติดแท็กคลาส) ครู/dashboard เห็นทันทีแบบเดิม
//
// POST { code, learnerId, moduleId, questions:[origIndex], answers:[origChoice] }
//   → { score, correct, total, passed, corrects? }
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'cpr-grade', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  const fnBase = process.env.VITE_SUPABASE_URL
  const apiKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!admin || !fnBase || !apiKey) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const moduleId = Number(body.moduleId)
  const bad = validateGradeRequest({ moduleId, questions: body.questions, answers: body.answers })
  if (bad) { res.status(400).json({ error: bad }); return }

  const auth = await authFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, auth?.learnerId || null)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId || !code) { res.status(400).json({ error: 'Missing learnerId or code' }); return }
  if (!auth?.learnerId && await isLearnerIdBound(admin, learnerId)) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบอีกครั้ง' })
    return
  }
  const isFinal = moduleId === CPR_FINAL_MODULE_ID
  if (isFinal && !auth?.userId) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนทำข้อสอบปลายภาค' })
    return
  }

  const { data: cohort, error: cErr } = await admin
    .from('cohorts')
    .select('id, deleted_at, includes_cpr, cpr_promo_code')
    .eq('code', code)
    .maybeSingle()
  if (cErr) { res.status(500).json({ error: cErr.message }); return }
  if (!cohort || cohort.deleted_at || !cohort.includes_cpr || !cohort.cpr_promo_code) {
    res.status(403).json({ error: 'คลาสนี้ไม่ได้รวมคอร์ส CPR & AED' })
    return
  }
  const { data: enrollment, error: eErr } = await admin
    .from('enrollments')
    .select('learner_id, name, phone')
    .eq('cohort_id', cohort.id)
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (eErr) { res.status(500).json({ error: eErr.message }); return }
  if (!enrollment) { res.status(403).json({ error: 'ยังไม่ได้เข้าคลาสนี้' }); return }

  // ตรวจที่ grade-quiz — token ของผู้เรียนส่งต่อเฉพาะข้อสอบปลายภาค (grade-quiz ใช้ยืนยันตัวตน/จำกัดครั้ง/ส่งผลเข้า Hub)
  const authz = req.headers?.authorization || ''
  const accessToken = isFinal && authz.startsWith('Bearer ') ? authz.slice(7) : null
  let graded
  try {
    const r = await fetch(`${fnBase}/functions/v1/grade-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ module_id: moduleId, questions: body.questions, answers: body.answers, access_token: accessToken }),
    })
    graded = await r.json().catch(() => ({}))
    if (!r.ok) { res.status(r.status === 401 || r.status === 429 || r.status === 400 ? r.status : 502).json({ error: graded?.error || 'ตรวจคำตอบไม่สำเร็จ' }); return }
  } catch {
    res.status(502).json({ error: 'ตรวจคำตอบไม่สำเร็จ กรุณาลองใหม่' })
    return
  }
  if (typeof graded?.score !== 'number') { res.status(502).json({ error: 'ตรวจคำตอบไม่สำเร็จ' }); return }

  // สอบผ่าน → บันทึกลง online_students (ไม่สำเร็จไม่ขวางผลสอบ — ผลปลายภาคอยู่ที่ Hub แล้ว)
  let saved = !graded.passed
  const key = phoneKey(enrollment.phone)
  if (graded.passed && key) {
    try {
      const { data: rows, error } = await admin
        .from('online_students')
        .select('id, phone, company, chapter_scores, completed_at, final_score')
        .eq('company', cprCompanyTag(cohort.cpr_promo_code))
      if (error) throw error
      const existing = pickClassRow(rows || [], cohort.cpr_promo_code, enrollment.phone)
      const write = buildStudentWrite({ existing, enrollment, promoCode: cohort.cpr_promo_code, moduleId, graded })
      if (write?.op === 'update') {
        const { error: uErr } = await admin.from('online_students').update(write.patch).eq('id', write.id)
        if (uErr) throw uErr
      } else if (write?.op === 'insert') {
        const { error: iErr } = await admin.from('online_students').insert(write.row)
        if (iErr) throw iErr
      }
      saved = true
    } catch (err) {
      console.error('cpr progress save failed', err)
    }
  }

  const out = { score: graded.score, correct: graded.correct, total: graded.total, passed: graded.passed, saved }
  if (Array.isArray(graded.corrects)) out.corrects = graded.corrects
  res.status(200).json(out)
}
