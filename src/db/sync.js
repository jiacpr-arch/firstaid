import { db, mergeServerProgress } from './database'
import { authHeader } from '../utils/authHeader'
import { isSupabaseConfigured } from '../config/supabaseClient'

// Pushes offline-first Dexie rows up to Supabase via /api/sync/push. Rows are
// marked synced (syncedAt) on success; on failure they stay unsynced and are
// retried on the next trigger (post-save, app load, coming back online, or the
// periodic tick), which gives natural event-paced backoff without a scheduler.

let inFlight = null
let inFlightFor = null

const unsynced = (table, learnerId) =>
  db[table].where('learnerId').equals(learnerId).filter((r) => !r.syncedAt).toArray()

async function markSynced(table, rows) {
  const now = new Date().toISOString()
  await Promise.all(rows.map((r) => db[table].update(r.autoId, { syncedAt: now })))
}

export async function flushSync(learnerId) {
  if (!learnerId || !isSupabaseConfigured) return { skipped: true }
  if (inFlight) {
    // A flush for a DIFFERENT learner id (the login/adopt moment) must not be
    // swallowed by the in-flight one — queue it to run right after.
    if (inFlightFor === learnerId) return inFlight
    return inFlight.then(() => flushSync(learnerId))
  }
  inFlightFor = learnerId
  inFlight = (async () => {
    try {
      const [lessonProgress, quizAttempts, simulationRuns, examAttempts] = await Promise.all([
        unsynced('lessonProgress', learnerId),
        unsynced('quizAttempts', learnerId),
        unsynced('simulationRuns', learnerId),
        unsynced('examAttempts', learnerId),
      ])
      const examWithAnswers = examAttempts.filter((r) => r.answers)
      const total =
        lessonProgress.length + quizAttempts.length + simulationRuns.length + examWithAnswers.length
      if (total === 0) return { ok: true, nothing: true }

      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          learnerId,
          lessonProgress: lessonProgress.map((r) => ({ lessonId: r.lessonId, readAt: r.readAt })),
          quizAttempts,
          simulationRuns,
          examAttempts: examWithAnswers.map((r) => ({
            uuid: r.uuid, kind: r.kind, answers: r.answers, finishedAt: r.finishedAt,
          })),
        }),
      })
      if (!res.ok) return { ok: false, status: res.status }

      await Promise.all([
        markSynced('lessonProgress', lessonProgress),
        markSynced('quizAttempts', quizAttempts),
        markSynced('simulationRuns', simulationRuns),
        markSynced('examAttempts', examWithAnswers),
      ])
      return { ok: true, synced: total }
    } catch {
      // Network/offline — leave rows unsynced; a later trigger retries them.
      return { ok: false }
    } finally {
      inFlight = null
      inFlightFor = null
    }
  })()
  return inFlight
}

// A pull that failed (login on a flaky connection) is remembered here so the
// background loop keeps retrying — otherwise a new device would show an empty
// progress screen forever with no recovery path.
const PULL_PENDING_KEY = 'firstaid.pullPending'

export function markPullNeeded() {
  try { localStorage.setItem(PULL_PENDING_KEY, '1') } catch { /* private mode */ }
}

function clearPullNeeded() {
  try { localStorage.removeItem(PULL_PENDING_KEY) } catch { /* private mode */ }
}

function isPullNeeded() {
  try { return !!localStorage.getItem(PULL_PENDING_KEY) } catch { return false }
}

// Pulls a learner's progress back down from Supabase and merges it into the
// local Dexie cache — the counterpart to flushSync(), used when a learner logs
// in with LINE on a device that has no local history for their canonical id
// (see linkLearnerToAuth). Requires a live session; no-ops otherwise since the
// server rejects anonymous pulls.
export async function pullSync(learnerId) {
  if (!learnerId || !isSupabaseConfigured) return { skipped: true }
  const headers = await authHeader()
  if (!headers.Authorization) return { skipped: true }
  try {
    const res = await fetch('/api/sync/pull', { headers })
    if (!res.ok) return { ok: false, status: res.status }
    const data = await res.json()
    await mergeServerProgress(learnerId, data)
    clearPullNeeded()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// Wires background sync triggers for a learner: flush now, whenever the device
// comes back online, when the tab regains focus, and on a slow periodic tick.
// Logged-in learners also pull periodically so progress made on another device
// shows up here (pull used to run only once, at first login). onPulled fires
// after each successful pull so the UI can refresh from Dexie.
// Returns a cleanup function. Safe to call again when the learner id changes.
export function startBackgroundSync(getLearnerId, { onPulled } = {}) {
  const run = () => { flushSync(getLearnerId()) }
  const pull = async () => {
    const result = await pullSync(getLearnerId())
    if (result.ok) onPulled?.(getLearnerId())
  }
  run()
  pull()
  const onOnline = () => { run(); if (isPullNeeded()) pull() }
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    run()
    if (isPullNeeded()) pull()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(run, 60_000)
  const pullTimer = setInterval(pull, 5 * 60_000)
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
    clearInterval(pullTimer)
  }
}
