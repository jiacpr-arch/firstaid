import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

// Learner Supabase Auth session (separate concern from the local learner profile).
// Initialized once from App.jsx via initAuthListener(); components read it reactively.
export const useAuthStore = create((set) => ({
  // When Supabase isn't configured we can't auth — treat as resolved-and-logged-out
  // so the app falls back to the local honor-system gate instead of hanging.
  session: null,
  loading: isSupabaseConfigured,
  setSession: (session) => set({ session, loading: false }),
}))

let started = false

// Wire getSession() + onAuthStateChange once. Returns an unsubscribe fn.
export function initAuthListener() {
  if (started || !isSupabaseConfigured) {
    if (!isSupabaseConfigured) useAuthStore.setState({ loading: false })
    return () => {}
  }
  started = true
  const { setSession } = useAuthStore.getState()

  supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null))
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session ?? null)
  })
  return () => {
    started = false
    sub.subscription.unsubscribe()
  }
}
