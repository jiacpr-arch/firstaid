import { cprCompanyTag } from './cprProgress.js'
import { cprLearnerTag } from './cprCourse.js'
import { resolveChapters, cleanLocalLearnerId } from './entitlements.js'

// ใครเรียนคอร์ส CPR & AED ในเว็บนี้ได้ (หน้า /cpr) และผลไปบันทึกที่แถว online_students ไหน
// 1) คลาสรวม CPR + ปฐมพยาบาล (cohorts.includes_cpr) — ฟรี ผลผูกกับเบอร์ในคลาส (ครูเห็นด้วย)
// 2) มีสิทธิ์หมวด 5 (CPR) หรือทั้งคอร์ส (0) — ซื้อโค้ด/คลาสที่เปิดทุกบท ผลผูกกับ learnerId
// คืน null = ยังไม่มีสิทธิ์ (ต้องซื้อหมวด CPR ก่อน)
export const CPR_CHAPTER = 5

export async function resolveCprAccess(admin, { code, learnerId, tokenLearnerId, name = '', phone = '' }) {
  if (code) {
    const { data: cohort, error } = await admin
      .from('cohorts')
      .select('id, deleted_at, includes_cpr, cpr_promo_code')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    if (cohort && !cohort.deleted_at && cohort.includes_cpr && cohort.cpr_promo_code) {
      const { data: enrollment, error: eErr } = await admin
        .from('enrollments')
        .select('learner_id, name, phone')
        .eq('cohort_id', cohort.id)
        .eq('learner_id', learnerId)
        .maybeSingle()
      if (eErr) throw eErr
      if (enrollment) {
        return {
          kind: 'class', tag: cprCompanyTag(cohort.cpr_promo_code), matchPhone: true, preCourse: true,
          name: enrollment.name || name, phone: enrollment.phone || '',
        }
      }
    }
  }
  const chapters = await resolveChapters(admin, {
    tokenLearnerId: tokenLearnerId || null,
    localLearnerId: cleanLocalLearnerId(learnerId, tokenLearnerId || null),
  })
  if (chapters.includes(0) || chapters.includes(CPR_CHAPTER)) {
    return {
      kind: 'paid', tag: cprLearnerTag(learnerId), matchPhone: false, preCourse: false,
      name: String(name || '').slice(0, 120), phone: String(phone || '').replace(/\D/g, '').slice(0, 15),
    }
  }
  return null
}
