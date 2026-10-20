// Pure aggregation for the per-learner detail page (api/cohorts/learner.js).
// Takes raw Supabase rows (snake_case) for ONE learner and folds them into a
// single object. Pure so it can be unit-tested without a database.

const byNewest = (a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '')

export function buildLearnerDetail({
  enrollment,
  lessonProgress = [],
  quizAttempts = [],
  examAttempts = [],
  simulationRuns = [],
  gameResults = [],
  sessions = [],
  attendance = [],
  stations = [],
  stationCheckins = [],
  certificates = [],
} = {}) {
  let lastActivity = null
  const touch = (ts) => { if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts }

  const readIds = []
  const readAt = {}
  for (const r of lessonProgress) {
    if (!r.lesson_id) continue
    if (!readIds.includes(r.lesson_id)) readIds.push(r.lesson_id)
    readAt[r.lesson_id] = r.read_at
    touch(r.read_at)
  }

  const quizPassedIds = []
  for (const r of quizAttempts) {
    if (r.passed === true && r.lesson_id && !quizPassedIds.includes(r.lesson_id)) quizPassedIds.push(r.lesson_id)
    touch(r.finished_at)
  }

  const exams = { pre: [], post: [] }
  for (const r of examAttempts) {
    if (r.kind !== 'pre' && r.kind !== 'post') continue
    exams[r.kind].push({ score: r.score ?? 0, passed: r.passed === true, finishedAt: r.finished_at })
    touch(r.finished_at)
  }
  exams.pre.sort(byNewest)
  exams.post.sort(byNewest)

  const scenariosPassedIds = []
  for (const r of simulationRuns) {
    if (r.passed === true && r.scenario_id && !scenariosPassedIds.includes(r.scenario_id)) scenariosPassedIds.push(r.scenario_id)
    touch(r.finished_at)
  }

  let game = null
  for (const r of gameResults) {
    if (!game || (r.score ?? 0) > game.score) {
      game = { score: r.score ?? 0, grade: r.grade ?? null, won: r.won === true }
    }
    touch(r.finished_at)
  }

  const attBySession = new Map(attendance.map((a) => [a.session_id, a]))
  const checkinByStation = new Map(stationCheckins.map((c) => [c.station_id, c]))
  const sessionRows = sessions.map((s) => {
    const a = attBySession.get(s.id)
    const stationRows = stations
      .filter((st) => st.session_id === s.id)
      .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
      .map((st) => {
        const c = checkinByStation.get(st.id)
        if (c?.checked_in_at) touch(c.checked_in_at)
        return {
          id: st.id,
          name: st.name,
          kind: st.kind,
          checkedInAt: c?.checked_in_at || null,
          passed: c ? c.passed : null,
          score: c?.score ?? null,
        }
      })
    if (a?.checked_in_at) touch(a.checked_in_at)
    return {
      id: s.id,
      title: s.title,
      startsAt: s.starts_at || null,
      attendance: a ? { status: a.status, checkedInAt: a.checked_in_at } : null,
      stations: stationRows,
    }
  })

  const certs = { theory: null, practical: null }
  for (const c of certificates) {
    if ((c.kind === 'theory' || c.kind === 'practical') && !c.revoked_at) {
      certs[c.kind] = { code: c.code, issuedAt: c.issued_at }
    }
  }

  return {
    learner: {
      learnerId: enrollment.learner_id,
      name: enrollment.name || null,
      phone: enrollment.phone || null,
      joinedAt: enrollment.joined_at || null,
      lastActivity,
    },
    lessons: { readIds, readAt, quizPassedIds },
    exams,
    scenariosPassedIds,
    game,
    sessions: sessionRows,
    certificates: certs,
  }
}

// รายการที่ "ยังขาด" เพื่อให้ครูเห็นว่านักเรียนติดอยู่ตรงไหน
// lessonIds/scenarioIds = ทั้งหมดในหลักสูตร (ส่งมาจากฝั่งเรียก)
export function computeGaps(detail, { lessonIds = [], scenarioIds = [] } = {}) {
  const read = new Set(detail.lessons.readIds)
  const quiz = new Set(detail.lessons.quizPassedIds)
  const scen = new Set(detail.scenariosPassedIds)
  const gaps = {
    lessonsUnread: lessonIds.filter((id) => !read.has(id)),
    quizzesNotPassed: lessonIds.filter((id) => read.has(id) && !quiz.has(id)),
    scenariosNotPassed: scenarioIds.filter((id) => !scen.has(id)),
    preTestMissing: detail.exams.pre.length === 0,
    postTestMissing: detail.exams.post.length === 0,
    stationsMissing: [],
    examStationsNotPassed: [],
  }
  for (const s of detail.sessions) {
    for (const st of s.stations) {
      if (st.kind === 'practice' && !st.checkedInAt) gaps.stationsMissing.push({ sessionId: s.id, name: st.name })
      if (st.kind === 'exam' && st.passed !== true) gaps.examStationsNotPassed.push({ sessionId: s.id, name: st.name })
    }
  }
  return gaps
}
