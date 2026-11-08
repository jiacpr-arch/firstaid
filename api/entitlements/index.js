import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken } from '../_lib/authLearner.js'
import { resolveEntitlements, cleanLocalLearnerId } from '../_lib/entitlements.js'
import { rateLimited } from '../_lib/rateLimit.js'

// Returns which chapters (0 = whole-course bundle, 1-5 = single chapter) the
// caller currently has access to. A row with a non-null expires_at in the past
// is treated as no longer granted, so time-limited (e.g. 1-month class) codes
// lapse without any cleanup job.
//
// GET /api/entitlements?learnerId=<local learner id>  (Authorization: Bearer optional)
// POST /api/entitlements with JSON { learnerId } is an equivalent read-only
// transport for browser clients. It keeps identifiers out of resource URLs.
// - Purchased chapters (lesson_entitlements) need a login: they're keyed on the durable learner_id
//   the token resolves to.
// - Class unlock (คลาสรวม CPR, cohorts.unlock_lessons) also checks the device's local learnerId when
//   it is NOT bound to a real account — เดิมต้องมี token ที่หาผู้เรียนเจอเท่านั้น เครื่องที่ล็อกอินบัญชี
//   แอดมิน/บัญชีอื่น (token ไม่ผูกผู้เรียน) หรือยังไม่ล็อกอิน จึงได้ 401/ชุดว่าง แม้ผู้เรียนในเครื่อง
//   อยู่ในคลาสที่เปิดทุกหมวด → ขึ้นหน้าซื้อ ฿99 / "ตรวจสิทธิ์ไม่สำเร็จ"
//   learnerId ที่ผูกบัญชีแล้วต้องมาพร้อม token ของบัญชีนั้น (กันสวมรอย) — ให้แค่สิทธิ์จากคลาส
//   ซึ่งเข้าได้ด้วยรหัสคลาสอยู่แล้ว ไม่รวมหมวดที่ซื้อ
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (applyCors(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'entitlements-list', limit: 60, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const localLearnerId = cleanLocalLearnerId(req.method === 'POST' ? req.body?.learnerId : req.query?.learnerId, tokenLearnerId)
  let result
  try {
    result = await resolveEntitlements(admin, { tokenLearnerId, localLearnerId })
  } catch (err) {
    res.status(500).json({ error: err.message || 'entitlements failed' })
    return
  }

  res.setHeader('Cache-Control', 'no-store')
  // cpr: เปิดหมวด 5 ได้จากการซื้อ (chapter 0 ใน chapters อาจมาจากคลาสที่เปิดทุกบท ซึ่งไม่รวม CPR)
  res.status(200).json({ chapters: result.chapters, cpr: result.cpr })
}
