import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'
import { loadCohortSummary } from '../_lib/cohortSummaryLoader.js'
import { isReady } from '../_lib/readiness.js'
import { buildSessionReport, formatSessionReport } from '../_lib/sessionReport.js'

// สรุปสถานะรอบอบรม: POST { sessionId, send }
//   send:false → คืน { text } ให้ดูตัวอย่าง
//   send:true  → ส่งข้อความเดียวกันเข้า LINE ของแอดมิน (LINE_ADMIN_USER_ID) คืน { sent } หรือ
//                { sent:false, reason } ถ้ายังไม่ได้ตั้งค่า LINE — ไม่ทำเหมือนส่งสำเร็จ
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  if (rateLimited(req, res, { key: 'session-report', limit: 12, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()

  const { sessionId, send } = req.body || {}
  if (!sessionId) { res.status(400).json({ error: 'Missing sessionId' }); return }

  try {
    const { data: session, error: sErr } = await admin
      .from('practical_sessions').select('id, title, location, cohort_id').eq('id', sessionId).maybeSingle()
    if (sErr) throw sErr
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }

    const [att, st, ck] = await Promise.all([
      admin.from('attendance').select('id, learner_id, status').eq('session_id', sessionId),
      admin.from('session_stations').select('id, name, kind, sort_order').eq('session_id', sessionId)
        .order('sort_order').order('created_at'),
      admin.from('station_checkins').select('station_id, learner_id, passed').eq('session_id', sessionId),
    ])
    for (const r of [att, st, ck]) if (r.error) throw r.error

    // ใบเซอร์ภาคปฏิบัติของรอบนี้ = ใบที่ source_ref ชี้มาที่แถวเช็คชื่อของรอบนี้
    const attendanceIds = (att.data || []).map((a) => a.id)
    let certCount = 0
    if (attendanceIds.length) {
      const { count, error } = await admin
        .from('certificates').select('id', { count: 'exact', head: true })
        .eq('kind', 'practical').is('revoked_at', null).in('source_ref', attendanceIds)
      if (error) throw error
      certCount = count || 0
    }

    // ความพร้อมของคลาส (ไม่ทำให้รายงานล้มถ้าโหลดไม่ได้ — แค่ไม่ใส่บรรทัดนี้)
    let enrolled = null
    let readyCount = null
    if (session.cohort_id) {
      try {
        const summary = await loadCohortSummary(admin, session.cohort_id)
        if (summary) {
          enrolled = summary.learners.length
          readyCount = summary.learners.filter(isReady).length
        }
      } catch (err) {
        console.error('session-report cohort summary failed', err)
      }
    }

    const text = formatSessionReport(buildSessionReport({
      session,
      attendance: att.data || [],
      stations: st.data || [],
      stationCheckins: ck.data || [],
      enrolled,
      readyCount,
      certCount,
    }))

    res.setHeader('Cache-Control', 'no-store')
    if (!send) { res.status(200).json({ ok: true, text }); return }

    const r = await notifyAdminLine(text)
    if (r.ok) { res.status(200).json({ ok: true, text, sent: true }); return }
    res.status(200).json({
      ok: true, text, sent: false,
      reason: r.skipped ? 'ยังไม่ได้ตั้งค่า LINE (LINE_CHANNEL_ACCESS_TOKEN / LINE_ADMIN_USER_ID)' : 'ส่งเข้า LINE ไม่สำเร็จ',
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'session report failed' })
  }
}
