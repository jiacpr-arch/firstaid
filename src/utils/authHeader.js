import { supabase } from '../config/supabaseClient'

// Returns an { Authorization: 'Bearer <token>' } header when the learner has a
// live Supabase session (established via LINE login), else {}. Lets the API bind
// requests to the authenticated learner without breaking the anonymous flow.
export async function authHeader() {
  if (!supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}
