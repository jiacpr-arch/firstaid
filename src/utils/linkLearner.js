import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'
import { useProgressStore } from '../stores/progressStore'
import { pullSync } from '../db/sync'

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

  // Adopting a different id means our in-memory progress is for the wrong learner —
  // this device has never seen it locally (new device/browser), so pull it down
  // from Supabase before reloading the progress store from the (now populated)
  // local cache.
  if (adoptId) {
    await pullSync(merged.id)
    await useProgressStore.getState().refresh(merged.id)
  }
  return merged
}
