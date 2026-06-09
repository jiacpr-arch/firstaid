import { getSupabaseAdmin } from './supabaseAdmin.js'

// Verifies the request bearer token against Supabase auth.
// Returns the user object on success, null + writes 401 on failure.
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
  return data.user
}
