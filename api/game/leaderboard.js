import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { rankLeaderboard } from '../_lib/gameResults.js'

// อันดับผู้เล่น FIRST AID HERO — คะแนนรอบเดียวที่ดีที่สุดต่อผู้เล่น (เฉพาะรอบที่ชนะ)
// ?learnerId=<uuid> (ทางเลือก) เพื่อ mark แถวของตัวเอง (you: true)
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'game-board', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  try {
    // ดึงเผื่อ (200 แถว) เพราะจะ dedupe เหลือคะแนนดีสุดต่อคนก่อนตัด top 20
    const { data, error } = await admin
      .from('game_results')
      .select('learner_id, display_name, score, scenario_id, difficulty, grade')
      .eq('won', true)
      .order('score', { ascending: false })
      .order('finished_at', { ascending: true })
      .limit(200)
    if (error) throw error
    const youLearnerId = typeof req.query?.learnerId === 'string' ? req.query.learnerId : null
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.status(200).json({ rows: rankLeaderboard(data || [], { limit: 20, youLearnerId }) })
  } catch (err) {
    res.status(500).json({ error: err.message || 'leaderboard failed' })
  }
}
