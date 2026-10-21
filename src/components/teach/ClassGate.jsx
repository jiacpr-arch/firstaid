import { useEffect, useState } from 'react'
import { Plus, X, Copy, Check, FolderOpen } from 'lucide-react'
import { adminFetch } from '../../utils/adminFetch'
import { useClassStore } from '../../stores/classStore'

// ฝั่งแอดมิน: สร้างคลาสใหม่ หรือเลือกคลาสเดิมมาทำงานต่อ — สร้างแล้วได้ 2 รหัส
// (รหัสคลาสให้นักเรียน / รหัสผู้ช่วยให้คนช่วยสแกนเช็คชื่อ) mode: 'create' | 'pick'
export default function ClassGate({ mode: initialMode = 'create', onClose }) {
  const setClass = useClassStore((s) => s.setClass)
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  // คลาสรวม CPR + ปฐมพยาบาล: สร้างโค้ดเรียน CPR ออนไลน์ (cpr.morroo.com) + เปิดทุกบทให้คนในคลาส
  const [includesCpr, setIncludesCpr] = useState(false)
  const [startsOn, setStartsOn] = useState('')
  const [seats, setSeats] = useState('24')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState('')
  const [classes, setClasses] = useState(null)

  useEffect(() => {
    if (mode !== 'pick') return undefined
    let cancelled = false
    adminFetch('/api/classes/list')
      .then((r) => r.json().then((b) => [r.ok, b]))
      .then(([ok, b]) => {
        if (cancelled) return
        if (!ok) { setError(b.error || 'โหลดรายการคลาสไม่สำเร็จ'); setClasses([]); return }
        setClasses((b.classes || []).filter((c) => !c.closed && c.sessionId))
      })
      .catch(() => { if (!cancelled) { setError('โหลดรายการคลาสไม่สำเร็จ'); setClasses([]) } })
    return () => { cancelled = true }
  }, [mode])

  const create = async () => {
    if (name.trim().length < 2) return
    setBusy(true)
    setError('')
    try {
      const resp = await adminFetch('/api/classes/create', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(), location: location.trim(),
          includesCpr, startsOn: includesCpr ? startsOn || null : null, seats: includesCpr ? Number(seats) || null : null,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(resp.status === 401 || resp.status === 403 ? 'ต้องล็อกอินแอดมินก่อน' : (data.error || 'สร้างคลาสไม่สำเร็จ'))
        return
      }
      // ยังไม่ setClass ตรงนี้: หน้าหลักจะสลับเป็นโหมดมีคลาสแล้วทำให้หน้ารหัสนี้หายก่อนจดรหัส
      setCreated(data)
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const pick = (c) => {
    setClass({ classId: c.id, sessionId: c.sessionId, className: c.name, classCode: c.code, instructorCode: c.instructorCode || '' })
    onClose()
  }

  // เก็บคลาสที่สร้างลงเครื่องตอนปิดหน้ารหัส (ปิดด้วย X ก็เก็บ — รหัสผู้ช่วยดูซ้ำได้ที่แท็บคลาส/QR)
  const finish = () => {
    if (created) setClass(created)
    onClose()
  }

  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
  const sheet = { background: 'var(--color-surface, #fff)', width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }

  return (
    <div style={overlay} role="dialog" aria-modal="true">
      <div style={sheet}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="text-title" style={{ flex: 1 }}>{created ? 'สร้างคลาสแล้ว' : mode === 'create' ? 'สร้างคลาสใหม่' : 'เลือกคลาส'}</div>
          <button type="button" className="btn btn-ghost" onClick={finish} aria-label="ปิด"><X size={18} /></button>
        </div>

        {created ? (
          <>
            <div className="text-caption" style={{ marginTop: 4 }}>{created.className}</div>
            <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
              <div className="text-caption">รหัสคลาส — แจกให้นักเรียน</div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 6, color: 'var(--color-brand)' }}>{created.classCode}</div>
              <button type="button" className="btn btn-ghost" onClick={() => copy('class', created.classCode)}>
                {copied === 'class' ? <Check size={14} /> : <Copy size={14} />} คัดลอก
              </button>
            </div>
            <div className="card" style={{ marginTop: 10, textAlign: 'center', borderColor: '#E3C27A', background: '#FBF3DF' }}>
              <div className="text-caption" style={{ color: '#7A5A1F' }}>รหัสผู้ช่วย — ให้เฉพาะคนที่ช่วยสแกนเช็คชื่อ</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 5, color: '#7A5A1F' }}>{created.instructorCode}</div>
              <button type="button" className="btn btn-ghost" onClick={() => copy('inst', created.instructorCode)}>
                {copied === 'inst' ? <Check size={14} /> : <Copy size={14} />} คัดลอก
              </button>
              <div className="text-caption" style={{ marginTop: 4, color: '#7A5A1F' }}>
                ผู้ช่วยใช้รหัสนี้สแกน/เช็คชื่อ/ให้คะแนนผ่านลิงก์ที่แท็บคลาส/QR (ไม่ต้องล็อกอิน) ห้ามแจกนักเรียน
              </div>
            </div>
            {created.cprPromoCode && (
              <div className="card" style={{ marginTop: 10, textAlign: 'center' }}>
                <div className="text-caption">โค้ดเรียน CPR ออนไลน์ (cpr.morroo.com)</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: '#B91C1C' }}>{created.cprPromoCode}</div>
                <div className="text-caption" style={{ marginTop: 4 }}>
                  นักเรียนเห็นปุ่มไปเรียน CPR พร้อมโค้ดนี้หลังเข้าคลาสด้วยรหัสคลาสอยู่แล้ว — ไม่ต้องแจกแยก
                </div>
              </div>
            )}
            <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} onClick={finish}>
              เข้าหน้าผู้สอน
            </button>
          </>
        ) : mode === 'create' ? (
          <>
            <label className="label" style={{ marginTop: 12 }}>ชื่อคลาส</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น รุ่นที่ 7 / ต.ค. 69" maxLength={80} autoFocus />
            <label className="label" style={{ marginTop: 10 }}>สถานที่ (ไม่บังคับ)</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="เช่น ห้องอบรม รพ.ตัวอย่าง" maxLength={120} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={includesCpr} onChange={(e) => setIncludesCpr(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <span className="text-body-strong">คลาสรวม CPR + ปฐมพยาบาล</span>
                <span className="text-caption" style={{ display: 'block' }}>
                  สร้างโค้ดเรียน CPR ออนไลน์ที่ cpr.morroo.com ให้อัตโนมัติ และเปิดทุกบทปฐมพยาบาลให้คนในคลาส
                </span>
              </span>
            </label>
            {includesCpr && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">วันเรียนจริง</label>
                  <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                </div>
                <div style={{ width: 110 }}>
                  <label className="label">จำนวนคน</label>
                  <input className="input" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
            )}
            {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}
            <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={busy || name.trim().length < 2} onClick={create}>
              <Plus size={16} /> {busy ? 'กำลังสร้าง…' : 'สร้างคลาส'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => { setMode('pick'); setError('') }}>
              <FolderOpen size={14} /> เลือกคลาสที่มีอยู่แล้ว
            </button>
          </>
        ) : (
          <>
            {error && <div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div>}
            {classes === null && <div className="text-caption" style={{ marginTop: 12 }}>กำลังโหลด…</div>}
            {classes && classes.length === 0 && !error && <div className="text-caption" style={{ marginTop: 12 }}>ยังไม่มีคลาสที่เปิดอยู่ — สร้างคลาสใหม่ได้เลย</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {(classes || []).map((c) => (
                <button key={c.id} type="button" className="card card-hover" style={{ textAlign: 'left' }} onClick={() => pick(c)}>
                  <div className="text-body-strong">{c.name}</div>
                  <div className="text-caption">รหัสคลาส {c.code} · นักเรียน {c.students} คน</div>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => { setMode('create'); setError('') }}>
              <Plus size={14} /> สร้างคลาสใหม่แทน
            </button>
          </>
        )}
      </div>
    </div>
  )
}
