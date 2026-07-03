import { db } from './database'
import { authHeader } from '../utils/authHeader'
import { isSupabaseConfigured } from '../config/supabaseClient'

// Pushes offline-first Dexie rows up to Supabase via /api/sync/push. Rows are
// marked synced (syncedAt) on success; on failure they stay unsynced and are
// retried on the next trigger (post-save, app load, coming back online, or the
// periodic tick), which gives natural event-paced backoff without a scheduler.

let inFlight = null

const unsynced = (table, learnerId) =>
  db[table].where('learnerId').equals(learnerId).filter((r) => !r.syncedAt).toArray()

async function markSynced(table, rows) {
  const now = new Date().toISOString()
  await Promise.all(rows.map((r) => db[table].update(r.autoId, { syncedAt: now })))
}

export async function flushSync(learnerId) {
  if (!learnerId || !isSupabaseConfigured) return { skipped: true }
  if (inFlight) return inFlight
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
    }
  })()
  return inFlight
}

// Wires background sync triggers for a learner: flush now, whenever the device
// comes back online, when the tab regains focus, and on a slow periodic tick.
// Returns a cleanup function. Safe to call again when the learner id changes.
export function startBackgroundSync(getLearnerId) {
  const run = () => { flushSync(getLearnerId()) }
  run()
  const onOnline = () => run()
  const onVisible = () => { if (document.visibilityState === 'visible') run() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(run, 60_000)
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  }
}
