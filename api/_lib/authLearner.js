// Resolves the canonical learner_id for the caller from a Supabase Auth bearer token, minted by
// either login bridge: LINE (api/auth/line.js), via line_identities directly (public schema, a
// plain PostgREST query), or the Hub SSO login (api/auth/hub.js) for an account that adopted with
// no LINE linked, via public.jia_firstaid_hub_learner (learning_hub.firstaid_hub_learners isn't in
// the public schema, so there's no direct query for it — see jia-learning-hub,
// 20261014100000_firstaid_hub_learner_resolve.sql). Returns null when there is no valid token, or
// the token is valid but resolves to no learner_id in either place — the app still supports
// anonymous, offline-first learners who never logged in at all.
export async function learnerIdFromToken(admin, req) {
  const auth = req.headers?.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: idn } = await admin
    .from('line_identities')
    .select('learner_id')
    .eq('auth_user_id', data.user.id)
    .maybeSingle()
  if (idn?.learner_id) return idn.learner_id
  try {
    const { data: hub } = await admin.rpc('jia_firstaid_hub_learner', { payload: { userId: data.user.id } })
    return hub?.learnerId || null
  } catch (err) {
    console.error('jia_firstaid_hub_learner resolve failed (non-fatal)', err)
    return null
  }
}

// Is this learnerId already claimed by a real (authenticated) account — via either login bridge?
// Used to refuse an anonymous caller who supplies someone else's known learnerId (endpoints that
// allow anonymous, offline-first callers still must not let one impersonate/block a real account
// just by guessing or reusing its learnerId). Checks line_identities directly, then the same Hub
// resolver learnerIdFromToken uses for the email-only-adopt case (see its own comment above).
export async function isLearnerIdBound(admin, learnerId) {
  const { data: bound } = await admin
    .from('line_identities')
    .select('learner_id')
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (bound) return true
  try {
    const { data: hub } = await admin.rpc('jia_firstaid_hub_learner', { payload: { learnerId } })
    return !!hub?.bound
  } catch (err) {
    console.error('jia_firstaid_hub_learner bound-check failed (non-fatal)', err)
    return false
  }
}

// Given a body-supplied learnerId and an authenticated learner (or null),
// returns the id to trust: the authenticated one wins, and a mismatch is a
// forbidden cross-account attempt. { learnerId, forbidden } — check forbidden first.
export function reconcileLearner(bodyLearnerId, tokenLearnerId) {
  if (tokenLearnerId) {
    if (bodyLearnerId && bodyLearnerId !== tokenLearnerId) {
      return { learnerId: null, forbidden: true }
    }
    return { learnerId: tokenLearnerId, forbidden: false }
  }
  return { learnerId: bodyLearnerId || null, forbidden: false }
}
