import { buildCohortSummary } from './cohortSummary.js'
import { matchCprProgress, cprCompanyTag, phoneKey } from './cprProgress.js'

// Fetches every row buildCohortSummary needs for one cohort and folds them into the
// dashboard summary. Shared by api/cohorts/summary.js and the session LINE report.
// Throws on database errors; returns null when the cohort does not exist.
export const MAX_LEARNERS = 200
const CHUNK = 100

function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function selectIn(admin, table, columns, ids) {
  const results = await Promise.all(
    chunks(ids, CHUNK).map((part) =>
      admin.from(table).select(columns).in('learner_id', part),
    ),
  )
  const rows = []
  for (const { data, error } of results) {
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

export async function loadCohortSummary(admin, cohortId) {
  const { data: cohort, error: cErr } = await admin
    .from('cohorts')
    .select('id, name, code, created_at, deleted_at, includes_cpr, cpr_promo_code, starts_on')
    .eq('id', cohortId)
    .maybeSingle()
  if (cErr) throw cErr
  if (!cohort) return null

  const { data: enrollments, error: eErr } = await admin
    .from('enrollments')
    .select('learner_id, name, phone, joined_at, group_label')
    .eq('cohort_id', cohortId)
    .order('joined_at')
    .limit(MAX_LEARNERS)
  if (eErr) throw eErr

  const { data: sessions, error: sErr } = await admin
    .from('practical_sessions')
    .select('id, title')
    .eq('cohort_id', cohortId)
    .order('starts_at')
  if (sErr) throw sErr

  const ids = [...new Set((enrollments || []).map((e) => e.learner_id))]
  let progress = {
    lessonProgress: [], quizAttempts: [], examAttempts: [],
    simulationRuns: [], gameResults: [], attendance: [],
  }
  if (ids.length) {
    const [lessonProgress, quizAttempts, examAttempts, simulationRuns, gameResults, attendance] =
      await Promise.all([
        selectIn(admin, 'lesson_progress', 'learner_id, lesson_id, read_at', ids),
        selectIn(admin, 'quiz_attempts', 'learner_id, lesson_id, passed, finished_at', ids),
        selectIn(admin, 'exam_attempts', 'learner_id, kind, score, passed, finished_at', ids),
        selectIn(admin, 'simulation_runs', 'learner_id, scenario_id, passed, finished_at', ids),
        selectIn(admin, 'game_results', 'learner_id, score, grade, won, finished_at', ids),
        selectIn(admin, 'attendance', 'learner_id, session_id, status', ids),
      ])
    progress = { lessonProgress, quizAttempts, examAttempts, simulationRuns, gameResults, attendance }
  }

  const cpr = cohort.includes_cpr && cohort.cpr_promo_code
    ? await loadCprProgress(admin, cohort.cpr_promo_code, enrollments || [])
    : new Map()

  // ชื่อ LINE (ชื่อโปรไฟล์ที่ผู้เรียนใช้) แสดงคู่ชื่อจริงในภาพรวม/รายงาน — ไม่ใช่ชื่อบนใบประกาศ
  const lineNames = ids.length ? await loadLineNames(admin, ids) : new Map()

  const summary = buildCohortSummary({ enrollments: enrollments || [], sessions: sessions || [], ...progress, cpr, lineNames })
  return {
    cohort: {
      id: cohort.id, name: cohort.name, code: cohort.code, createdAt: cohort.created_at,
      includesCpr: !!cohort.includes_cpr, cprPromoCode: cohort.cpr_promo_code || null, startsOn: cohort.starts_on || null,
    },
    capped: (enrollments || []).length >= MAX_LEARNERS,
    ...summary,
  }
}

// CPR progress lives in jia-online's tables (same Supabase project). The class code's
// redemptions give the phones that started the CPR course; online_students tagged with the
// class's company carries their progress. Non-fatal: a CPR-side failure only blanks the column.
export async function loadCprProgress(admin, promoCode, enrollments) {
  try {
    // แถวที่ติดแท็กคลาส + แถวที่หาด้วยเบอร์ของนักเรียนในคลาส — บางคนเรียน CPR โดยไม่ได้กรอกโค้ดคลาสตอนสมัคร
    // (online_students.company ว่าง) หรือเรียนจบไปก่อนแล้ว ฝั่งนักเรียน (api/cohorts/my-cpr.js) หาด้วยเบอร์อยู่แล้ว
    // ครูต้องเห็นตรงกัน ไม่งั้นนักเรียนขึ้นว่า CPR จบแต่ครูเห็น "รอเรียน CPR & AED"
    const keys = [...new Set((enrollments || []).map((e) => phoneKey(e.phone)).filter(Boolean))]
    const COLS = 'phone, status, final_score, completed_at, chapter_scores'
    const byPhoneQueries = []
    for (let i = 0; i < keys.length; i += 40) {
      const batch = keys.slice(i, i + 40)
      byPhoneQueries.push(admin.from('online_students').select(COLS).or(batch.map((k) => `phone.ilike.*${k}`).join(',')))
    }
    const [{ data: redemptions, error: rErr }, { data: students, error: sErr }, ...byPhone] = await Promise.all([
      admin.from('lead_promo_redemptions').select('phone_key, redeemed_at').eq('code', promoCode),
      admin.from('online_students').select(COLS).eq('company', cprCompanyTag(promoCode)),
      ...byPhoneQueries,
    ])
    if (rErr) throw rErr
    if (sErr) throw sErr
    const extra = []
    for (const q of byPhone) {
      if (q.error) throw q.error
      extra.push(...(q.data || []))
    }
    return matchCprProgress({ enrollments, redemptions: redemptions || [], students: [...(students || []), ...extra] })
  } catch (err) {
    console.error('cohort summary: CPR progress lookup failed (non-fatal)', err)
    return new Map()
  }
}

// line_identities.display_name ของแต่ละ learner (ผู้ที่ล็อกอินแล้ว) — ล้มเหลวได้โดยไม่ทำให้ทั้งหน้าพัง
async function loadLineNames(admin, ids) {
  try {
    const rows = await selectIn(admin, 'line_identities', 'learner_id, display_name', ids)
    return new Map(rows.filter((r) => r.display_name).map((r) => [r.learner_id, r.display_name]))
  } catch (err) {
    console.error('cohort summary: LINE name lookup failed (non-fatal)', err)
    return new Map()
  }
}
