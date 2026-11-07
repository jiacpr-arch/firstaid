import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, ListChecks } from 'lucide-react'
import { adminFetch } from '../../utils/adminFetch'
import StationManager from '../checkin/StationManager'
import StationBoard from '../checkin/StationBoard'
import SessionReportCard from '../checkin/SessionReportCard'

// แท็บ "ปฏิบัติ": วันอบรมภาคปฏิบัติของคลาส — สถานี, สแกน QR นักเรียน, เช็คชื่อมือ, กระดาน, รายงาน LINE
export default function ClassPractice({ sessionId, classCode }) {
  const [board, setBoard] = useState(null)
  const [roster, setRoster] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmAll, setConfirmAll] = useState(null) // learnerId ที่กด "ผ่านทุกฐาน" รอยืนยัน
  const fetcher = adminFetch

  const load = useCallback(async () => {
    const [b, r] = await Promise.all([
      fetcher(`/api/attendance/board?sessionId=${sessionId}`),
      fetcher(`/api/attendance/roster?sessionId=${sessionId}`),
    ])
    const bb = await b.json().catch(() => ({}))
    const rb = await r.json().catch(() => ({}))
    if (!b.ok) { setError(bb.error || 'โหลดข้อมูลภาคปฏิบัติไม่สำเร็จ'); return }
    setError('')
    setBoard(bb)
    setRoster(rb.roster || [])
  }, [fetcher, sessionId])

  useEffect(() => {
    if (!sessionId) return undefined
    let cancelled = false
    Promise.all([
      fetcher(`/api/attendance/board?sessionId=${sessionId}`).then((r) => r.json().then((j) => [r.ok, j])),
      fetcher(`/api/attendance/roster?sessionId=${sessionId}`).then((r) => r.json().then((j) => [r.ok, j])),
    ]).then(([[bok, bj], [, rj]]) => {
      if (cancelled) return
      if (!bok) { setError(bj.error || 'โหลดข้อมูลภาคปฏิบัติไม่สำเร็จ'); return }
      setError('')
      setBoard(bj)
      setRoster(rj.roster || [])
    }).catch(() => { if (!cancelled) setError('โหลดข้อมูลภาคปฏิบัติไม่สำเร็จ — ตรวจการเชื่อมต่อ') })
    return () => { cancelled = true }
  }, [fetcher, sessionId])

  const checkIn = async (learnerId) => {
    setBusyId(learnerId)
    try {
      const resp = await fetcher('/api/attendance/instructor-checkin', {
        method: 'POST', body: JSON.stringify({ sessionId, learnerId }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert(body.error || 'เช็คชื่อไม่สำเร็จ'); return }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  // ไม่ต้องสแกน: ให้ผ่านทุกฐาน (ฝึกครบ + สอบผ่านครบทุกข้อ) จากรายชื่อคลาส — ยืนยันด้วยปุ่มในหน้า
  const passAll = async (learnerId) => {
    const stations = board?.stations || []
    if (!stations.length) return
    setBusyId(learnerId)
    try {
      const resp = await fetcher('/api/attendance/station-checkin', {
        method: 'POST',
        body: JSON.stringify({ action: 'bulk', sessionId, learnerId, stationIds: stations.map((st) => st.id), examPassed: true }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setError(body.error || 'บันทึกผ่านทุกฐานไม่สำเร็จ'); return }
      setConfirmAll(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!sessionId) return <div className="callout callout-danger" style={{ marginTop: 12 }}>คลาสนี้ยังไม่มีรอบอบรม</div>

  const here = new Set((board?.rows || []).map((r) => r.learnerId))
  const stationCount = board?.stations?.length || 0
  // ผ่านครบทุกฐานแล้ว = เช็คชื่อทุกฐาน และฐานสอบทุกฐานผ่าน
  const allDone = new Set((board?.rows || []).filter((r) => stationCount > 0 && board.stations.every((st) => {
    const c = r.checkins?.[st.id]
    return c && (st.kind !== 'exam' || c.passed === true)
  })).map((r) => r.learnerId))

  return (
    <>
      {error && <div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div>}

      <Link to={`/admin/sessions/${sessionId}/scan`} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 12 }}>
        <ScanLine size={18} /> สแกน QR นักเรียน
      </Link>
      <div className="text-caption" style={{ marginTop: 4 }}>
        ให้นักเรียนเปิด <code>/my-qr</code> (ลิงก์อยู่ในแท็บคลาส/QR) แล้วสแกน — เลือกฐานในหน้าสแกนได้
      </div>

      <div className="text-body-strong" style={{ marginTop: 16 }}>สถานีฝึก/สอบ</div>
      <StationManager sessionId={sessionId} stations={board?.stations || []} onChanged={load} fetcher={fetcher} />
      {board && board.stations.length > 0 && <StationBoard board={board} filename={`stations-${classCode || 'export'}.csv`} />}

      <div className="text-body-strong" style={{ marginTop: 16 }}>
        <ListChecks size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />เช็คชื่อ / ให้ผ่านทุกฐานจากรายชื่อคลาส
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        {roster.length === 0 && <div className="text-caption">ยังไม่มีนักเรียนเข้าร่วมคลาส</div>}
        {roster.map((r) => (
          <div key={r.learner_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
            <div className="text-body" style={{ flex: 1, minWidth: 120 }}>{r.name || r.learner_id}</div>
            {allDone.has(r.learner_id) && <span className="badge badge-success">ผ่านครบทุกฐาน</span>}
            {!allDone.has(r.learner_id) && (here.has(r.learner_id)
              ? <span className="badge badge-success">เช็คชื่อแล้ว</span>
              : <button type="button" className="btn btn-secondary" disabled={busyId === r.learner_id} onClick={() => checkIn(r.learner_id)}>เช็คชื่อ</button>)}
            {!allDone.has(r.learner_id) && stationCount > 0 && (confirmAll === r.learner_id
              ? (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-primary" disabled={busyId === r.learner_id} onClick={() => passAll(r.learner_id)}>
                    {busyId === r.learner_id ? 'กำลังบันทึก…' : `ยืนยันผ่าน ${stationCount} ฐาน`}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busyId === r.learner_id} onClick={() => setConfirmAll(null)}>ยกเลิก</button>
                </span>
              )
              : <button type="button" className="btn btn-primary" disabled={busyId === r.learner_id} onClick={() => setConfirmAll(r.learner_id)}>ผ่านทุกฐาน</button>)}
          </div>
        ))}
      </div>

      <SessionReportCard sessionId={sessionId} fetcher={fetcher} />
    </>
  )
}
