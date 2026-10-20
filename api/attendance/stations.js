import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authorizeInstructor } from '../_lib/instructorAuth.js'

// จัดการสถานีของ session: GET ?sessionId= | POST {sessionId, stations:[{name,kind}]}
// | PATCH {id, name?, kind?} | DELETE ?id=
const KINDS = ['practice', 'exam']

async function sessionOfStation(admin, stationId) {
  const { data } = await admin.from('session_stations').select('session_id').eq('id', stationId).maybeSingle()
  return data?.session_id || null
}
const MAX_STATIONS = 30

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  // ดูและจัดการฐานได้: แอดมิน หรือผู้สอนที่ถือรหัสผู้สอนของคลาสนี้
  if (req.method === 'GET') {
    const sessionId = req.query?.sessionId
    if (!sessionId) { res.status(400).json({ error: 'Missing sessionId' }); return }
    const actor = await authorizeInstructor(req, res, admin, sessionId)
    if (!actor) return
    const { data, error } = await admin
      .from('session_stations').select('id, name, kind, sort_order')
      .eq('session_id', sessionId).order('sort_order').order('created_at')
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ stations: data || [] })
    return
  }

  if (req.method === 'POST') {
    const { sessionId, stations } = req.body || {}
    if (!sessionId || !Array.isArray(stations) || stations.length === 0) {
      res.status(400).json({ error: 'Missing fields' }); return
    }
    const actor = await authorizeInstructor(req, res, admin, sessionId)
    if (!actor) return
    const rows = stations
      .map((s) => ({ name: String(s?.name || '').trim().slice(0, 120), kind: s?.kind }))
      .filter((s) => s.name && KINDS.includes(s.kind))
    if (rows.length === 0) { res.status(400).json({ error: 'Invalid stations' }); return }

    const { count } = await admin
      .from('session_stations').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
    if ((count || 0) + rows.length > MAX_STATIONS) {
      res.status(422).json({ error: `มีสถานีได้ไม่เกิน ${MAX_STATIONS} ฐาน` }); return
    }
    const base = count || 0
    const { data, error } = await admin
      .from('session_stations')
      .insert(rows.map((s, i) => ({ session_id: sessionId, name: s.name, kind: s.kind, sort_order: base + i })))
      .select('id, name, kind, sort_order')
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ stations: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, name, kind } = req.body || {}
    if (!id) { res.status(400).json({ error: 'Missing id' }); return }
    const sessionId = await sessionOfStation(admin, id)
    if (!sessionId) { res.status(404).json({ error: 'Station not found' }); return }
    const actor = await authorizeInstructor(req, res, admin, sessionId)
    if (!actor) return
    const patch = {}
    if (typeof name === 'string' && name.trim()) patch.name = name.trim().slice(0, 120)
    if (KINDS.includes(kind)) patch.kind = kind
    if (Object.keys(patch).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return }
    const { error } = await admin.from('session_stations').update(patch).eq('id', id)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id
    if (!id) { res.status(400).json({ error: 'Missing id' }); return }
    const sessionId = await sessionOfStation(admin, id)
    if (!sessionId) { res.status(404).json({ error: 'Station not found' }); return }
    const actor = await authorizeInstructor(req, res, admin, sessionId)
    if (!actor) return
    // ลบฐานแล้วผลเช็คชื่อ/คะแนนของฐานนั้นหายตาม (cascade)
    const { error } = await admin.from('session_stations').delete().eq('id', id)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
