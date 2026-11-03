import { isLearnerIdBound } from './authLearner.js'

// สิทธิ์เปิดบทเรียน — ใช้โดย api/entitlements (ดูคำอธิบายที่นั่น)
const ID_RE = /^[A-Za-z0-9-]{8,64}$/

export async function inUnlockedClass(admin, learnerId) {
  const { data, error } = await admin
    .from('enrollments')
    .select('cohorts!inner(unlock_lessons, deleted_at)')
    .eq('learner_id', learnerId)
    .eq('cohorts.unlock_lessons', true)
    .is('cohorts.deleted_at', null)
    .limit(1)
  if (error) { console.error('entitlements: class unlock lookup failed (non-fatal)', error); return false }
  return (data?.length || 0) > 0
}


// learnerId ในเครื่องจาก query — รูปแบบต้องถูก และไม่ซ้ำกับผู้เรียนจาก token (ซ้ำ = เช็คไปแล้ว)
export function cleanLocalLearnerId(raw, tokenLearnerId) {
  return typeof raw === 'string' && ID_RE.test(raw) && raw !== tokenLearnerId ? raw : null
}

// tokenLearnerId: ผู้เรียนจาก token (ซื้อหมวด + คลาส) · localLearnerId: ผู้เรียนในเครื่อง (เฉพาะคลาส และต้องไม่ผูกบัญชี)
export async function resolveChapters(admin, { tokenLearnerId = null, localLearnerId = null, now = new Date() } = {}) {
  const chapters = new Set()
  if (tokenLearnerId) {
    const { data, error } = await admin
      .from('lesson_entitlements')
      .select('chapter, expires_at')
      .eq('learner_id', tokenLearnerId)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    if (error) throw error
    for (const r of data || []) chapters.add(r.chapter)
    // อยู่ในคลาสที่ยังไม่ปิดและตั้ง unlock_lessons → ทั้งคอร์ส (chapter 0) ตราบที่ยังอยู่ในคลาส
    if (!chapters.has(0) && await inUnlockedClass(admin, tokenLearnerId)) chapters.add(0)
  }
  if (!chapters.has(0) && localLearnerId && !(await isLearnerIdBound(admin, localLearnerId))) {
    if (await inUnlockedClass(admin, localLearnerId)) chapters.add(0)
  }
  return [...chapters]
}
