import Dexie from 'dexie'
import { v4 as uuidv4 } from 'uuid'

export const db = new Dexie('FIRSTAID')

db.version(1).stores({
  learners: 'id, name, phone, cohortCode, createdAt, syncedAt',
  lessonProgress: '++autoId, [learnerId+lessonId], readAt, syncedAt',
  quizAttempts: '++autoId, uuid, learnerId, lessonId, finishedAt, score, passed, syncedAt',
  examAttempts: '++autoId, uuid, learnerId, kind, finishedAt, score, passed, syncedAt',
  simulationRuns: '++autoId, uuid, learnerId, scenarioId, finishedAt, score, syncedAt',
  attendance: '++autoId, uuid, learnerId, sessionId, checkedInAt, status, syncedAt',
  certificates: 'id, learnerId, kind, issuedAt, code, syncedAt',
  syncFailures: '++autoId, table, refId, attempts, lastError, nextRetryAt',
})

// ===== Learner =====
export async function upsertLearner(learner) {
  const row = { id: learner.id || uuidv4(), createdAt: new Date().toISOString(), ...learner }
  await db.learners.put(row)
  return row
}

export async function getLearner(id) {
  return db.learners.get(id)
}

export async function getAllLearners() {
  return db.learners.orderBy('createdAt').reverse().toArray()
}

// ===== Lesson progress =====
export async function markLessonRead(learnerId, lessonId) {
  if (!learnerId) return null
  const existing = await db.lessonProgress
    .where('[learnerId+lessonId]').equals([learnerId, lessonId]).first()
  if (existing) return existing.autoId
  return db.lessonProgress.add({
    learnerId, lessonId, readAt: new Date().toISOString(),
  })
}

export async function getLessonProgress(learnerId) {
  if (!learnerId) return []
  return db.lessonProgress.where('learnerId').equals(learnerId).toArray()
}

export async function hasReadLesson(learnerId, lessonId) {
  if (!learnerId) return false
  const row = await db.lessonProgress
    .where('[learnerId+lessonId]').equals([learnerId, lessonId]).first()
  return !!row
}

// ===== Quiz / exam attempts =====
export async function saveQuizAttempt(attempt) {
  const row = { uuid: uuidv4(), finishedAt: new Date().toISOString(), ...attempt }
  return db.quizAttempts.add(row)
}

export async function saveExamAttempt(attempt) {
  // attempt.kind ∈ 'pre' | 'post'
  const row = { uuid: uuidv4(), finishedAt: new Date().toISOString(), ...attempt }
  return db.examAttempts.add(row)
}

export async function getQuizAttempt(autoId) {
  return db.quizAttempts.get(Number(autoId))
}

export async function getExamAttempt(autoId) {
  return db.examAttempts.get(Number(autoId))
}

export async function getBestLessonScore(learnerId, lessonId) {
  if (!learnerId) return null
  const rows = await db.quizAttempts.where('learnerId').equals(learnerId).toArray()
  const forLesson = rows.filter(r => r.lessonId === lessonId)
  if (!forLesson.length) return null
  return forLesson.reduce((b, r) => (r.score > (b?.score ?? -1) ? r : b), null)
}

export async function getBestExam(learnerId, kind) {
  if (!learnerId) return null
  const rows = await db.examAttempts.where('learnerId').equals(learnerId).toArray()
  const forKind = rows.filter(r => r.kind === kind)
  if (!forKind.length) return null
  return forKind.reduce((b, r) => (r.score > (b?.score ?? -1) ? r : b), null)
}

// ===== Simulation runs =====
export async function saveSimulationRun(run) {
  const row = { uuid: uuidv4(), finishedAt: new Date().toISOString(), ...run }
  return db.simulationRuns.add(row)
}

export async function getSimulationRun(autoId) {
  return db.simulationRuns.get(Number(autoId))
}

