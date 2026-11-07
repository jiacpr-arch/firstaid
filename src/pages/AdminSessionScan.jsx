import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { instructorFetch, getInstructorCode, clearInstructorCode } from '../utils/instructorFetch'
import { useClassStore } from '../stores/classStore'
import ChecklistGrader from '../components/checkin/ChecklistGrader'

const REGION_ID = 'admin-qr-scan-region'
const SAME_QR_COOLDOWN_MS = 3000
// โหมด "สแกนนักเรียนก่อน แล้วค่อยเลือกฐาน" — ใช้ค่าใน dropdown เดียวกับรายชื่อฐาน
const PICK_AFTER = '__pick__'
const modeKey = (sid) => `scan-station-mode:${sid}`
// ฐานที่ครูติ๊กไว้ครั้งล่าสุดในรอบนี้ (โหมดเลือกฐานหลังสแกน) — ครั้งแรก = ทุกฐาน
const pickedKey = (sid) => `scan-station-picked:${sid}`

// ปุ่มบันทึกในหน้าเลือกฐาน: ติ๊กฐานเดียว = ทำเหมือนเลือกฐานก่อนสแกน (ฐานสอบไปใบประเมินรายข้อ)
function singleLabel(chosen, count) {
  if (count !== 1 || chosen.length !== 1) return `บันทึกผ่าน ${count} ฐาน`
  return chosen[0].kind === 'exam' ? 'ประเมินฐานสอบ (ติ๊กรายข้อ)' : `บันทึกเข้า ${chosen[0].name}`
}

