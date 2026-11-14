import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { cleanMaxStudents, setClassCapacity } from '../_lib/classes.js'

// ตั้งค่าคลาส — แอดมินเท่านั้น: จำนวนผู้เรียนสูงสุด (cohorts.max_students) และ ใบภาคปฏิบัติชื่อ JIA (cohorts.jia_certified)
// GET ?classId=… → { maxStudents, students, jiaCertified }
// POST { classId, maxStudents } (ว่าง/null = ไม่จำกัด) หรือ POST { classId, jiaCertified: boolean } (แก้เฉพาะค่านี้)
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
    if (req.method === 'POST' && typeof req.body?.jiaCertified === 'boolean' && req.body?.maxStudents === undefined) {
      // คลาสของ JIA / ผู้สอนที่ JIA รับรอง ออกใบภาคปฏิบัติชื่อ JIA ได้ (api/_lib/issuePractical.js)
      const { data: updated, error: uErr } = await admin.from('cohorts')
        .update({ jia_certified: req.body.jiaCertified }).eq('id', classId).select('id')
      if (uErr) throw uErr
      if (!updated?.length) { res.status(404).json({ error: 'ไม่พบคลาสนี้' }); return }
    } else if (req.method === 'POST') {
      const max = cleanMaxStudents(req.body?.maxStudents)
      if (max === undefined) { res.status(400).json({ error: 'จำนวนต้องเป็นตัวเลขมากกว่า 0' }); return }
      const done = await setClassCapacity(admin, classId, max)
      if (!done) { res.status(404).json({ error: 'ไม่พบคลาสนี้' }); return }
    }
    const [c, e] = await Promise.all([
      admin.from('cohorts').select('max_students, jia_certified').eq('id', classId).maybeSingle(),
      admin.from('enrollments').select('learner_id').eq('cohort_id', classId),
    ])
    if (c.error || e.error) throw c.error || e.error
    if (!c.data) { res.status(404).json({ error: 'ไม่พบคลาสนี้' }); return }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      maxStudents: c.data.max_students || null, students: (e.data || []).length, jiaCertified: c.data.jia_certified !== false,
    })
  } catch (err) {
    console.error('class capacity failed', err)
    res.status(500).json({ error: 'บันทึกไม่สำเร็จ' })
  }
}
