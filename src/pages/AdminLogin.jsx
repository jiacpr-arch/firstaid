import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { OPEN_ADMIN } from '../config/adminAccess'
import Seo from '../components/Seo'

// ถ้าตั้ง VITE_ADMIN_EMAIL ไว้ → โหมด "รหัสเดียว": ผู้ใช้กรอกแค่รหัสผ่าน
// email จะถูก fix ไว้เบื้องหลัง (ใช้ล็อกอิน Supabase เพื่อให้ RLS/อัปโหลดทำงานได้)
// ถ้าไม่ตั้ง → ใช้ฟอร์ม email + password ตามเดิม
// ต้องเป็นอีเมลจริง (มี @) เท่านั้น — เคยมีเคสตั้งค่าเป็นชื่อเฉย ๆ ("jiacpr") แล้วล็อกอิน
// ไม่ได้เลยทั้งระบบเพราะ Supabase ปฏิเสธ email ที่ไม่ valid → ค่าเพี้ยนให้ถอยไปฟอร์มเต็ม
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').trim()
const PASSCODE_MODE = ADMIN_EMAIL.includes('@')

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [linkSentTo, setLinkSentTo] = useState(null)

  // โหมดไม่มีรหัส: ไม่ต้องโชว์หน้า login เลย เด้งกลับเข้า admin
  if (OPEN_ADMIN) return <Navigate to="/admin" replace />

  const submit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('ระบบยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า VITE_SUPABASE_URL และ ANON_KEY ใน Vercel ก่อน')
      return
    }
    setBusy(true)
    setError(null)
    const loginEmail = PASSCODE_MODE ? ADMIN_EMAIL : email
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    setBusy(false)
    if (e2) setError(PASSCODE_MODE ? 'รหัสผ่านไม่ถูกต้อง' : e2.message)
    else navigate('/admin', { replace: true })
  }

  // ทางสำรองเมื่อลืมรหัส/รหัสถูกเปลี่ยนจากแอป JIA อื่น (ใช้ Supabase project เดียวกัน):
  // ส่งลิงก์เข้าสู่ระบบไปที่อีเมล กดลิงก์แล้วเด้งกลับมา /admin พร้อม session
  // shouldCreateUser: false → ส่งได้เฉพาะบัญชีที่มีอยู่แล้ว ไม่สร้าง user ใหม่ให้ใครก็ได้
  const sendLink = async () => {
    if (!isSupabaseConfigured) {
      setError('ระบบยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า VITE_SUPABASE_URL และ ANON_KEY ใน Vercel ก่อน')
      return
    }
    const linkEmail = (PASSCODE_MODE ? ADMIN_EMAIL : email).trim()
    if (!linkEmail.includes('@')) {
      setError('กรอกอีเมลก่อน แล้วกดส่งลิงก์อีกครั้ง')
      return
    }
    setBusy(true)
    setError(null)
    setLinkSentTo(null)
    const { error: e2 } = await supabase.auth.signInWithOtp({
      email: linkEmail,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` },
    })
    setBusy(false)
    if (e2) setError(`ส่งลิงก์ไม่สำเร็จ: ${e2.message}`)
    else setLinkSentTo(linkEmail)
  }

  return (
    <div className="page-container" style={{ maxWidth: 420 }}>
      <Seo title="เข้าสู่ระบบครูผู้สอน | Jia Training Center" noindex path="/admin/login" />
      <div style={{ marginTop: 24 }}>
        <div className="text-caption">ครูผู้สอน</div>
        <div className="text-title">เข้าสู่ระบบ</div>
      </div>
      <form onSubmit={submit} className="card" style={{ marginTop: 12 }}>
        {!PASSCODE_MODE && (
          <>
            <label className="label">อีเมล</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </>
        )}
        <label className="label" style={{ marginTop: PASSCODE_MODE ? 0 : 10 }}>รหัสผ่าน</label>
        <input
          className="input"
          type="password"
          required
          autoFocus={PASSCODE_MODE}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={PASSCODE_MODE ? 'กรอกรหัสผ่าน admin' : ''}
        />
        {error && (
          <div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div>
        )}
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={sendLink}>
          ลืมรหัส? ส่งลิงก์เข้าสู่ระบบทางอีเมล
        </button>
        {linkSentTo && (
          <div className="callout callout-info" style={{ marginTop: 12 }}>
            ส่งลิงก์ไปที่ {linkSentTo} แล้ว — เปิดอีเมลแล้วกดลิงก์ในเครื่องนี้เพื่อเข้าสู่ระบบ
            (ถ้าไม่เจอ ลองดูในโฟลเดอร์ Spam)
          </div>
        )}
      </form>
    </div>
  )
}
