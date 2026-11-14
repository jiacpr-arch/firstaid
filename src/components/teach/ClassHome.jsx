import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Copy, Check, Eye, EyeOff, RefreshCw, ScanLine, Maximize2, X } from 'lucide-react'
import { useClassStore } from '../../stores/classStore'
import { adminFetch } from '../../utils/adminFetch'

// แท็บ "คลาส/QR": รหัสคลาส + QR เข้าร่วม, รหัสผู้สอน (ซ่อน/แสดง/เปลี่ยน), ปุ่มสแกน, สลับ/ปิดคลาส
export default function ClassHome({ onNewClass, onPick }) {
  const cls = useClassStore()
  const [qr, setQr] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [savedName, setSavedName] = useState(null) // null = loading
  const [nameNote, setNameNote] = useState('')
  // จำนวนผู้เรียนสูงสุด — ครบแล้วนักเรียนใหม่เข้าคลาสไม่ได้ (api/cohorts/join.js)
  const [cap, setCap] = useState(null) // null = loading | { maxStudents, students, jiaCertified }
  const [capInput, setCapInput] = useState('')
  const [capNote, setCapNote] = useState('')

  const base = import.meta.env.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  // openExternalBrowser=1 — สแกนใน LINE แล้วให้เด้งออก browser จริง (in-app browser แชร์ storage ไม่ได้)
  const joinUrl = useMemo(() => (cls.classCode ? `${base}/join/${cls.classCode}?openExternalBrowser=1` : ''), [base, cls.classCode])
  const myQrUrl = `${base}/my-qr`
  const assistantUrl = cls.sessionId ? `${base}/scan/${cls.sessionId}` : ''
  // ผู้สอนภายนอก (ไม่มีบัญชีแอดมิน) ดูผลทั้งคลาสที่หน้า /class ด้วยรหัสเดียวกันนี้
  const instructorUrl = cls.instructorCode ? `${base}/class?code=${cls.instructorCode}` : ''

  useEffect(() => {
    if (!joinUrl) return
    QRCode.toDataURL(joinUrl, { width: 560, margin: 1 }).then(setQr).catch(() => {})
  }, [joinUrl])

  useEffect(() => {
    if (!cls.sessionId) return
    let cancelled = false
    adminFetch(`/api/classes/instructor-name?sessionId=${cls.sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!cancelled && b) { setInstructorName(b.instructorName); setSavedName(b.instructorName) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [cls.sessionId])

  useEffect(() => {
    if (!cls.classId) return
    let cancelled = false
    adminFetch(`/api/classes/capacity?classId=${cls.classId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!cancelled && b) { setCap(b); setCapInput(b.maxStudents ? String(b.maxStudents) : '') } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [cls.classId])

  // ใบภาคปฏิบัติชื่อ JIA (cohorts.jia_certified) — สลับได้ทีหลัง; เปิดแล้วกด "ส่งใหม่" ในแท็บใบประกาศเพื่อออกย้อนหลัง
  const toggleJiaCert = async () => {
    if (!cap) return
    const next = !cap.jiaCertified
    if (!confirm(next
      ? 'เปิดใบภาคปฏิบัติชื่อ JIA ให้คลาสนี้? ใช้กับคลาสที่ JIA สอนเองหรือผู้สอนที่ JIA รับรองแล้วเท่านั้น'
      : 'ปิดใบภาคปฏิบัติชื่อ JIA ของคลาสนี้? นักเรียนยังได้ใบภาคทฤษฎีตามปกติ ใบที่ออกไปแล้วไม่ถูกยกเลิก')) return
    setBusy(true)
    setCapNote('')
    try {
      const resp = await adminFetch('/api/classes/capacity', { method: 'POST', body: JSON.stringify({ classId: cls.classId, jiaCertified: next }) })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setCapNote(body.error || 'บันทึกไม่สำเร็จ'); return }
      setCap(body)
    } catch {
      setCapNote('บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const saveCapacity = async () => {
    setBusy(true)
    setCapNote('')
    try {
      const resp = await adminFetch('/api/classes/capacity', {
        method: 'POST', body: JSON.stringify({ classId: cls.classId, maxStudents: capInput ? Number(capInput) : null }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setCapNote(body.error || 'บันทึกไม่สำเร็จ'); return }
      setCap(body)
      setCapInput(body.maxStudents ? String(body.maxStudents) : '')
      setCapNote('บันทึกแล้ว')
    } catch {
      setCapNote('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const saveInstructorName = async () => {
    setBusy(true)
    setNameNote('')
    try {
      const resp = await adminFetch('/api/classes/instructor-name', {
        method: 'POST', body: JSON.stringify({ sessionId: cls.sessionId, instructorName: instructorName.trim() }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setNameNote(body.error || 'บันทึกไม่สำเร็จ'); return }
      setInstructorName(body.instructorName)
      setSavedName(body.instructorName)
      setNameNote('บันทึกแล้ว')
    } catch {
      setNameNote('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  const rotate = async () => {
    if (!cls.sessionId) return
    if (!confirm('เปลี่ยนรหัสผู้ช่วยใหม่? ผู้ช่วยที่ใช้รหัสเดิมอยู่จะถูกเด้งออก')) return
    setBusy(true)
    setError('')
    try {
      const resp = await adminFetch('/api/attendance/instructor-code', {
        method: 'POST', body: JSON.stringify({ action: 'rotate', sessionId: cls.sessionId }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setError(body.error || 'เปลี่ยนรหัสไม่สำเร็จ'); return }
      cls.setInstructorCode(body.code)
      setShowCode(true)
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const closeClass = async () => {
    if (!confirm(`ปิดคลาส “${cls.className}”? รหัสผู้ช่วยจะใช้ไม่ได้อีก (ข้อมูลนักเรียนไม่ถูกลบ)\n\nอย่าลืมออก “รายงานประจำรุ่น” ก่อนปิด (การ์ดเหนือแท็บ)`)) return
    setBusy(true)
    setError('')
    try {
      const resp = await adminFetch('/api/classes/close', {
        method: 'POST', body: JSON.stringify({ cohortId: cls.classId }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setError(body.error || 'ปิดคลาสไม่สำเร็จ'); return }
      cls.clearClass()
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const masked = cls.instructorCode ? cls.instructorCode.replace(/./g, '•') : ''

  return (
    <>
      <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
        <div className="text-body-strong">รหัสเข้าร่วมคลาส</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 6, color: 'var(--color-brand)' }}>{cls.classCode}</div>
        {qr && <img src={qr} alt="QR เข้าร่วมคลาส" style={{ width: 200, margin: '10px auto 0', display: 'block' }} />}
        <div className="text-caption" style={{ marginTop: 6 }}>
          ให้นักเรียนสแกน QR จาก<b>มือถือของตัวเอง</b> หรือเปิด <code>/join</code> แล้วกรอกรหัส
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('code', cls.classCode)}>
            {copied === 'code' ? <Check size={14} /> : <Copy size={14} />} คัดลอกรหัส
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('link', joinUrl)}>
            {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setFullscreen(true)}>
            <Maximize2 size={14} /> QR เต็มจอ
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="text-body-strong">วันอบรมภาคปฏิบัติ</div>
        <div className="text-caption" style={{ marginTop: 2 }}>
          ให้นักเรียนเปิด <code>{myQrUrl}</code> เพื่อแสดง QR ประจำตัว แล้วสแกนเช็คชื่อ
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {cls.sessionId && (
            <Link to={`/admin/sessions/${cls.sessionId}/scan`} className="btn btn-primary" style={{ flex: 1 }}>
              <ScanLine size={16} /> สแกน QR นักเรียน
            </Link>
          )}
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('myqr', myQrUrl)}>
            {copied === 'myqr' ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์ QR ของฉัน
          </button>
        </div>
      </div>

      {cls.classId && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="text-body-strong">
            จำนวนผู้เรียนสูงสุด
            {cap && <span className="text-caption" style={{ marginLeft: 6 }}>
              (เข้าแล้ว {cap.students}{cap.maxStudents ? `/${cap.maxStudents}` : ''} คน{cap.maxStudents && cap.students >= cap.maxStudents ? ' · เต็มแล้ว' : ''})
            </span>}
          </div>
          <div className="text-caption" style={{ marginTop: 2 }}>
            ครบจำนวนแล้วนักเรียนใหม่เข้าคลาสไม่ได้ (คนที่เข้าแล้วยังเข้าได้) · ว่าง = ไม่จำกัด · มีคนมาเพิ่มหน้างานให้เพิ่มตัวเลขตรงนี้
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input className="input" style={{ flex: 1 }} inputMode="numeric" value={capInput} disabled={cap === null}
              placeholder="ไม่จำกัด" onChange={(e) => { setCapInput(e.target.value.replace(/\D/g, '').slice(0, 3)); setCapNote('') }} />
            <button type="button" className="btn btn-primary"
              disabled={busy || cap === null || capInput === (cap.maxStudents ? String(cap.maxStudents) : '')}
              onClick={saveCapacity}>บันทึก</button>
          </div>
          {capNote && <div className="text-caption" style={{ marginTop: 6 }}>{capNote}</div>}
          {cap && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-body-strong">ใบภาคปฏิบัติชื่อ JIA: <span data-testid="class-jia-cert-status" style={{ color: cap.jiaCertified ? '#347053' : '#B91C1C' }}>{cap.jiaCertified ? 'ออกได้' : 'ไม่ออก'}</span></div>
                <div className="text-caption">เฉพาะคลาสที่ JIA สอนเองหรือผู้สอนที่ JIA รับรอง · คลาสอื่นนักเรียนได้ใบภาคทฤษฎีตามปกติ</div>
              </div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} disabled={busy} onClick={toggleJiaCert} data-testid="class-jia-cert-toggle">
                {cap.jiaCertified ? 'ปิดใบ JIA' : 'เปิดใบ JIA'}
              </button>
            </div>
          )}
        </div>
      )}

      {cls.sessionId && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="text-body-strong">ชื่อผู้สอนบนใบประกาศภาคปฏิบัติ</div>
          <div className="text-caption" style={{ marginTop: 2 }}>
            พิมพ์บนใบที่ระบบกลาง JIA ออกให้นักเรียนที่สอบผ่าน · ว่าง = Jia Training Center · ใบที่ออกไปแล้วไม่เปลี่ยนตาม
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input className="input" style={{ flex: 1 }} value={instructorName} maxLength={100}
              disabled={savedName === null} placeholder="เช่น นพ.สมชาย ใจดี"
              onChange={(e) => { setInstructorName(e.target.value); setNameNote('') }} />
            <button type="button" className="btn btn-primary" disabled={busy || savedName === null || instructorName.trim() === savedName}
              onClick={saveInstructorName}>บันทึก</button>
          </div>
          {nameNote && <div className="text-caption" style={{ marginTop: 6 }}>{nameNote}</div>}
        </div>
      )}

      <div className="card" style={{ marginTop: 10, borderColor: '#E3C27A', background: '#FBF3DF' }}>
        <div className="text-body-strong" style={{ color: '#7A5A1F' }}>รหัสผู้สอน — ให้เฉพาะผู้สอนและผู้ช่วยสอน</div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: '#7A5A1F', marginTop: 4 }}>
          {showCode ? cls.instructorCode : masked}
        </div>
        <div className="text-caption" style={{ color: '#7A5A1F', marginTop: 2 }}>
          ใช้รหัสนี้ได้โดยไม่ต้องล็อกอิน: ดูความพร้อมของนักเรียนทั้งคลาส (เห็นเบอร์แค่ 4 ตัวท้าย) และสแกน/เช็คชื่อ/ให้คะแนนวันอบรม ห้ามแจกนักเรียน
        </div>
        {instructorUrl && (
          <div className="text-caption" style={{ color: '#7A5A1F', marginTop: 6, wordBreak: 'break-all' }}>
            ลิงก์ผู้สอน (ดูผลคลาส): <code>{instructorUrl}</code>
          </div>
        )}
        {assistantUrl && (
          <div className="text-caption" style={{ color: '#7A5A1F', marginTop: 6, wordBreak: 'break-all' }}>
            ลิงก์ผู้ช่วย (สแกนวันอบรม): <code>{assistantUrl}</code>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowCode((v) => !v)}>
            {showCode ? <EyeOff size={14} /> : <Eye size={14} />} {showCode ? 'ซ่อน' : 'แสดง'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('inst', cls.instructorCode)}>
            {copied === 'inst' ? <Check size={14} /> : <Copy size={14} />} คัดลอกรหัส
          </button>
          {instructorUrl && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('teach', instructorUrl)} data-testid="copy-instructor-link">
              {copied === 'teach' ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์ผู้สอน
            </button>
          )}
          {assistantUrl && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => copy('asst', assistantUrl)}>
              {copied === 'asst' ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์ผู้ช่วย
            </button>
          )}
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} disabled={busy} onClick={rotate}>
            <RefreshCw size={14} /> เปลี่ยนรหัส
          </button>
        </div>
      </div>

      {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={onNewClass}>สร้างคลาสใหม่</button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={onPick}>เลือกคลาสอื่น</button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: '#B42318' }} disabled={busy} onClick={closeClass}>ปิดคลาสนี้</button>
      </div>

      {fullscreen && qr && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button type="button" className="btn btn-ghost" style={{ position: 'absolute', top: 12, right: 12 }} onClick={() => setFullscreen(false)} aria-label="ปิด"><X size={22} /></button>
          <div style={{ fontSize: 14, color: '#555' }}>{cls.className}</div>
          <img src={qr} alt="QR เข้าร่วมคลาส" style={{ width: 'min(86vw, 420px)' }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8, color: '#111' }}>{cls.classCode}</div>
        </div>
      )}
    </>
  )
}
