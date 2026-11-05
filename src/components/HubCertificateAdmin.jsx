import { useEffect, useState } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { certificateAdmin, HUB_URL, HUB_COURSE_ID } from '../utils/hubCertificate'

const KIND_LABEL = { online: 'ภาคทฤษฎี', practical: 'ภาคปฏิบัติ' }
const KIND_FILTERS = [['', 'ทั้งหมด'], ['online', 'ภาคทฤษฎี'], ['practical', 'ภาคปฏิบัติ']]
const STATUS = { issued: ['ใช้งานได้', 'badge-success'], revoked: ['เพิกถอนแล้ว', 'badge-danger'], expired: ['หมดอายุ', 'badge-muted'] }
const ACTION_LABEL = { rename: 'แก้ชื่อ', revoke: 'เพิกถอน', print: 'พิมพ์' }
const PAGE = 50

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric' })
}

// ใบประกาศ First Aid ของระบบกลาง (ใบที่ผู้เรียนเห็นและพิมพ์) — ค้นหา ดูประวัติ แก้ชื่อบนใบ และเพิกถอน
// ด้วยคำสั่งเดียวกับหน้า /operations/certificates ของระบบกลาง ใช้ session ของแอดมินที่ล็อกอินอยู่
export default function HubCertificateAdmin() {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState(null)
  // { key, body } or { key, error } for the last finished search; loading while it's for another key
  const [fetched, setFetched] = useState(null)
  const key = `${q}|${kind}|${offset}|${reload}`

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    const requestKey = `${q}|${kind}|${offset}|${reload}`
    certificateAdmin('searchAll', { q, kind: kind || undefined, course: HUB_COURSE_ID, offset })
      .then((body) => { if (!cancelled) setFetched({ key: requestKey, body }) })
      .catch((e) => { if (!cancelled) setFetched((prev) => ({ key: requestKey, body: prev?.body, error: e.message })) })
    return () => { cancelled = true }
  }, [q, kind, offset, reload])

  const loading = isSupabaseConfigured && fetched?.key !== key
  const body = fetched?.body || null
  const error = fetched?.key === key ? fetched.error : null
  const items = body?.items || []
  const total = body?.total || 0
  const isAdmin = body?.role === 'admin'

  const submit = (e) => {
    e.preventDefault()
    setOffset(0)
    setQ(input.trim())
  }
  const pickKind = (k) => { setOffset(0); setKind(k) }
  const changed = (msg) => { setNotice(msg); setReload((n) => n + 1) }

  return (
    <>
      <form className="card" style={{ marginTop: 12 }} onSubmit={submit}>
        <label className="label" htmlFor="hub-cert-search">ค้นหาใบระบบกลาง (First Aid)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="hub-cert-search" className="input" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="ชื่อ อีเมล เลขบัตรนักเรียน หรือเลขใบ (JIA-…)" maxLength={100} />
          <button type="submit" className="btn btn-primary" disabled={loading} aria-label="ค้นหา">
            <Search size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {KIND_FILTERS.map(([k, label]) => (
            <button key={k || 'all'} type="button" onClick={() => pickKind(k)}
              className={kind === k ? 'badge badge-brand' : 'badge badge-muted'}
              style={{ border: 'none', cursor: 'pointer' }} aria-pressed={kind === k}>
              {label}
            </button>
          ))}
        </div>
      </form>

      {!isSupabaseConfigured && <div className="callout callout-info" style={{ marginTop: 12 }}>ยังไม่ได้เชื่อมต่อ Supabase</div>}
      {error && (
        <div className="callout callout-danger" style={{ marginTop: 12 }} role="alert">
          {error}
          <div className="text-caption" style={{ marginTop: 4 }}>
            แท็บนี้ใช้บัญชีที่ล็อกอินหน้าแอดมินอยู่ บัญชีนั้นต้องเป็นแอดมินหรือผู้สอนของระบบกลาง (class.jiacpr.com)
          </div>
        </div>
      )}
      {notice && <div className="callout callout-info" style={{ marginTop: 12 }} role="status">{notice}</div>}

      {body && (
        <div className="text-caption" style={{ marginTop: 12 }}>
          {loading ? 'กำลังโหลด…' : `พบ ${total.toLocaleString('th-TH')} ใบ${q ? ` สำหรับ “${q}”` : ''}`}
          {!loading && !isAdmin && ' · บัญชีนี้ดูได้อย่างเดียว (แก้ชื่อ/เพิกถอนได้เฉพาะแอดมินระบบกลาง)'}
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {body && !loading && !items.length && <div className="card text-body">ไม่พบใบประกาศ</div>}
        {items.map((c) => <HubCertificate key={c.id} c={c} isAdmin={isAdmin} onChanged={changed} />)}
      </div>

      {total > PAGE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" disabled={loading || offset === 0} onClick={() => setOffset(offset - PAGE)}>← ก่อนหน้า</button>
          <span className="text-caption">หน้า {offset / PAGE + 1} / {Math.ceil(total / PAGE)}</span>
          <button type="button" className="btn btn-ghost" disabled={loading || offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>ถัดไป →</button>
        </div>
      )}
    </>
  )
}

function HubCertificate({ c, isAdmin, onChanged }) {
  const [mode, setMode] = useState(null)
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [status, cls] = STATUS[c.status] || [c.status, 'badge-muted']

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const toggleHistory = () => run(async () => {
    setHistory(history ? null : (await certificateAdmin('history', { id: c.id })).items || [])
  })
  const submit = (action) => (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const reason = String(f.get('reason') || '').trim()
    if (action === 'revoke' && !confirm(`เพิกถอนใบ ${c.number} ของ “${c.name}”? ใบจะขึ้นว่าเพิกถอนแล้วทุกที่ และยกเลิกไม่ได้`)) return
    const payload = action === 'rename'
      ? { id: c.id, nameTh: String(f.get('nameTh') || '').trim(), nameEn: String(f.get('nameEn') || '').trim(), reason }
      : { id: c.id, reason }
    run(async () => {
      await certificateAdmin(action, payload)
      setMode(null)
      setHistory(null)
      onChanged(action === 'rename' ? `แก้ชื่อบนใบ ${c.number} แล้ว` : `เพิกถอนใบ ${c.number} แล้ว`)
    })
  }

  return (
    <div className="card" data-testid="hub-cert-row" style={{ opacity: c.status === 'revoked' ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-body" style={{ fontWeight: 700 }}>{c.name}</div>
          {c.nameEn && <div className="text-caption">{c.nameEn}</div>}
          <div className="text-caption" style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{c.number}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={c.kind === 'practical' ? 'badge badge-warning' : 'badge badge-success'}>{KIND_LABEL[c.kind] || c.kind}</span>
          <span className={`badge ${cls}`}>{status}</span>
        </div>
      </div>
      <div className="text-caption" style={{ marginTop: 6, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
        ออก {fmtDate(c.issuedAt)} · หมดอายุ {fmtDate(c.expiresAt)}
        {c.groupLabel && c.kind === 'practical' && <> · {c.groupLabel}</>}
        {c.email && <><br />{c.email}</>}
        {c.status === 'revoked' && <><br />เพิกถอนเมื่อ {fmtDate(c.revokedAt)} — {c.revokeReason}</>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {c.verifyPath && (
          <a className="btn btn-ghost" href={HUB_URL + c.verifyPath} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <ExternalLink size={14} /> ตรวจสอบ
          </a>
        )}
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={toggleHistory}>
          ประวัติ{c.changes > 0 ? ` (${c.changes})` : ''}
        </button>
        {isAdmin && c.status !== 'revoked' && (
          <>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setMode(mode === 'rename' ? null : 'rename')}>แก้ชื่อ</button>
            <button type="button" className="btn btn-ghost" style={{ color: '#A0392F' }} disabled={busy}
              onClick={() => setMode(mode === 'revoke' ? null : 'revoke')}>เพิกถอน</button>
          </>
        )}
      </div>

      {error && <div className="callout callout-danger" style={{ marginTop: 8 }} role="alert">{error}</div>}

      {history && (
        history.length
          ? <ul className="text-caption" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            {history.map((h, i) => (
              <li key={i}>
                {fmtDate(h.at)} · {ACTION_LABEL[h.action] || h.action} โดย {h.actor} — {h.reason}
                {h.action === 'rename' && h.detail && ` (${h.detail.fromTh} → ${h.detail.toTh})`}
              </li>
            ))}
          </ul>
          : <div className="text-caption" style={{ marginTop: 8 }}>ยังไม่มีประวัติการแก้ไข</div>
      )}

      {mode === 'rename' && (
        <form onSubmit={submit('rename')} style={{ marginTop: 10 }}>
          <div className="text-caption">แก้เฉพาะชื่อบนใบนี้ บัตรนักเรียนไม่เปลี่ยน · ใบจะกลับเป็น "ยังไม่ได้ตรวจกับบัตรประชาชน"</div>
          <label className="label" style={{ marginTop: 6 }}>ชื่อ–นามสกุล (ไทย)
            <input className="input" name="nameTh" required minLength={2} maxLength={100} defaultValue={c.name} autoComplete="off" />
          </label>
          <label className="label" style={{ marginTop: 6 }}>ชื่อ–นามสกุล (อังกฤษ)
            <input className="input" name="nameEn" maxLength={100} defaultValue={c.nameEn || ''} autoComplete="off" />
          </label>
          <label className="label" style={{ marginTop: 6 }}>เหตุผล
            <input className="input" name="reason" required minLength={3} maxLength={300} placeholder="เช่น สะกดนามสกุลผิด" />
          </label>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึกชื่อใหม่'}
          </button>
        </form>
      )}

      {mode === 'revoke' && (
        <form onSubmit={submit('revoke')} style={{ marginTop: 10 }}>
          <div className="text-caption">ใบจะยังอยู่แต่ขึ้นว่า "เพิกถอนแล้ว" ทุกที่ ยกเลิกไม่ได้ · ผู้เรียนจะได้ใบใหม่ก็ต่อเมื่อสอบผ่านใหม่</div>
          <label className="label" style={{ marginTop: 6 }}>เหตุผล
            <input className="input" name="reason" required minLength={3} maxLength={300} placeholder="เช่น ออกใบผิดคน" />
          </label>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 8, background: '#A0392F', borderColor: '#A0392F' }} disabled={busy}>
            {busy ? 'กำลังเพิกถอน…' : 'ยืนยันเพิกถอนใบนี้'}
          </button>
        </form>
      )}
    </div>
  )
}