// scenarioId ของฉากที่ "ผ่านเกณฑ์" (passed) แล้ว — ใช้เป็นเงื่อนไขปลดล็อก Post-test
export async function getPassedScenarioIds(learnerId) {
  if (!learnerId) return []
  const rows = await db.simulationRuns.where('learnerId').equals(learnerId).toArray()
  return [...new Set(rows.filter((r) => r.passed).map((r) => r.scenarioId))]
}

// ===== Attendance =====
export async function saveAttendance(attendance) {
  const row = { uuid: uuidv4(), checkedInAt: new Date().toISOString(), status: 'pending', ...attendance }
  return db.attendance.add(row)
}

// ===== Certificates =====
export async function saveCertificate(cert) {
  // cert: { id, learnerId, kind, code, issuedAt, learnerName }
  await db.certificates.put(cert)
  return cert
}

export async function getCertificates(learnerId) {
  if (!learnerId) return []
  return db.certificates.where('learnerId').equals(learnerId).toArray()
}

// ===== Re-key on canonical-id adoption =====
// When LINE login adopts the canonical learner id from another device, rows the
// user already created locally under the throwaway anonymous id would otherwise
// be stranded (flushSync only queries the new id, so they'd never be pushed).
// Re-key them to the new id and clear syncedAt so the next flush uploads them.
export async function rekeyLearnerData(oldId, newId) {
  if (!oldId || !newId || oldId === newId) return
  const tables = [db.lessonProgress, db.quizAttempts, db.examAttempts, db.simulationRuns, db.attendance, db.certificates]
  await db.transaction('rw', tables, async () => {
    for (const table of ['quizAttempts', 'examAttempts', 'simulationRuns', 'attendance']) {
      await db[table].where('learnerId').equals(oldId).modify({ learnerId: newId, syncedAt: null })
    }
    // lessonProgress dedupes by [learnerId+lessonId] — drop rows the new id already has
    const rows = await db.lessonProgress.where('learnerId').equals(oldId).toArray()
    for (const r of rows) {
      const dupe = await db.lessonProgress
        .where('[learnerId+lessonId]').equals([newId, r.lessonId]).count()
      if (dupe) await db.lessonProgress.delete(r.autoId)
      else await db.lessonProgress.update(r.autoId, { learnerId: newId, syncedAt: null })
    }
    await db.certificates.where('learnerId').equals(oldId).modify({ learnerId: newId })
  })
}

// ===== Restore from server (cross-device) =====
// Merges rows pulled from /api/sync/pull into the local Dexie cache, so a
// learner who logs in with LINE on a new device sees their prior progress
// instead of starting over. Rows are deduped against what's already local
// (by uuid, or [learnerId+lessonId] for lesson progress) and stamped
// syncedAt so the push flow never re-sends them.
async function mergeByUuid(table, learnerId, rows) {
  const now = new Date().toISOString()
  for (const r of rows) {
    if (!r.uuid) continue
    const exists = await db[table].where('uuid').equals(r.uuid).count()
    if (exists) continue
    await db[table].add({ ...r, learnerId, syncedAt: now })
  }
}

export async function mergeServerProgress(learnerId, payload) {
  if (!learnerId || !payload) return
  const now = new Date().toISOString()

  for (const r of payload.lessonProgress || []) {
    if (!r.lessonId) continue
    const exists = await db.lessonProgress
      .where('[learnerId+lessonId]').equals([learnerId, r.lessonId]).count()
    if (exists) continue
    await db.lessonProgress.add({ learnerId, lessonId: r.lessonId, readAt: r.readAt, syncedAt: now })
  }

  await mergeByUuid('quizAttempts', learnerId, payload.quizAttempts || [])
  await mergeByUuid('examAttempts', learnerId, payload.examAttempts || [])
  await mergeByUuid('simulationRuns', learnerId, payload.simulationRuns || [])

  for (const c of payload.certificates || []) {
    if (!c.id) continue
    await db.certificates.put({ ...c, learnerId, syncedAt: now })
  }
}
