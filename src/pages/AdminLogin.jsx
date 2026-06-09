import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('ระบบยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า VITE_SUPABASE_URL และ ANON_KEY ใน Vercel ก่อน')
      return
    }
    setBusy(true)
    setError(null)
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (e2) setError(e2.message)
    else navigate('/admin', { replace: true })
  }

  return (
    <div className="page-container" style={{ maxWidth: 420 }}>
      <div style={{ marginTop: 24 }}>
        <div className="text-caption">ครูผู้สอน</div>
        <div className="text-title">เข้าสู่ระบบ</div>
      </div>
      <form onSubmit={submit} className="card" style={{ marginTop: 12 }}>
        <label className="label">อีเมล</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" style={{ marginTop: 10 }}>รหัสผ่าน</label>
        <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div>
        )}
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
