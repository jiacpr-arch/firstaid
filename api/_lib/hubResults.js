// Sends server-scored exam attempts to the Hub's central exam record (learning_hub.exam_results in
// jia-learning-hub, 20261016100000_exam_results.sql). firstaid is on the Hub's own Supabase project,
// so this is a plain service-role RPC — public.jia_results('record'), the same way hubIdentity.js
// calls jia_line_hub. The Hub recomputes score/pass from correct/total against its own firstaid pass
// mark and keys the row on (source client, attempt uuid), so re-sending an attempt is a no-op.
//
// Only for an authenticated caller: the Hub record belongs to a real account (userId from the
// bearer token), never to an anonymous learnerId. Never throws — a Hub that is down, not migrated
// yet, or that refuses a row must not block the learner's own sync or certificate.
export const HUB_RESULTS_CLIENT = 'firstaid'
export const HUB_COURSE_ID = 'firstaid'

export async function recordExamsAtHub(admin, userId, attempts) {
  const out = { recorded: 0, failed: 0 }
  if (!userId || !Array.isArray(attempts)) return out
  for (const a of attempts) {
    if (!a?.uuid || (a.kind !== 'pre' && a.kind !== 'post') || !Number.isInteger(a.correct) || !Number.isInteger(a.total)) continue
    try {
      const { error } = await admin.rpc('jia_results', {
        action: 'record',
        payload: {
          sourceClient: HUB_RESULTS_CLIENT,
          userId,
          courseId: HUB_COURSE_ID,
          kind: a.kind,
          correct: a.correct,
          total: a.total,
          attemptRef: a.uuid,
          finishedAt: a.finished_at || null,
        },
      })
      if (error) throw error
      out.recorded++
    } catch (err) {
      out.failed++
      console.warn('hub exam result not recorded (non-fatal)', err?.message || err)
    }
  }
  return out
}
