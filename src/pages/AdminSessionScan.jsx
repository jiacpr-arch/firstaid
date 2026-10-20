import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { adminFetch } from '../utils/adminFetch'

const REGION_ID = 'admin-qr-scan-region'
const SAME_QR_COOLDOWN_MS = 3000

// ครูสแกน QR ประจำตัวนักเรียน (/my-qr) → เช็คชื่อ + อนุมัติทันที แล้วออกใบเซอร์ภาคปฏิบัติ
export default function AdminSessionScan() {
  const { id } = useParams()
  const [cameraError, setCameraError] = useState(null)
  const [last, setLast] = useState(null) // { ok, message, name }
  const [recent, setRecent] = useState([])
  const busyRef = useRef(false)
  const lastScanRef = useRef({ text: '', at: 0 })

  const handleScan = useCallback(async (text) => {
    const now = Date.now()
    if (busyRef.current) return
    if (lastScanRef.current.text === text && now - lastScanRef.current.at < SAME_QR_COOLDOWN_MS) return
    lastScanRef.current = { text, at: now }
    busyRef.current = true
    try {
      const resp = await adminFetch('/api/attendance/instructor-checkin', {
        method: 'POST',
        body: JSON.stringify({ sessionId: id, payload: text }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        navigator.vibrate?.([200, 100, 200])
        setLast({ ok: false, message: body.error || 'เช็คชื่อไม่สำเร็จ' })
        return
      }
      navigator.vibrate?.(80)
      const name = body.student?.name || ''
      setLast({ ok: true, name, message: body.duplicate ? 'เช็คชื่อไปแล้ว' : 'เช็คชื่อสำเร็จ' })
      if (!body.duplicate) {
        setRecent((r) => [{ name, at: now }, ...r].slice(0, 8))
        adminFetch('/api/certificates/issue-practical', {
          method: 'POST',
          body: JSON.stringify({ attendanceId: body.attendanceId }),
        }).catch(() => {})
      }
    } catch {
      setLast({ ok: false, message: 'เครือข่ายขัดข้อง ลองสแกนใหม่' })
    } finally {
      busyRef.current = false
    }
  }, [id])

  useEffect(() => {
    let active = true
    let scanner = null
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!active) return
        scanner = new Html5Qrcode(REGION_ID)
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => handleScan(text),
          () => {},
        )
        if (!active) await scanner.stop().catch(() => {})
      } catch (e) {
        if (active) setCameraError(e?.message || 'เปิดกล้องไม่ได้ (ต้องใช้ HTTPS และอนุญาตกล้อง)')
      }
    })()
    return () => {
      active = false
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [handleScan])

  return (
    <div className="page-container">
      <Link to={`/admin/sessions/${id}`} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> กลับรายละเอียดคลาส
      </Link>
      <div className="text-title" style={{ marginTop: 4 }}>สแกน QR นักเรียน</div>
      <div className="text-caption">ให้นักเรียนเปิดหน้า “QR ของฉัน” (/my-qr) แล้วสแกนได้เลย</div>

      {cameraError && <div className="callout callout-danger" style={{ marginTop: 12 }}>{cameraError}</div>}
      <div id={REGION_ID} style={{ marginTop: 12, width: '100%', borderRadius: 12, overflow: 'hidden' }} />

      {last && (
        <div className={`callout ${last.ok ? 'callout-success' : 'callout-danger'}`} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          {last.ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <div>
            {last.name && <div className="text-body-strong">{last.name}</div>}
            <div>{last.message}</div>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong">สแกนล่าสุด</div>
          {recent.map((r) => (
            <div key={r.at} className="text-caption" style={{ marginTop: 4 }}>
              {new Date(r.at).toLocaleTimeString('th-TH')} · {r.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
