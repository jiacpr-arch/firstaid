import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner, rekeyLearnerData } from '../db/database'
import { useProgressStore } from '../stores/progressStore'
import { pullSync, flushSync, markPullNeeded } from '../db/sync'

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
    lineUserId,
    authUserId: session?.user?.id || null,
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
  }
  return merged
}
