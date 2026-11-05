import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { parseListQuery, searchFilter, listRow, toCsv, PAGE_SIZE, EXPORT_CHUNK, EXPORT_MAX } from '../_lib/certSearch.js'

// รายการใบประกาศที่แอปนี้ออก (public.certificates — เลข FA- / ใบภาคปฏิบัติ) สำหรับหน้า /admin/certificates
// ค้นด้วยชื่อ เบอร์ อีเมล หรือเลขใบ — อ่านอย่างเดียว แก้ชื่อ/เพิกถอนทำที่ระบบกลาง
// format=csv: ดาวน์โหลดทุกใบที่ตรงกับคำค้น/ประเภทเดียวกันเป็นไฟล์ CSV
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const { q, kind, page } = parseListQuery(req.query)
  const filter = searchFilter(q)
  const build = (from, to) => {
    let query = admin
      .from('certificates')
      .select('id, kind, code, issued_at, revoked_at, learner_name, learner_phone, learner_email, location, cohorts(name)', { count: 'exact' })
      .order('issued_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
    if (kind) query = query.eq('kind', kind)
    if (filter) query = query.or(filter)
    return query
  }

  if (req.query?.format === 'csv') {
    const rows = []
    for (let from = 0; from < EXPORT_MAX; from += EXPORT_CHUNK) {
      const { data, error } = await build(from, Math.min(from + EXPORT_CHUNK, EXPORT_MAX) - 1)
      if (error) { res.status(500).json({ error: error.message }); return }
      rows.push(...(data || []).map(listRow))
      if (!data || data.length < EXPORT_CHUNK) break
    }
    const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="certificates-${stamp}.csv"`)
    res.statusCode = 200
    res.end(toCsv(rows))
    return
  }

  const { data, count, error } = await build(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, total: count ?? 0, page, pageSize: PAGE_SIZE, certificates: (data || []).map(listRow) })
}
