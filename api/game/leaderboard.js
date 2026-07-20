import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { rankLeaderboard } from '../_lib/gameResults.js'

// อันดับผู้เล่น FIRST AID HERO — คะแนนรอบเดียวที่ดีที่สุดต่อผู้เล่น (เฉพาะรอบที่ชนะ)
// ?learnerId=<uuid> (ทางเลือก) เพื่อ mark แถวของตัวเอง (you: true)
// ?cohortCode=<6 หลัก> (ทางเลือก) เพื่อจัดอันดับเฉพาะคนในคลาสนั้น (แข่งกันในห้อง)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'game-board', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  try {
    // โหมดคลาส: แปลงรหัสคลาส → รายชื่อ learner_id ที่ enroll แล้วกรองเฉพาะกลุ่มนั้น
    let cohortLearnerIds = null
    const cohortCode = typeof req.query?.cohortCode === 'string' ? req.query.cohortCode.trim().toUpperCase() : ''
    if (cohortCode) {
      const { data: cohort, error: cErr } = await admin
        .from('cohorts').select('id').eq('code', cohortCode).maybeSingle()
      if (cErr) throw cErr
      if (!cohort) { res.status(200).json({ rows: [] }); return }
      const { data: enr, error: eErr } = await admin
        .from('enrollments').select('learner_id').eq('cohort_id', cohort.id).limit(500)
      if (eErr) throw eErr
      cohortLearnerIds = [...new Set((enr || []).map((r) => r.learner_id))]
      if (!cohortLearnerIds.length) { res.status(200).json({ rows: [] }); return }
    }

    // ดึงเผื่อ (200 แถว) เพราะจะ dedupe เหลือคะแนนดีสุดต่อคนก่อนตัด top 20
    let query = admin
      .from('game_results')
      .select('learner_id, display_name, score, scenario_id, difficulty, grade')
      .eq('won', true)
      .order('score', { ascending: false })
      .order('finished_at', { ascending: true })
      .limit(200)
    if (cohortLearnerIds) query = query.in('learner_id', cohortLearnerIds)
    const { data, error } = await query
    if (error) throw error
    const youLearnerId = typeof req.query?.learnerId === 'string' ? req.query.learnerId : null
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.status(200).json({ rows: rankLeaderboard(data || [], { limit: 20, youLearnerId }) })
  } catch (err) {
    res.status(500).json({ error: err.message || 'leaderboard failed' })
  }
}