// เช็คชื่อเข้าฐาน — ใช้ทั้งตอนสแกนตรงเข้าฐาน (payload) และตอนเลือกฐานหลังสแกน (learnerId)
async function checkinStation(sessionId, station, who) {
  const resp = await instructorFetch(sessionId, '/api/attendance/station-checkin', {
    method: 'POST',
    body: JSON.stringify({ sessionId, stationId: station.id, ...who }),
  })
  const body = await resp.json().catch(() => ({}))
  return { resp, body }
}

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
  const [picking, setPicking] = useState(null) // student ที่สแกนแล้ว รอเลือกฐาน
  const [saving, setSaving] = useState(false)
  const [groupSaved, setGroupSaved] = useState('')
  const [picked, setPicked] = useState(() => new Set()) // ฐานที่ติ๊กในหน้าเลือกฐาน
  const [examFullPass, setExamFullPass] = useState(true) // ฐานสอบ: ผ่านครบทุกข้อเลย ไม่ต้องติ๊กรายข้อ
  const stationRef = useRef({ id: '', list: [] })
  const busyRef = useRef(false)
  const lastScanRef = useRef({ text: '', at: 0 })

  useEffect(() => {
    instructorFetch(id, `/api/attendance/stations?sessionId=${id}`)
      .then((r) => r.json())
      .then((b) => {
        const list = b.stations || []
        setStations(list)
        // ค่าเริ่มต้น = สแกนนักเรียนก่อน แล้วค่อยเลือกฐาน; ถ้าเคยเลือกโหมดอื่นในคลาสนี้ไว้ ใช้ค่านั้น
        let saved = null
        try { saved = localStorage.getItem(modeKey(id)) } catch { /* ignore */ }
        const valid = saved === '' || saved === PICK_AFTER || list.some((x) => x.id === saved)
        if (list.length) setStationId(valid ? saved : PICK_AFTER)
        let savedPicked = null
        try { savedPicked = JSON.parse(localStorage.getItem(pickedKey(id)) || 'null') } catch { /* ignore */ }
        const keep = Array.isArray(savedPicked) ? savedPicked.filter((x) => list.some((st) => st.id === x)) : []
        setPicked(new Set(keep.length ? keep : list.map((st) => st.id)))
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    stationRef.current = { id: stationId, list: stations }
  }, [stationId, stations])

  const changeStation = (value) => {
    setStationId(value)
    try { localStorage.setItem(modeKey(id), value) } catch { /* ignore */ }
  }

  // หลังได้ผลเช็คชื่อเข้าฐาน: แสดงผล และเปิดใบประเมินถ้าเป็นฐานสอบที่ยังไม่มีผล
  // คืนค่า true ถ้าต้องหยุดรับสแกนไว้ (กำลังประเมิน)
  const applyStationResult = useCallback((station, body) => {
    const at = Date.now()
    const name = body.student?.name || ''
    setGroupSaved('')
    setLast({
      ok: true, name, learnerId: body.student?.id,
      message: `${body.duplicate ? 'เช็คชื่อไปแล้ว' : 'เช็คชื่อสำเร็จ'} · ${station.name}`,
    })
    if (!body.duplicate) setRecent((r) => [{ name: `${name} → ${station.name}`, at }, ...r].slice(0, 8))
    if (station.kind === 'exam' && body.passed == null) {
      setGrading({ station, student: body.student })
      return true
    }
    return false
  }, [])

  const togglePicked = (stId) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(stId)) next.delete(stId); else next.add(stId)
    try { localStorage.setItem(pickedKey(id), JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  // ติ๊กไว้ฐานเดียว = ทำงานเหมือน "เลือกฐานก่อนสแกน": ฐานสอบเปิดใบประเมินรายข้อเสมอ
  const saveSingle = async (station) => {
    setSaving(true)
    try {
      const { resp, body } = await checkinStation(id, station, { learnerId: picking.id })
      if (!resp.ok) {
        navigator.vibrate?.([200, 100, 200])
        // ยังค้างหน้าเลือกฐานไว้ ให้ครูแก้ที่ติ๊กหรือยกเลิกได้
        setLast({ ok: false, name: picking.name, message: body.error || 'เช็คชื่อเข้าฐานไม่สำเร็จ' })
        return
      }
      navigator.vibrate?.(80)
      setPicking(null)
      if (!applyStationResult(station, body)) busyRef.current = false
    } catch {
      setLast({ ok: false, name: picking.name, message: 'เครือข่ายขัดข้อง ลองกดบันทึกใหม่' })
    } finally { setSaving(false) }
  }

  // สแกนครั้งเดียว → เช็คชื่อทุกฐานที่ติ๊กในคำขอเดียว (api/attendance/station-checkin.js action:'bulk')
  const saveBulk = async () => {
    if (!picking || saving) return
    const chosen = stations.filter((st) => picked.has(st.id))
    if (!chosen.length) return
    if (chosen.length === 1) { await saveSingle(chosen[0]); return }
    const exam = chosen.find((st) => st.kind === 'exam')
    const examPassed = !!exam && examFullPass
    setSaving(true)
    try {
      const resp = await instructorFetch(id, '/api/attendance/station-checkin', {
        method: 'POST',
        body: JSON.stringify({ action: 'bulk', sessionId: id, learnerId: picking.id, stationIds: chosen.map((st) => st.id), examPassed }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        navigator.vibrate?.([200, 100, 200])
        // ยังค้างหน้าเลือกฐานไว้ ให้ครูแก้ที่ติ๊กหรือยกเลิกได้
        setLast({ ok: false, name: picking.name, message: body.error || 'บันทึกฐานไม่สำเร็จ' })
        return
      }
      navigator.vibrate?.(80)
      const student = picking
      setPicking(null)
      setGroupSaved('')
      const msg = `บันทึก ${chosen.length} ฐาน${body.examPassed ? ' · สอบผ่าน' : ''}`
      setLast({ ok: true, name: student.name, learnerId: student.id, message: msg })
      setRecent((r) => [{ name: `${student.name} → ${msg}`, at: Date.now() }, ...r].slice(0, 8))
      if (exam && !examPassed) {
        // ให้คะแนนฐานสอบรายข้อต่อ — หยุดรับสแกนจนกว่าจะบันทึกผล
        setGrading({ station: exam, student })
        return
      }
      busyRef.current = false
    } catch {
      setLast({ ok: false, name: picking.name, message: 'เครือข่ายขัดข้อง ลองกดบันทึกใหม่' })
    } finally { setSaving(false) }
  }

  const cancelPick = () => { setPicking(null); busyRef.current = false }

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
      const pickAfter = stId === PICK_AFTER
      const station = pickAfter ? null : list.find((x) => x.id === stId)
      const { resp, body } = station
        ? await checkinStation(id, station, { payload: text })
        : await instructorFetch(id, '/api/attendance/instructor-checkin', {
          method: 'POST',
          body: JSON.stringify({ sessionId: id, payload: text }),
        }).then(async (r) => ({ resp: r, body: await r.json().catch(() => ({})) }))
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
      if (station) {
        // ฐานสอบที่ยังไม่มีผล → เปิดใบประเมิน และหยุดรับสแกนใหม่จนกว่าจะบันทึกผล
        keepBusy = applyStationResult(station, body)
        return
      }
      const name = body.student?.name || ''
      setGroupSaved('')
      setLast({ ok: true, name, learnerId: body.student?.id, message: body.duplicate ? 'เช็คชื่อไปแล้ว' : 'เช็คชื่อสำเร็จ' })
      if (!body.duplicate) setRecent((r) => [{ name, at: now }, ...r].slice(0, 8))
      if (pickAfter && body.student?.id) {
        // ได้ตัวนักเรียนแล้ว → ให้ครูเลือกฐาน และหยุดรับสแกนใหม่จนกว่าจะเลือก/ยกเลิก
        setPicking(body.student)
        keepBusy = true
        return
      }
    } catch {
      setLast({ ok: false, message: 'เครือข่ายขัดข้อง ลองสแกนใหม่' })
    } finally {
      if (!keepBusy) busyRef.current = false
    }
  }, [id, applyStationResult])

  useEffect(() => {
    let active = true
    let scanner = null
    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (!active) return
        // อ่านเฉพาะ QR และใช้ตัวถอดรหัสของเครื่อง (BarcodeDetector) ถ้ามี — เร็วกว่าตัวถอดรหัส JS หลายเท่า
        scanner = new Html5Qrcode(REGION_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        })
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            // กรอบสแกน 80% ของภาพ — ไม่ต้องเล็งให้ตรงกรอบเล็ก
            qrbox: (w, h) => { const size = Math.max(160, Math.floor(Math.min(w, h) * 0.8)); return { width: size, height: size } },
            disableFlip: true,
          },
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
          <select className="input" value={stationId} onChange={(e) => changeStation(e.target.value)} disabled={!!grading || !!picking}>
            <option value={PICK_AFTER}>สแกนนักเรียนก่อน แล้วเลือกฐาน (ได้หลายฐาน)</option>
            <option value="">เช็คชื่อรวม (ไม่เลือกฐาน)</option>
            {stations.map((st) => (
              <option key={st.id} value={st.id}>{st.name}{st.kind === 'exam' ? ' (สอบ)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {picking && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong">{picking.name} — เลือกฐานที่ผ่าน</div>
          <div className="text-caption">ติ๊กได้หลายฐาน ระบบจำที่ติ๊กไว้สำหรับคนถัดไป · ติ๊กฐานเดียว = ประเมินทีละฐาน (ฐานสอบไปใบประเมินรายข้อ)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
            {stations.map((st) => (
              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(st.id)} onChange={() => togglePicked(st.id)} disabled={saving}
                  style={{ width: 20, height: 20 }} />
                <span className="text-body">{st.name}{st.kind === 'exam' ? ' (สอบ)' : ''}</span>
              </label>
            ))}
          </div>
          {picked.size > 1 && stations.some((st) => st.kind === 'exam' && picked.has(st.id)) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginTop: 4, borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={examFullPass} onChange={(e) => setExamFullPass(e.target.checked)} disabled={saving}
                style={{ width: 20, height: 20 }} />
              <span className="text-body">สอบผ่านครบทุกข้อ<span className="text-caption" style={{ display: 'block' }}>เอาติ๊กออกถ้าจะให้คะแนนรายข้อ</span></span>
            </label>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-lg" disabled={saving || picked.size === 0} onClick={saveBulk}>
              {saving ? 'กำลังบันทึก…' : singleLabel(stations.filter((st) => picked.has(st.id)), picked.size)}
            </button>
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={cancelPick}>
              ไม่เข้าฐาน (เช็คชื่ออย่างเดียว)
            </button>
          </div>
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
