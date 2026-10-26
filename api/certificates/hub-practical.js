import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken } from '../_lib/authLearner.js'
import { recordPracticalAtHub } from '../_lib/hubPractical.js'
import { rateLimited } from '../_lib/rateLimit.js'

// The signed-in learner's own "send my practical pass to the Hub": for a learner who passed the
// practical day before logging in (the Hub certificate needs an account), or when the Hub was
// unreachable at the time. Only ever for the caller's own practical certificate; the Hub decides
// whether it can issue yet and says why not (`pending`).
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'hub-practical', limit: 10, windowMs: 60_000 })) return

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const auth = await authFromToken(admin, req)
  if (!auth) { res.status(401).json({ error: 'Login required' }); return }
  if (!auth.learnerId) { res.status(200).json({ certificate: null, pending: 'บัญชีนี้ยังไม่ได้เชื่อมกับผลเรียนในเว็บนี้' }); return }

  const { data: own } = await admin
    .from('certificates')
    .select('source_ref')
    .eq('learner_id', auth.learnerId)
    .eq('kind', 'practical')
    .maybeSingle()
  if (!own) { res.status(200).json({ certificate: null, pending: 'ยังไม่ผ่านภาคปฏิบัติ' }); return }

  const hub = await recordPracticalAtHub(admin, { learnerId: auth.learnerId, attendanceId: own.source_ref, userId: auth.userId })
  if (hub.failed) { res.status(502).json({ error: 'ระบบกลางไม่ตอบกลับ กรุณาลองใหม่' }); return }
  if (hub.skipped) { res.status(200).json({ certificate: null, pending: 'ไม่พบข้อมูลการเช็คชื่อภาคปฏิบัติที่อนุมัติแล้ว' }); return }
  res.status(200).json({ certificate: hub.certificate, pending: hub.pending })
}
