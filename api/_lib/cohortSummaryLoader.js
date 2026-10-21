import { buildCohortSummary } from './cohortSummary.js'
import { matchCprProgress, cprCompanyTag } from './cprProgress.js'

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

  const summary = buildCohortSummary({ enrollments: enrollments || [], sessions: sessions || [], ...progress, cpr })
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
async function loadCprProgress(admin, promoCode, enrollments) {
  try {
    const [{ data: redemptions, error: rErr }, { data: students, error: sErr }] = await Promise.all([
      admin.from('lead_promo_redemptions').select('phone_key, redeemed_at').eq('code', promoCode),
      admin.from('online_students')
        .select('phone, status, final_score, completed_at, chapter_scores')
        .eq('company', cprCompanyTag(promoCode)),
    ])
    if (rErr) throw rErr
    if (sErr) throw sErr
    return matchCprProgress({ enrollments, redemptions: redemptions || [], students: students || [] })
  } catch (err) {
    console.error('cohort summary: CPR progress lookup failed (non-fatal)', err)
    return new Map()
  }
}
