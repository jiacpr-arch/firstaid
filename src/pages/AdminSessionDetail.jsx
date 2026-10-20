import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Check, X, RefreshCw, Download, ScanLine, Undo2, ListChecks, Layers } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { adminFetch } from '../utils/adminFetch'
import StationManager from '../components/checkin/StationManager'
import StationBoard from '../components/checkin/StationBoard'

function exportCsv(rows, filename) {
  const header = ['ชื่อ', 'เบอร์โทร', 'เวลาเช็คชื่อ', 'สถานะ']
  const lines = [
    header.join(','),
    ...rows.map((r) => [
      `"${(r.learner_name || '').replace(/"/g, '""')}"`,
      `"${(r.learner_phone || '').replace(/"/g, '""')}"`,
      `"${new Date(r.checked_in_at).toLocaleString('th-TH')}"`,
      r.status,
    ].join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminSessionDetail() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [kioskQrDataUrl, setKioskQrDataUrl] = useState(null)
  const [instructorCode, setInstructorCode] = useState(null)
  const [board, setBoard] = useState(null)
  const [showStations, setShowStations] = useState(false)
  const [roster, setRoster] = useState([])
  const [showRoster, setShowRoster] = useState(false)
  const [loading, setLoading] = useState(() => isSupabaseConfigured)

  const checkInUrl = useMemo(() => {
    const base = import.meta.env.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    return session?.qr_token ? `${base}/checkin/${session.qr_token}` : ''
  }, [session])

  useEffect(() => {
    if (!checkInUrl) return
    QRCode.toDataURL(checkInUrl, { width: 320, margin: 1 }).then(setQrDataUrl).catch(() => {})
    QRCode.toDataURL(`${checkInUrl}?kiosk=1`, { width: 320, margin: 1 }).then(setKioskQrDataUrl).catch(() => {})
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
    // Trigger practical certificate issuance via API (requireAdmin-protected)
    // คลาสที่มีสถานี: ใบเซอร์ออกเมื่อสอบผ่านเท่านั้น (ดู AdminSessionScan)
    if (!hasStations) {
      adminFetch('/api/certificates/issue-practical', {
        method: 'POST',
        body: JSON.stringify({ attendanceId: att.id }),
      }).catch(() => {})
    }
    load()
  }

  const loadBoard = useCallback(async () => {
    const resp = await adminFetch(`/api/attendance/board?sessionId=${id}`)
    const body = await resp.json().catch(() => ({}))
    if (resp.ok) setBoard(body)
  }, [id])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    adminFetch(`/api/attendance/board?sessionId=${id}`)
      .then((r) => r.json())
      .then((b) => { if (!cancelled && b.stations) setBoard(b) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  const hasStations = (board?.stations?.length || 0) > 0

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    adminFetch(`/api/attendance/instructor-code?sessionId=${id}`)
      .then((r) => r.json())
      .then((b) => { if (!cancelled && 'code' in b) setInstructorCode(b.code) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  const makeInstructorCode = async (action) => {
    if (action === 'rotate' && !confirm('เปลี่ยนรหัสผู้สอนใหม่? ผู้ช่วยที่ใช้รหัสเดิมอยู่จะถูกเด้งออก')) return
    const resp = await adminFetch('/api/attendance/instructor-code', {
      method: 'POST', body: JSON.stringify({ action, sessionId: id }),
    })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) { alert(body.error || 'สร้างรหัสไม่สำเร็จ'); return }
    setInstructorCode(body.code)
  }

  const assistantUrl = useMemo(() => {
    const base = import.meta.env.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    return `${base}/scan/${id}`
  }, [id])

  const undo = async (att) => {
    const { error } = await supabase.from('attendance').update({
      status: 'pending', approved_by: null, approved_at: null,
    }).eq('id', att.id)
    if (error) { alert(error.message); return }
    load()
  }

  const openRoster = async () => {
    setShowRoster((v) => !v)
    if (roster.length) return
    const resp = await adminFetch(`/api/attendance/roster?sessionId=${id}`)
    const body = await resp.json().catch(() => ({}))
    if (resp.ok) setRoster(body.roster || [])
    else alert(body.error || 'โหลดรายชื่อไม่สำเร็จ')
  }

  const manualCheckin = async (learnerId) => {
    const resp = await adminFetch('/api/attendance/instructor-checkin', {
      method: 'POST',
      body: JSON.stringify({ sessionId: id, learnerId }),
    })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) { alert(body.error || 'เช็คชื่อไม่สำเร็จ'); return }
    if (!hasStations && !body.duplicate && body.attendanceId) {
      adminFetch('/api/certificates/issue-practical', {
        method: 'POST',
        body: JSON.stringify({ attendanceId: body.attendanceId }),
      }).catch(() => {})
    }
    load()
    loadBoard()
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
            {kioskQrDataUrl && (
              <details style={{ marginTop: 12 }}>
                <summary className="text-caption" style={{ cursor: 'pointer' }}>QR โหมดคีออส (หลายคนใช้เครื่องเดียว เช่น แท็บเล็ตที่บูธ)</summary>
                <img src={kioskQrDataUrl} alt="QR คีออส" style={{ width: 180, margin: '8px auto 0', display: 'block' }} />
              </details>
            )}
          </div>

          {!session.closed_at && session.cohort_id && (
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={openRoster}>
              <ListChecks size={16} /> เช็คชื่อมือจากรายชื่อ cohort
            </button>
          )}
          {showRoster && (
            <div className="card" style={{ marginTop: 8 }}>
              {roster.length === 0 && <div className="text-caption">ไม่มีนักเรียนใน cohort นี้</div>}
              {roster.map((r) => {
                const done = attendance.some((a) => a.learner_id === r.learner_id && a.status === 'approved')
                return (
                  <div key={r.learner_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ flex: 1 }} className="text-body">{r.name || r.learner_id}</div>
                    {done
                      ? <span className="badge badge-success">เช็คแล้ว</span>
                      : <button type="button" className="btn btn-primary" onClick={() => manualCheckin(r.learner_id)}>เช็คชื่อ</button>}
                  </div>
                )
              })}
            </div>
          )}
          {!session.closed_at && (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="text-body-strong">รหัสผู้สอน (สำหรับผู้ช่วย)</div>
              {instructorCode ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: 'var(--color-brand)', textAlign: 'center', marginTop: 4 }}>
                    {instructorCode}
                  </div>
                  <div className="text-caption" style={{ marginTop: 4 }}>
                    ผู้ช่วยเปิดลิงก์ <code>{assistantUrl}</code> แล้วใส่รหัสนี้ — สแกน/เช็คชื่อ/ให้คะแนนได้ แต่จัดการฐานหรือดูรอบอื่นไม่ได้ รหัสใช้ได้จนกว่าจะปิดรอบ
                  </div>
                  <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => makeInstructorCode('rotate')}>
                    เปลี่ยนรหัสใหม่
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 6 }} onClick={() => makeInstructorCode('create')}>
                  สร้างรหัสผู้สอน
                </button>
              )}
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setShowStations((v) => !v)}>
            <Layers size={16} /> สถานีฝึก/สอบ {hasStations ? `(${board.stations.length} ฐาน)` : ''}
          </button>
          {showStations && (
            <StationManager sessionId={id} stations={board?.stations || []} onChanged={loadBoard} />
          )}
          {hasStations && <StationBoard board={board} filename={`stations-${session?.qr_token || 'export'}.csv`} />}
          {!session.closed_at && (
            <Link to={`/admin/sessions/${id}/scan`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
              <ScanLine size={16} /> สแกน QR นักเรียน
            </Link>
          )}

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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div className="text-body-strong" style={{ flex: 1 }}>
            รายชื่อ check-in ({attendance.length})
          </div>
          {attendance.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => exportCsv(attendance, `checkin-${session?.qr_token || 'export'}.csv`)}
            >
              <Download size={14} /> Export CSV
            </button>
          )}
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
              {a.status !== 'pending' && (
                <button type="button" className="btn btn-ghost" title="ยกเลิก (กลับเป็นรออนุมัติ)" onClick={() => undo(a)}>
                  <Undo2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
