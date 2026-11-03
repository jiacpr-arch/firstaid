import { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useLearnerStore } from '../stores/learnerStore'

// Loads the learner's purchased chapters whenever the Supabase auth session
// settles (login, logout, or initial load). Safe to call from any gated page —
// mirrors useEnsureProgress so deep-links get the right lock/unlock state.
export function useEnsureEntitlements() {
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const refresh = useEntitlementStore((s) => s.refresh)
  // ผู้เรียนในเครื่องเปลี่ยน (เข้าคลาส/ล็อกอินแล้ว rekey) ก็ต้องโหลดใหม่ — สิทธิ์จากคลาสผูกกับ learnerId
  const learnerId = useLearnerStore((s) => s.learner?.id)
  useEffect(() => {
    if (authLoading) return
    refresh(session)
  }, [session, authLoading, refresh, learnerId])
}
