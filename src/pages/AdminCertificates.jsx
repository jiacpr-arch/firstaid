import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Search } from 'lucide-react'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { adminFetch } from '../utils/adminFetch'
import { HUB_URL } from '../utils/hubCertificate'
import HubCertificateAdmin from '../components/HubCertificateAdmin'

const KIND_LABEL = { theory: 'ภาคทฤษฎี', practical: 'ภาคปฏิบัติ' }
const KIND_FILTERS = [['', 'ทั้งหมด'], ['theory', 'ภาคทฤษฎี'], ['practical', 'ภาคปฏิบัติ']]

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const TABS = [['hub', 'ใบระบบกลาง (แก้ไขได้)'], ['local', 'ใบ FA- ในแอปนี้']]

// สองแท็บ: ใบระบบกลาง (ใบที่ผู้เรียนเห็นและพิมพ์ — ค้นหา แก้ชื่อ เพิกถอน ผ่านคำสั่งของระบบกลาง)
// และใบที่แอปนี้บันทึกไว้เอง (เลข FA- / ภาคปฏิบัติ — ค้นหาและดาวน์โหลด CSV อ่านอย่างเดียว)
export default function AdminCertificates() {
  const [tab, setTab] = useState('hub')
  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">ใบประกาศ</div>
      </div>
      <div role="tablist" style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={tab === k ? 'btn btn-primary' : 'btn btn-ghost'}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'hub' ? <HubCertificateAdmin /> : <LocalCertificates />}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="text-body">
          ใบที่ผู้เรียนเห็นและพิมพ์ ออกจาก<b>ระบบกลาง JIA</b> (class.jiacpr.com)
        </div>
        <ul className="text-body" style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
          <li>ภาคทฤษฎี: ออกอัตโนมัติเมื่อผู้เรียนเข้าสู่ระบบและผ่าน Post-test ≥ 80%</li>
          <li>
            ภาคปฏิบัติ: ออกอัตโนมัติเมื่อสอบสถานีผ่านใน{' '}
            <Link to="/admin/teach" style={{ color: 'var(--color-brand)' }}>คลาสของฉัน</Link> — ดูว่าใครได้ใบแล้วที่แท็บ "ใบประกาศ"
          </li>
          <li>แท็บ "ใบระบบกลาง": แก้ชื่อและเพิกถอนได้ เฉพาะบัญชีที่เป็นแอดมินของระบบกลาง ทุกครั้งต้องใส่เหตุผลและระบบเก็บประวัติไว้</li>
          <li>แท็บ "ใบ FA-": ใบที่แอปนี้บันทึกไว้เอง ดูและดาวน์โหลดได้อย่างเดียว</li>
        </ul>
        <a className="btn btn-ghost btn-block" style={{ marginTop: 12, textDecoration: 'none' }}
          href={`${HUB_URL}/operations/certificates`} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> เปิดหน้าใบประกาศของระบบกลาง (ทุกหลักสูตร)
        </a>
      </div>
    </div>
  )
}

// ใบที่แอปนี้บันทึกไว้ (public.certificates — เลข FA- / ใบภาคปฏิบัติ) ค้นด้วยชื่อ เบอร์ อีเมล หรือเลขใบ
function LocalCertificates() {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(0)
  // { key, body } or { key, error } for the last finished request; loading while it's for another key
  const [fetched, setFetched] = useState(null)
  const key = `${q}|${kind}|${page}`

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    if (kind) params.set('kind', kind)
    const requestKey = `${q}|${kind}|${page}`
    adminFetch(`/api/certificates/list?${params}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || 'โหลดรายการไม่สำเร็จ')
        return body
      })
      .then((body) => { if (!cancelled) setFetched({ key: requestKey, body }) })
      .catch((e) => { if (!cancelled) setFetched((prev) => ({ key: requestKey, body: prev?.body, error: e.message })) })
    return () => { cancelled = true }
  }, [q, kind, page])

  const loading = isSupabaseConfigured && fetched?.key !== key
  const result = fetched?.body || null
  const error = fetched?.key === key ? fetched.error : null

  const submit = (e) => {
    e.preventDefault()
    setPage(0)
    setQ(input.trim())
  }
  const pickKind = (k) => { setPage(0); setKind(k) }

  // ดาวน์โหลดทุกใบที่ตรงกับคำค้น/ประเภทที่เลือกอยู่ (ไม่ใช่แค่หน้านี้) — ต้องแนบ token จึงโหลดผ่าน fetch แล้วสร้างไฟล์เอง
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const downloadCsv = async () => {
    const params = new URLSearchParams({ format: 'csv' })
    if (q) params.set('q', q)
    if (kind) params.set('kind', kind)
    setExporting(true)
    setExportError(null)
    try {
      const r = await adminFetch(`/api/certificates/list?${params}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'ดาวน์โหลดไม่สำเร็จ')
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'certificates.csv'
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setExportError(e.message)
    } finally {
      setExporting(false)
    }
  }

  const rows = result?.certificates || []
  const total = result?.total || 0
  const pageSize = result?.pageSize || 50
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)

  return (
    <>
      <form className="card" style={{ marginTop: 12 }} onSubmit={submit}>
        <label className="label" htmlFor="cert-search">ค้นหาใบประกาศ</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="cert-search" className="input" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="ชื่อ เบอร์โทร อีเมล หรือเลขใบ (FA-…)" maxLength={60} />
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
      {error && <div className="callout callout-danger" style={{ marginTop: 12 }} role="alert">{error}</div>}

      {result && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <div className="text-caption">
            {loading ? 'กำลังโหลด…' : `พบ ${total.toLocaleString('th-TH')} ใบ${q ? ` สำหรับ “${q}”` : ''}`}
          </div>
          <button type="button" className="btn btn-ghost" style={{ flexShrink: 0 }}
            disabled={exporting || loading || !total} onClick={downloadCsv}>
            <Download size={16} /> {exporting ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลด CSV'}
          </button>
        </div>
      )}
      {exportError && <div className="callout callout-danger" style={{ marginTop: 8 }} role="alert">{exportError}</div>}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {result && !loading && !rows.length && <div className="card text-body">ไม่พบใบประกาศ</div>}
        {rows.map((c) => (
          <div key={c.id} className="card" data-testid="cert-row" style={{ opacity: c.revokedAt ? 0.65 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div className="text-body" style={{ fontWeight: 700 }}>{c.name || '(ไม่มีชื่อ)'}</div>
                <div className="text-caption" style={{ fontFamily: 'monospace' }}>{c.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className={c.kind === 'practical' ? 'badge badge-warning' : 'badge badge-success'}>{KIND_LABEL[c.kind] || c.kind}</span>
                {c.revokedAt && <span className="badge badge-danger">เพิกถอนแล้ว</span>}
              </div>
            </div>
            <div className="text-caption" style={{ marginTop: 6, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
              ออกเมื่อ {fmtDate(c.issuedAt)}
              {c.cohortName && <> · คลาส {c.cohortName}</>}
              {c.location && <> · {c.location}</>}
              {(c.phone || c.email) && <><br />{[c.phone, c.email].filter(Boolean).join(' · ')}</>}
            </div>
          </div>
        ))}
      </div>

      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button>
          <span className="text-caption">หน้า {page + 1} / {lastPage + 1}</span>
          <button type="button" className="btn btn-ghost" disabled={loading || page >= lastPage} onClick={() => setPage(page + 1)}>ถัดไป →</button>
        </div>
      )}

    </>
  )
}
