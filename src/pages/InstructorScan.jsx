import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { getInstructorCode, setInstructorCode } from '../utils/instructorFetch'
import AdminSessionScan from './AdminSessionScan'
import Seo from '../components/Seo'

// /scan/:id — ผู้ช่วยสอนใส่ "รหัสผู้สอน" ของ session เพื่อสแกน/เช็คชื่อ/ให้คะแนนโดยไม่ต้องมีบัญชีแอดมิน
// (แอดมินที่ล็อกอินอยู่แล้วเข้าได้เลย)
export default function InstructorScan() {
  const { id } = useParams()
  const [ready, setReady] = useState(() => !!getInstructorCode(id))
  const [checking, setChecking] = useState(() => !getInstructorCode(id) && isSupabaseConfigured)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ready || !isSupabaseConfigured) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data?.session) setReady(true)
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [ready])

  const submit = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/attendance/instructor-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', sessionId: id, code: code.trim() }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(resp.status === 410 ? 'รอบอบรมนี้ปิดแล้ว' : resp.status === 429 ? 'ลองบ่อยเกินไป รอสักครู่' : (body.error || 'ตรวจรหัสไม่สำเร็จ'))
        return
      }
      setInstructorCode(id, code.trim())
      setReady(true)
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (ready) return <AdminSessionScan />
  if (checking) return <div className="page-container text-caption">กำลังตรวจสอบ…</div>

  return (
    <div className="page-container">
      <Seo title="รหัสผู้สอน | Jia Training Center" noindex path="/scan" />
      <div className="text-title" style={{ marginTop: 8 }}>รหัสผู้สอน</div>
      <div className="text-caption">ขอรหัสผู้สอนจากครูผู้สอน เพื่อสแกนเช็คชื่อนักเรียนในรอบอบรมนี้</div>
      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">รหัสผู้สอน (8 ตัว)</label>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={12}
          autoCapitalize="characters"
          style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
        />
        {error && <div className="callout callout-danger" style={{ marginTop: 8 }}>{error}</div>}
        <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 12 }} disabled={!code.trim() || loading} onClick={submit}>
          <KeyRound size={16} /> {loading ? 'กำลังตรวจ…' : 'ยืนยัน'}
        </button>
      </div>
    </div>
  )
}
