import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { instructorFetch, getInstructorCode, clearInstructorCode } from '../utils/instructorFetch'
import { useClassStore } from '../stores/classStore'
import ChecklistGrader from '../components/checkin/ChecklistGrader'

const REGION_ID = 'admin-qr-scan-region'
const SAME_QR_COOLDOWN_MS = 3000

// ครูสแกน QR ประจำตัวนักเรียน (/my-qr) → เช็คชื่อ + อนุมัติทันที แล้วออกใบเซอร์ภาคปฏิบัติ
export default function AdminSessionScan() {
  const { id } = useParams()
  const inAdmin = useLocation().pathname.startsWith('/admin')
  const isMyClass = useClassStore((st) => st.sessionId === id)
  const [cameraError, setCameraError] = useState(null)
  const [last, setLast] = useState(null) // { ok, message, name }
  const [recent, setRecent] = useState([])
  const [stations, setStations] = useState([])
  const [stationId, setStationId] = useState('')
  const [grading, setGrading] = useState(null) // { station, student }
  const [saving, setSaving] = useState(false)
  const [groupSaved, setGroupSaved] = useState('')
  const stationRef = useRef({ id: '', list: [] })
  const busyRef = useRef(false)
  const lastScanRef = useRef({ text: '', at: 0 })

  useEffect(() => {
    instructorFetch(id, `/api/attendance/stations?sessionId=${id}`)
      .then((r) => r.json())
      .then((b) => {
        const list = b.stations || []
        setStations(list)
        if (list.length) setStationId(list[0].id)
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    stationRef.current = { id: stationId, list: stations }
  }, [stationId, stations])

  const saveResult = async (result) => {
    setSaving(true)
    try {
      const resp = await instructorFetch(id, '/api/attendance/station-checkin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'result', sessionId: id, stationId: grading.station.id, learnerId: grading.student.id, ...result,
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert(body.error || 'บันทึกผลไม่สำเร็จ'); return }
      // ใบเซอร์ภาคปฏิบัติ: เซิร์ฟเวอร์ออกให้เองเมื่อสอบผ่าน
      setLast({ ok: true, name: grading.student.name, message: result.passed ? 'บันทึกผล: ผ่าน' : 'บันทึกผล: ไม่ผ่าน' })
      setGrading(null)
      busyRef.current = false
    } finally { setSaving(false) }
  }

  // จัดกลุ่มฝึก A–D ทันทีหลังสแกน (api/attendance/group.js — รหัสผู้ช่วยของรอบนี้ใช้ได้)
  const assignGroup = async (learnerId, groupLabel) => {
    const resp = await instructorFetch(id, '/api/attendance/group', {
      method: 'POST', body: JSON.stringify({ sessionId: id, learnerId, groupLabel }),
    }).catch(() => null)
    const body = await resp?.json().catch(() => ({}))
    if (!resp?.ok) { alert(body?.error || 'ตั้งกลุ่มไม่สำเร็จ'); return }
    setGroupSaved(groupLabel)
  }

  const handleScan = useCallback(async (text) => {
    const now = Date.now()
    if (busyRef.current) return
    if (lastScanRef.current.text === text && now - lastScanRef.current.at < SAME_QR_COOLDOWN_MS) return
    lastScanRef.current = { text, at: now }
    busyRef.current = true
    let keepBusy = false
    try {
      const { id: stId, list } = stationRef.current
      const station = list.find((x) => x.id === stId)
      const resp = station
        ? await instructorFetch(id, '/api/attendance/station-checkin', {
          method: 'POST',
          body: JSON.stringify({ sessionId: id, stationId: station.id, payload: text }),
        })
        : await instructorFetch(id, '/api/attendance/instructor-checkin', {
          method: 'POST',
          body: JSON.stringify({ sessionId: id, payload: text }),
        })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        navigator.vibrate?.([200, 100, 200])
        if (resp.status === 403 && getInstructorCode(id)) {
          // รหัสถูกเปลี่ยน/ไม่ถูกต้องแล้ว — ล้างแล้วกลับไปหน้าใส่รหัส
          clearInstructorCode(id)
          window.location.reload()
          return
        }
        setLast({ ok: false, name: body.student?.name, message: body.error || 'เช็คชื่อไม่สำเร็จ' })
        return
      }
      navigator.vibrate?.(80)
      const name = body.student?.name || ''
      setGroupSaved('')
      setLast({ ok: true, name, learnerId: body.student?.id, message: body.duplicate ? 'เช็คชื่อไปแล้ว' : 'เช็คชื่อสำเร็จ' })
      if (!body.duplicate) setRecent((r) => [{ name, at: now }, ...r].slice(0, 8))
      if (station?.kind === 'exam' && body.passed == null) {
        // เปิดใบประเมิน และหยุดรับสแกนใหม่จนกว่าจะบันทึกผล
        setGrading({ station, student: body.student })
        keepBusy = true
        return
      }
    } catch {
      setLast({ ok: false, message: 'เครือข่ายขัดข้อง ลองสแกนใหม่' })
    } finally {
      if (!keepBusy) busyRef.current = false
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
      {inAdmin && (
        <Link to={isMyClass ? '/admin/teach' : `/admin/sessions/${id}`} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
          <ArrowLeft size={16} /> {isMyClass ? 'กลับหน้าผู้สอน' : 'กลับรายละเอียดคลาส'}
        </Link>
      )}
      <div className="text-title" style={{ marginTop: 4 }}>สแกน QR นักเรียน</div>
      <div className="text-caption">ให้นักเรียนเปิดหน้า “QR ของฉัน” (/my-qr) แล้วสแกนได้เลย</div>

      {stations.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label className="label">สแกนเข้าฐาน</label>
          <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)} disabled={!!grading}>
            <option value="">เช็คชื่อรวม (ไม่เลือกฐาน)</option>
            {stations.map((st) => (
              <option key={st.id} value={st.id}>{st.name}{st.kind === 'exam' ? ' (สอบ)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {grading && (
        <ChecklistGrader
          station={grading.station}
          student={grading.student}
          saving={saving}
          onSave={saveResult}
          onClose={() => { setGrading(null); busyRef.current = false }}
        />
      )}

      {cameraError && <div className="callout callout-danger" style={{ marginTop: 12 }}>{cameraError}</div>}
      <div id={REGION_ID} style={{ marginTop: 12, width: '100%', borderRadius: 12, overflow: 'hidden' }} />

      {last && (
        <div className={`callout ${last.ok ? 'callout-info' : 'callout-danger'}`} style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          {last.ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <div>
            {last.name && <div className="text-body-strong">{last.name}</div>}
            <div>{last.message}</div>
            {last.ok && last.learnerId && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <span className="text-caption">กลุ่ม:</span>
                {['A', 'B', 'C', 'D'].map((g) => (
                  <button key={g} type="button" className={`btn ${groupSaved === g ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => assignGroup(last.learnerId, g)}>
                    {g}
                  </button>
                ))}
              </div>
            )}
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
