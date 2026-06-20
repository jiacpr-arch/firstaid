import { useAuthStore } from '../stores/authStore'

// Convenience selector for the learner auth session + its loading state.
export function useAuthSession() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  return { session, loading }
}
