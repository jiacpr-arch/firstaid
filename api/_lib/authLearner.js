// Resolves the canonical learner_id for the caller from a Supabase Auth bearer
// token (minted by the LINE-login bridge, api/auth/line.js) via line_identities.
// Returns null when there is no valid token — the app still supports anonymous,
// offline-first learners who never logged in with LINE.
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
  return idn?.learner_id || null
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
