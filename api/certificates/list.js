import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { parseListQuery, searchFilter, listRow, PAGE_SIZE } from '../_lib/certSearch.js'

// รายการใบประกาศที่แอปนี้ออก (public.certificates — เลข FA- / ใบภาคปฏิบัติ) สำหรับหน้า /admin/certificates
// ค้นด้วยชื่อ เบอร์ อีเมล หรือเลขใบ — อ่านอย่างเดียว แก้ชื่อ/เพิกถอนทำที่ระบบกลาง
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const { q, kind, page } = parseListQuery(req.query)
  let query = admin
    .from('certificates')
    .select('id, kind, code, issued_at, revoked_at, learner_name, learner_phone, learner_email, location, cohorts(name)', { count: 'exact' })
    .order('issued_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (kind) query = query.eq('kind', kind)
  const filter = searchFilter(q)
  if (filter) query = query.or(filter)

  const { data, count, error } = await query
  if (error) { res.status(500).json({ error: error.message }); return }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, total: count ?? 0, page, pageSize: PAGE_SIZE, certificates: (data || []).map(listRow) })
}
