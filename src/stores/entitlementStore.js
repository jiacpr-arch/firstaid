import { create } from 'zustand'

// Which chapters (0 = whole-course bundle, 1-4 = single chapter) the logged-in
// learner has purchased. Unlike progressStore this is never read from local
// Dexie — entitlements only exist server-side against the durable learner_id,
// so an anonymous (not-logged-in) learner always resolves to an empty set here.
export const useEntitlementStore = create((set) => ({
  chapters: new Set(),
  loaded: false,
  loading: false,
  refresh: async (session) => {
    const token = session?.access_token
    if (!token) {
      set({ chapters: new Set(), loaded: true, loading: false })
      return
    }
    set({ loading: true })
    try {
      const res = await fetch('/api/entitlements', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { set({ loaded: true, loading: false }); return }
      const data = await res.json()
      set({ chapters: new Set(data.chapters || []), loaded: true, loading: false })
    } catch {
      // Offline/network error — leave as locked rather than hang; a later
      // refresh (reconnect, revisit) retries.
      set({ loaded: true, loading: false })
    }
  },
}))
