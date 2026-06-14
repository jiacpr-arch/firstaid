import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { OPEN_ADMIN } from '../config/adminAccess'

export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState(() => {
    if (OPEN_ADMIN) return 'in'
    return isSupabaseConfigured ? 'checking' : 'out'
  })

  useEffect(() => {
    if (OPEN_ADMIN || !isSupabaseConfigured) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setStatus(data?.session ? 'in' : 'out')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setStatus(session ? 'in' : 'out')
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  if (status === 'checking') {
    return (
      <div className="page-container py-12 text-center text-caption">
        กำลังตรวจสอบสิทธิ์…
      </div>
    )
  }
  if (status === 'out') return <Navigate to="/admin/login" replace />
  return children
}
