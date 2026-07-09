import { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useEntitlementStore } from '../stores/entitlementStore'

// Loads the learner's purchased chapters whenever the Supabase auth session
// settles (login, logout, or initial load). Safe to call from any gated page —
// mirrors useEnsureProgress so deep-links get the right lock/unlock state.
export function useEnsureEntitlements() {
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const refresh = useEntitlementStore((s) => s.refresh)
  useEffect(() => {
    if (authLoading) return
    refresh(session)
  }, [session, authLoading, refresh])
}
