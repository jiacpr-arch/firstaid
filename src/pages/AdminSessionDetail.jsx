import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Check, X, RefreshCw } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

export default function AdminSessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [loading, setLoading] = useState(() => isSupabaseConfigured)

  const checkInUrl = useMemo(() => {
    const base = import.meta.env.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    return session?.qr_token ? `${base}/checkin/${session.qr_token}` : ''
  }, [session])

  useEffect(() => {
    if (!checkInUrl) return
    QRCode.toDataURL(checkInUrl, { width: 320, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [checkInUrl])

  const loadData = () => {
    if (!isSupabaseConfigured) return Promise.resolve({ session: null, attendance: [] })
    return Promise.all([
      supabase.from('practical_sessions').select('*').eq('id', id).single(),
      supabase.from('attendance').select('*').eq('session_id', id).order('checked_in_at'),
    ]).then(([{ data: s }, { data: a }]) => ({ session: s, attendance: a || [] }))
  }

  const load = () => {
    setLoading(true)
    return loadData().then(({ session: s, attendance: a }) => {
      setSession(s)
      setAttendance(a)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    loadData().then(({ session: s, attendance: a }) => {
      if (cancelled) return
      setSession(s)
      setAttendance(a)
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const approve = async (att) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('attendance').update({
      status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', att.id)
    if (error) { alert(error.message); return }
    // Trigger practical certificate issuance via API
    fetch('/api/certificates/issue-practical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId: att.id }),
    }).catch(() => {})
    load()
  }

  const reject = async (att) => {
    const { error } = await supabase.from('attendance').update({
      status: 'rejected', approved_at: new Date().toISOString(),
    }).eq('id', att.id)
    if (error) { alert(error.message); return }
    load()
  }

  const closeSession = async () => {
    if (!confirm('ปิด session นี้? — นักเรียนจะเช็คชื่อเข้ามาไม่ได้แล้ว')) return
    await supabase.from('practical_sessions').update({ closed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  return (
    <div className="page-container">
      <Link to="/admin/sessions" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> รายการคลาส
      </Link>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — หน้านี้จะใช้งานได้หลัง config เสร็จ
        </div>
      )}

      {session && (
        <>
          <div style={{ marginTop: 4 }}>
            <div className="text-caption">{session.location}</div>
            <div className="text-title">{session.title}</div>
          </div>

          <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
            <div className="text-body-strong">รหัส session</div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 6, color: 'var(--color-brand)' }}>
              {session.qr_token}
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 220, margin: '12px auto 0' }} />}
            <div className="text-caption" style={{ marginTop: 6 }}>
              ให้ผู้เรียนสแกน QR หรือกรอกรหัสด้านบนที่ <code>/checkin</code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={load}>
              <RefreshCw size={16} /> รีเฟรช
            </button>
            {!session.closed_at && (
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={closeSession}>
                ปิด session
              </button>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="text-body-strong" style={{ marginBottom: 8 }}>
          รายชื่อ check-in ({attendance.length})
        </div>
        {loading && <div className="card text-caption">กำลังโหลด…</div>}
        {!loading && attendance.length === 0 && (
          <div className="card text-caption">ยังไม่มีผู้เช็คชื่อ</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attendance.map((a) => (
            <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="text-body-strong">{a.learner_name || a.learner_id}</div>
                <div className="text-caption">{a.learner_phone || '—'} • {new Date(a.checked_in_at).toLocaleTimeString('th-TH')}</div>
              </div>
              {a.status === 'pending' && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => approve(a)}>
                    <Check size={16} /> อนุมัติ
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => reject(a)}>
                    <X size={16} />
                  </button>
                </>
              )}
              {a.status === 'approved' && <span className="badge badge-success">อนุมัติแล้ว</span>}
              {a.status === 'rejected' && <span className="badge badge-danger">ปฏิเสธ</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
