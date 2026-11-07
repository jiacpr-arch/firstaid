import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken, reconcileLearner, isLearnerIdBound } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { resolveCprAccess } from '../_lib/cprAccess.js'
import { CPR_COMPLETED_STATUS } from '../_lib/cprCourse.js'

// ความคืบหน้าคอร์ส CPR & AED (หน้า /cpr) ของผู้เรียนที่ซื้อหมวด CPR / ทั้งคอร์ส — บทไหนผ่านแล้ว
// (นักเรียนคลาสรวมใช้ api/cohorts/my-cpr.js ซึ่งจับคู่ด้วยเบอร์และนับที่เคยเรียนบน cpr.morroo.com ด้วย)
// POST { learnerId, code? } → { access: 'class'|'paid'|null, scores, completed }
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'cpr-progress', limit: 30, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const auth = await authFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, auth?.learnerId || null)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId) { res.status(400).json({ error: 'Missing learnerId' }); return }
  if (!auth?.learnerId && await isLearnerIdBound(admin, learnerId)) { res.status(401).json({ error: 'login_required' }); return }

  try {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const access = await resolveCprAccess(admin, { code, learnerId, tokenLearnerId: auth?.learnerId })
    if (!access) { res.status(200).json({ access: null, scores: {}, completed: false }); return }
    if (access.kind === 'class') { res.status(200).json({ access: 'class', scores: {}, completed: false }); return }
    const { data, error } = await admin
      .from('online_students')
      .select('chapter_scores, completed_at, status')
      .eq('company', access.tag)
      .limit(1)
    if (error) throw error
    const row = data?.[0]
    const scores = Object.fromEntries(Object.entries(row?.chapter_scores || {}).filter(([, v]) => Number(v) > 0))
    res.status(200).json({ access: 'paid', scores, completed: !!row?.completed_at || row?.status === CPR_COMPLETED_STATUS })
  } catch (err) {
    console.error('cpr progress failed', err)
    res.status(500).json({ error: 'โหลดความคืบหน้าไม่สำเร็จ' })
  }
}
