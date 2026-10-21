// Pure matching of CPR-course progress (cpr.morroo.com / jia-online tables in the
// same Supabase project) onto a firstaid cohort's enrollments. The two sites share
// no learner key, so a class links them through its CPR class code
// (lead_promo_codes, created by api/cohorts/manage.js): redeeming it records the
// student's phone in lead_promo_redemptions and tags online_students.company.
// We match on the last 9 phone digits — the same key jia-online uses
// (0812345678 and 66812345678 are the same person).
//
// online_students is written directly from the CPR site's browser, so this is a
// progress display for the instructor, not proof of a passed exam.

// online_students.company / lead_promo_codes.company value for a class's CPR code.
export function cprCompanyTag(promoCode) {
  return `firstaid-class:${promoCode}`
}

export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : null
}

// enrollments: [{ learner_id, phone }]
// redemptions: [{ phone_key, redeemed_at }]            (lead_promo_redemptions for the class code)
// students:    [{ phone, status, final_score, completed_at, chapter_scores }]  (online_students)
// Returns Map(learnerId → { redeemed, modulesDone, finalScore, completed })
export function matchCprProgress({ enrollments = [], redemptions = [], students = [] } = {}) {
  const redeemed = new Set(redemptions.map((r) => r.phone_key).filter(Boolean))
  const byPhone = new Map()
  for (const s of students) {
    const key = phoneKey(s.phone)
    if (!key) continue
    const prev = byPhone.get(key)
    // Several rows per phone happen (re-registering on a new device) — keep the most advanced.
    if (!prev || rank(s) > rank(prev)) byPhone.set(key, s)
  }

  const out = new Map()
  for (const e of enrollments) {
    const key = phoneKey(e.phone)
    if (!key) continue
    const s = byPhone.get(key)
    if (!s && !redeemed.has(key)) continue
    out.set(e.learner_id, {
      redeemed: redeemed.has(key),
      modulesDone: s ? countModules(s.chapter_scores) : 0,
      finalScore: s?.final_score ?? null,
      completed: s ? isCompleted(s) : false,
    })
  }
  return out
}

function countModules(scores) {
  if (!scores || typeof scores !== 'object') return 0
  return Object.values(scores).filter((v) => Number(v) > 0).length
}

function isCompleted(s) {
  return !!s.completed_at || String(s.status || '').includes('จบคอร์ส')
}

function rank(s) {
  return (isCompleted(s) ? 1000 : 0) + countModules(s.chapter_scores)
}
