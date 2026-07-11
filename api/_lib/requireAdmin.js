import { getSupabaseAdmin } from './supabaseAdmin.js'

// Verifies the request bearer token against Supabase auth AND that the user is
// an actual admin. A valid token alone is not enough: the LINE-login bridge
// (api/auth/line.js) mints Supabase auth users for every learner, so any
// logged-in learner carries a token that passes auth.getUser().
// Admins are recognized by app_metadata.role === 'admin' or by the
// ADMIN_EMAILS env var (comma-separated). If neither matches, 403.
// Returns the user object on success, null + writes 401/403 on failure.
export async function requireAdmin(req, res) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    res.status(500).json({ error: 'Supabase not configured' })
    return null
  }
  const auth = req.headers?.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return null
  }
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
  if (!isAdminUser(data.user)) {
    res.status(403).json({ error: 'Not an admin' })
    return null
  }
  return data.user
}

function isAdminUser(user) {
  if (user.app_metadata?.role === 'admin') return true
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length === 0) {
    console.error('requireAdmin: ADMIN_EMAILS is not set and user has no admin role — denying')
    return false
  }
  return !!user.email && allowlist.includes(user.email.toLowerCase())
}
