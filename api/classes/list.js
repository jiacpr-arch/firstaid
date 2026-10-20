import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { buildClassList } from '../_lib/classes.js'

// แอดมิน: รายการคลาสทั้งหมด (รวมที่ผู้สอนสร้างจากแอป) พร้อมรหัสผู้สอนไว้กู้คืน
const LIMIT = 500

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  try {
    const [c, e, s] = await Promise.all([
      admin.from('cohorts')
        .select('id, name, code, instructor_code, created_via, created_at, deleted_at')
        .order('created_at', { ascending: false }).limit(LIMIT),
      admin.from('enrollments').select('cohort_id').limit(20000),
      admin.from('practical_sessions').select('id, cohort_id, starts_at').not('cohort_id', 'is', null).limit(5000),
    ])
    for (const r of [c, e, s]) if (r.error) throw r.error
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      ok: true,
      classes: buildClassList({ cohorts: c.data || [], enrollments: e.data || [], sessions: s.data || [] }),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'list failed' })
  }
}
