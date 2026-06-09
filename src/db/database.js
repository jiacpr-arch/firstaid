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

// ===== Attendance =====
export async function saveAttendance(attendance) {
  const row = { uuid: uuidv4(), checkedInAt: new Date().toISOString(), status: 'pending', ...attendance }
  return db.attendance.add(row)
}

// ===== Certificates =====
export async function saveCertificate(cert) {
  // cert: { id, learnerId, kind, code, issuedAt }
  await db.certificates.put(cert)
  return cert
}

export async function getCertificates(learnerId) {
  if (!learnerId) return []
  return db.certificates.where('learnerId').equals(learnerId).toArray()
}
