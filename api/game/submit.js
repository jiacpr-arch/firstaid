import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { learnerIdFromToken, reconcileLearner } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { validateGameResult } from '../_lib/gameResults.js'

// บันทึกผลเกม FIRST AID HERO หนึ่งรอบ (best-effort จาก client — เกมเล่นต่อได้แม้ endpoint ล่ม)
// upsert ด้วย uuid ฝั่ง client จึง idempotent ส่งซ้ำไม่เบิ้ลแถว
// identity ผูกแบบเดียวกับ sync/push: มี LINE token = ยึดตาม token, anonymous = เชื่อ learnerId ที่ส่งมา
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'game-submit', limit: 30, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const tokenLearnerId = await learnerIdFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, tokenLearnerId)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }

  const { row, error } = validateGameResult(body, learnerId)
  if (error) { res.status(400).json({ error }); return }

  try {
    const { error: dbError } = await admin.from('game_results').upsert(row, { onConflict: 'uuid' })
    if (dbError) throw dbError
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'submit failed' })
  }
}
