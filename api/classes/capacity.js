import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { cleanMaxStudents, setClassCapacity } from '../_lib/classes.js'

// จำนวนผู้เรียนสูงสุดของคลาส (cohorts.max_students) — แอดมินเท่านั้น
// GET ?classId=… → { maxStudents, students }, POST { classId, maxStudents } (ว่าง/null = ไม่จำกัด)
const UUID = /^[0-9a-f-]{36}$/i

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  if (rateLimited(req, res, { key: 'class-capacity', limit: 60, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()

  const classId = req.method === 'GET' ? req.query?.classId : req.body?.classId
  if (typeof classId !== 'string' || !UUID.test(classId)) { res.status(400).json({ error: 'Missing classId' }); return }

  try {
    if (req.method === 'POST') {
      const max = cleanMaxStudents(req.body?.maxStudents)
      if (max === undefined) { res.status(400).json({ error: 'จำนวนต้องเป็นตัวเลขมากกว่า 0' }); return }
      const done = await setClassCapacity(admin, classId, max)
      if (!done) { res.status(404).json({ error: 'ไม่พบคลาสนี้' }); return }
    }
    const [c, e] = await Promise.all([
      admin.from('cohorts').select('max_students').eq('id', classId).maybeSingle(),
      admin.from('enrollments').select('learner_id').eq('cohort_id', classId),
    ])
    if (c.error || e.error) throw c.error || e.error
    if (!c.data) { res.status(404).json({ error: 'ไม่พบคลาสนี้' }); return }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ maxStudents: c.data.max_students || null, students: (e.data || []).length })
  } catch (err) {
    console.error('class capacity failed', err)
    res.status(500).json({ error: 'บันทึกไม่สำเร็จ' })
  }
}
