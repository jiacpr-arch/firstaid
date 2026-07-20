import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/requireAdmin.js'
import { buildCohortSummary } from '../_lib/cohortSummary.js'

// Instructor dashboard: aggregated progress for every learner enrolled in a
// cohort. The learner-data tables are RLS-no-policy (service-role only), so the
// browser client cannot read them directly — this requireAdmin-gated endpoint
// is the only read path.
const MAX_LEARNERS = 200
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

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  const user = await requireAdmin(req, res)
  if (!user) return
  const admin = getSupabaseAdmin()

  const cohortId = req.query?.cohortId
  if (!cohortId) { res.status(400).json({ error: 'Missing cohortId' }); return }

  try {
    const { data: cohort, error: cErr } = await admin
      .from('cohorts')
      .select('id, name, code, created_at, deleted_at')
      .eq('id', cohortId)
      .maybeSingle()
    if (cErr) throw cErr
    if (!cohort) { res.status(404).json({ error: 'Cohort not found' }); return }

    const { data: enrollments, error: eErr } = await admin
      .from('enrollments')
      .select('learner_id, name, phone, joined_at')
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

    const summary = buildCohortSummary({ enrollments: enrollments || [], sessions: sessions || [], ...progress })

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      ok: true,
      cohort: { id: cohort.id, name: cohort.name, code: cohort.code, createdAt: cohort.created_at },
      capped: (enrollments || []).length >= MAX_LEARNERS,
      ...summary,
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'summary failed' })
  }
}
