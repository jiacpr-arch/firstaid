import { useState } from 'react'
import { KeyRound, Plus, X, Copy, Check } from 'lucide-react'
import { useClassStore } from '../../stores/classStore'

// สร้างคลาสใหม่ หรือเชื่อมคลาสเดิมด้วยรหัสผู้สอน (แบบ ACLS ClassGateModal) — ไม่ต้องมีบัญชี
// mode: 'create' | 'connect' เมื่อสร้างสำเร็จจะโชว์ 2 รหัสก่อนปิด (รหัสผู้สอนเป็นความลับ)
export default function ClassGate({ mode: initialMode = 'create', onClose }) {
  const setClass = useClassStore((s) => s.setClass)
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState('')

  const post = async (url, body) => {
    const resp = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data }
  }

  const create = async () => {
    if (name.trim().length < 2) return
    setBusy(true)
    setError('')
    try {
      const { ok, status, data } = await post('/api/classes/create', { name: name.trim(), location: location.trim() })
      if (!ok) {
        setError(status === 429 ? 'สร้างคลาสบ่อยเกินไป ลองใหม่ภายหลัง' : (data.error || 'สร้างคลาสไม่สำเร็จ'))
        return
      }
      // ยังไม่ setClass ตรงนี้: หน้า /teach จะสลับเป็นโหมดมีคลาสแล้วทำให้หน้ารหัสนี้หายก่อนครูจดรหัส
      setCreated(data)
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const connect = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const { ok, status, data } = await post('/api/classes/verify', { instructorCode: code.trim() })
      if (!ok) {
        setError(status === 429 ? 'ลองบ่อยเกินไป รอสักครู่' : (data.error || 'เชื่อมคลาสไม่สำเร็จ'))
        return
      }
      setClass({ ...data, instructorCode: code.trim().toUpperCase().replace(/[\s-]/g, '') })
      onClose()
    } catch {
      setError('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  // เก็บคลาสที่สร้างลงเครื่องตอนปิดหน้ารหัส (ปิดด้วย X ก็เก็บ — รหัสผู้สอนดูซ้ำได้ที่แท็บคลาส/QR)
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
          <div className="text-title" style={{ flex: 1 }}>{created ? 'สร้างคลาสแล้ว' : mode === 'create' ? 'สร้างคลาสใหม่' : 'เชื่อมคลาสด้วยรหัสผู้สอน'}</div>
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
              <div className="text-caption" style={{ color: '#7A5A1F' }}>รหัสผู้สอน — เก็บเป็นความลับ</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 5, color: '#7A5A1F' }}>{created.instructorCode}</div>
              <button type="button" className="btn btn-ghost" onClick={() => copy('inst', created.instructorCode)}>
                {copied === 'inst' ? <Check size={14} /> : <Copy size={14} />} คัดลอก
              </button>
              <div className="text-caption" style={{ marginTop: 4, color: '#7A5A1F' }}>
                ใช้เปิดหน้าผู้สอนบนเครื่องอื่น และเห็นผลของนักเรียนทั้งคลาส — จดเก็บไว้ ห้ามแจกนักเรียน
              </div>
            </div>
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
            {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}
            <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={busy || name.trim().length < 2} onClick={create}>
              <Plus size={16} /> {busy ? 'กำลังสร้าง…' : 'สร้างคลาส'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => { setMode('connect'); setError('') }}>
              <KeyRound size={14} /> มีรหัสผู้สอนอยู่แล้ว?
            </button>
          </>
        ) : (
          <>
            <label className="label" style={{ marginTop: 12 }}>รหัสผู้สอน (8 ตัว)</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') connect() }}
              maxLength={12}
              autoCapitalize="characters"
              autoFocus
              style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
            />
            {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}
            <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={busy || !code.trim()} onClick={connect}>
              <KeyRound size={16} /> {busy ? 'กำลังตรวจ…' : 'เชื่อมคลาส'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => { setMode('create'); setError('') }}>
              สร้างคลาสใหม่แทน
            </button>
          </>
        )}
      </div>
    </div>
  )
}
