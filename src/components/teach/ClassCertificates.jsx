import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { adminFetch } from '../../utils/adminFetch'
import { HUB_URL } from '../../utils/hubCertificate'

const BADGE = { hub: 'badge badge-success', waiting: 'badge badge-warning', none: 'badge badge-muted' }
const LABEL = { hub: 'ได้ใบแล้ว', waiting: 'ยังไม่ได้ใบ', none: 'ยังไม่ผ่าน' }
// คนที่ติดอยู่ (ผ่านแล้วแต่ยังไม่ได้ใบ) ขึ้นก่อน แล้วคนที่ยังไม่ผ่าน แล้วคนที่ได้ใบครบ
const rank = (r) => (r.practical.state === 'waiting' || r.theory.state === 'waiting' ? 0
  : r.practical.state === 'hub' && r.theory.state === 'hub' ? 2 : 1)

function CertCell({ label, cert }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="text-caption">{label}</div>
      <span className={BADGE[cert.state]}>{LABEL[cert.state]}</span>
      {cert.state === 'hub' ? (
        <a className="text-caption" style={{ display: 'block', marginTop: 2, wordBreak: 'break-all' }}
          href={HUB_URL + cert.verifyPath} target="_blank" rel="noreferrer">{cert.number} ↗</a>
      ) : (
        <div className="text-caption" style={{ marginTop: 2 }}>{cert.reason}</div>
      )}
    </div>
  )
}

// แท็บ "ใบประกาศ": ใครในคลาสได้ใบจากระบบกลาง JIA แล้ว (ทฤษฎีออนไลน์ + ปฏิบัติ) และคนที่ยังไม่ได้ติดอะไร
// ปุ่ม "ส่งผลที่ค้าง" ส่งผลภาคปฏิบัติของคนที่ผ่านแล้วแต่ยังไม่มีใบเข้าระบบกลางอีกครั้ง
export default function ClassCertificates({ classId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const resp = await adminFetch(`/api/classes/certificates?cohortId=${encodeURIComponent(classId)}`)
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setError(body.error || 'โหลดข้อมูลไม่สำเร็จ'); return }
      setError('')
      setData(body)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ')
    }
  }, [classId])

  useEffect(() => {
    let cancelled = false
    adminFetch(`/api/classes/certificates?cohortId=${encodeURIComponent(classId)}`)
      .then(async (resp) => {
        const body = await resp.json().catch(() => ({}))
        if (cancelled) return
        if (!resp.ok) setError(body.error || 'โหลดข้อมูลไม่สำเร็จ')
        else setData(body)
      })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ') })
    return () => { cancelled = true }
  }, [classId])

  const resend = async () => {
    setBusy(true)
    setNote('')
    try {
      const resp = await adminFetch('/api/classes/certificates', { method: 'POST', body: JSON.stringify({ cohortId: classId, action: 'resend' }) })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setNote(body.error || 'ส่งไม่สำเร็จ'); return }
      const stuck = body.pending?.length ? ` · ยังออกไม่ได้ ${body.pending.length} คน: ${body.pending.map((p) => `${p.name || '(ไม่ระบุชื่อ)'} (${p.reason})`).join(', ')}` : ''
      setNote(`ส่งแล้ว ${body.sent} คน · ได้ใบ ${body.issued} คน${stuck}`)
      await load()
    } catch {
      setNote('เครือข่ายขัดข้อง ลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div>
  if (!data) return <div className="text-caption" style={{ marginTop: 12 }}>กำลังโหลด…</div>
  const { rows, totals, hubError } = data
  if (!rows.length) return <div className="card" style={{ marginTop: 12 }}><div className="text-caption">ยังไม่มีนักเรียนเข้าร่วมคลาส</div></div>
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b))

  return (
    <>
      {hubError && <div className="callout" style={{ marginTop: 12 }}>{hubError} — สถานะด้านล่างเป็นข้อมูลฝั่งเว็บนี้เท่านั้น</div>}

      <div className="card" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-brand)' }}>{totals.theoryHub}/{totals.learners}</div>
          <div className="text-caption">ได้ใบภาคทฤษฎี</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-brand)' }}>{totals.practicalHub}/{totals.learners}</div>
          <div className="text-caption">ได้ใบภาคปฏิบัติ</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="text-body-strong">ผ่านภาคปฏิบัติแล้วแต่ยังไม่ได้ใบ: {totals.practicalWaiting} คน</div>
        <div className="text-caption" style={{ marginTop: 2 }}>
          ส่งผลของคนที่เข้าสู่ระบบแล้วเข้าระบบกลางอีกครั้ง ({totals.resendable} คน) ส่งซ้ำได้ ไม่ออกใบซ้ำ
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !totals.resendable} onClick={resend}>
            <Send size={16} /> {busy ? 'กำลังส่ง…' : 'ส่งผลที่ค้าง'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={load} aria-label="โหลดใหม่"><RefreshCw size={16} /></button>
        </div>
        {note && <div className="text-caption" style={{ marginTop: 6 }}>{note}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {sorted.map((r) => (
          <div key={r.learnerId} className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Link to={`/admin/teach/learners/${r.learnerId}`} className="text-body-strong" style={{ flex: 1 }}>{r.name || '(ไม่ระบุชื่อ)'}</Link>
              {r.group && <span className="badge badge-muted">กลุ่ม {r.group}</span>}
              {!r.hasAccount && <span className="badge badge-muted">ยังไม่เข้าสู่ระบบ</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <CertCell label="ภาคทฤษฎี (ออนไลน์)" cert={r.theory} />
              <CertCell label="ภาคปฏิบัติ" cert={r.practical} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
