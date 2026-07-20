// Pure aggregation for the instructor cohort dashboard (api/cohorts/summary.js).
// Takes raw Supabase rows (snake_case) and folds them into one row per enrolled
// learner. Kept pure so it can be unit-tested without a database.

function bestExam(attempts) {
  if (!attempts.length) return null
  const best = attempts.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a))
  return { score: best.score ?? 0, passed: attempts.some((a) => a.passed === true) }
}

export function buildCohortSummary({
  enrollments = [],
  lessonProgress = [],
  quizAttempts = [],
  examAttempts = [],
  simulationRuns = [],
  gameResults = [],
  attendance = [],
  sessions = [],
} = {}) {
  const emptyBucket = () => ({
    lessons: new Set(),
    quizPassed: new Set(),
    exams: { pre: [], post: [] },
    scenariosPassed: new Set(),
    game: null,
    attendance: {},
    lastActivity: null,
  })
  const byLearner = new Map()
  const bucket = (id) => {
    if (!byLearner.has(id)) byLearner.set(id, emptyBucket())
    return byLearner.get(id)
  }
  const touch = (b, ts) => {
    if (ts && (!b.lastActivity || ts > b.lastActivity)) b.lastActivity = ts
  }

  for (const r of lessonProgress) {
    if (!r.learner_id || !r.lesson_id) continue
    const b = bucket(r.learner_id)
    b.lessons.add(r.lesson_id)
    touch(b, r.read_at)
  }
  for (const r of quizAttempts) {
    if (!r.learner_id || !r.lesson_id) continue
    const b = bucket(r.learner_id)
    if (r.passed === true) b.quizPassed.add(r.lesson_id)
    touch(b, r.finished_at)
  }
  for (const r of examAttempts) {
    if (!r.learner_id || (r.kind !== 'pre' && r.kind !== 'post')) continue
    const b = bucket(r.learner_id)
    b.exams[r.kind].push(r)
    touch(b, r.finished_at)
  }
  for (const r of simulationRuns) {
    if (!r.learner_id || !r.scenario_id) continue
    const b = bucket(r.learner_id)
    if (r.passed === true) b.scenariosPassed.add(r.scenario_id)
    touch(b, r.finished_at)
  }
  for (const r of gameResults) {
    if (!r.learner_id) continue
    const b = bucket(r.learner_id)
    if (!b.game || (r.score ?? 0) > (b.game.score ?? 0)) {
      b.game = { score: r.score ?? 0, grade: r.grade ?? null, won: r.won === true }
    }
    touch(b, r.finished_at)
  }
  const sessionIds = new Set(sessions.map((s) => s.id))
  for (const r of attendance) {
    if (!r.learner_id || !sessionIds.has(r.session_id)) continue
    bucket(r.learner_id).attendance[r.session_id] = r.status
  }

  const learners = enrollments.map((e) => {
    const b = byLearner.get(e.learner_id) || emptyBucket()
    return {
      learnerId: e.learner_id,
      name: e.name || null,
      phone: e.phone || null,
      joinedAt: e.joined_at || null,
      lessonsRead: b.lessons.size,
      quizzesPassed: b.quizPassed.size,
      preTest: bestExam(b.exams.pre),
      postTest: bestExam(b.exams.post),
      scenariosPassed: b.scenariosPassed.size,
      gameBest: b.game,
      attendance: b.attendance,
      lastActivity: b.lastActivity,
    }
  })

  // Newest joiners last, so the table reads in roughly the order students signed up.
  learners.sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || ''))

  return {
    learners,
    sessions: sessions.map((s) => ({ id: s.id, title: s.title })),
  }
}
