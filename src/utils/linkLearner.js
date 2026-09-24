import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner, rekeyLearnerData } from '../db/database'
import { useProgressStore } from '../stores/progressStore'
import { pullSync, flushSync, markPullNeeded } from '../db/sync'
import { authHeader } from './authHeader'

// Link the local (anonymous) learner profile to the newly authenticated account.
//
// All progress (Dexie + Supabase) is keyed by learner.id, so we normally keep that
// id and just attach the auth identity. The one exception is logging in on a NEW
// device: the bridge returns the canonical learnerId from the first device, which we
// must adopt BEFORE any new progress is written so rows aren't orphaned under the
// throwaway local id.
export async function linkLearnerToAuth({ session, lineUserId, displayName, pictureUrl, lineEmail, canonicalLearnerId }) {
  const { learner, setLearner } = useLearnerStore.getState()
  const adoptId = canonicalLearnerId && canonicalLearnerId !== learner?.id

  const merged = {
    ...(learner || {}),
    id: adoptId ? canonicalLearnerId : (learner?.id || canonicalLearnerId),
    name: displayName || learner?.name || '',
    email: lineEmail || learner?.email || '',
    pictureUrl: pictureUrl || learner?.pictureUrl || '',
    // Omitted (Hub SSO login, no LINE involved) keeps whatever LINE identity this learner already
    // had rather than clobbering it with nothing — this function's LINE caller always passes a
    // real value here, so that path is unaffected.
    lineUserId: lineUserId ?? learner?.lineUserId ?? null,
    authUserId: session?.user?.id || null,
    // NB: `lineAdded` really means "has satisfied the mandatory post-lesson-1 login gate"
    // (LessonReader.jsx's needLoginGate) more than it literally means "added the LINE OA" — a
    // pre-existing overload, not something this change introduces. A Hub SSO (email) login must
    // also clear that gate, so this stays unconditional regardless of which provider logged in.
    lineAdded: true,
  }

  setLearner(merged)
  await upsertLearner(merged)

  if (adoptId) {
    // Progress this device already wrote under the throwaway anonymous id must
    // move to the canonical id first — otherwise flushSync (which queries the
    // new id) would never push it and it'd be stranded locally forever.
    await rekeyLearnerData(learner?.id, merged.id)

    // Pull the account's progress from Supabase before reloading the progress
    // store. A transient failure here used to mean a permanently empty screen —
    // now the background loop keeps retrying until a pull succeeds.
    const pulled = await pullSync(merged.id)
    if (!pulled.ok) markPullNeeded()
    await useProgressStore.getState().refresh(merged.id)

    // Push the re-keyed rows up under the canonical id (fire-and-forget).
    flushSync(merged.id)

    // A cohort enrollment made under the throwaway id doesn't follow the rekey
    // (enrollments live only in Supabase) — re-join under the canonical id so
    // the learner stays visible on the instructor dashboard.
    if (merged.cohortCode) {
      authHeader()
        .then((h) => fetch('/api/cohorts/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({
            code: merged.cohortCode,
            learnerId: merged.id,
            name: merged.name || null,
            phone: merged.phone || null,
          }),
        }))
        .catch(() => {})
    }
  }
  return merged
}
