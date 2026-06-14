import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

// โหมด "ไม่มีรหัส": ตั้ง env VITE_ADMIN_OPEN=true → เข้าหน้า admin ได้เลยไม่ต้องล็อกอิน
// (ใช้ชั่วคราวตอนเริ่มต้น — ต้องเปิด RLS ให้ anon เขียนด้วย ดู supabase/open-admin-writes.sql)
const OPEN_ADMIN = (import.meta.env.VITE_ADMIN_OPEN || '').trim().toLowerCase() === 'true'

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
