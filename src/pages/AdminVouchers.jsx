import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Copy, Check, Ticket } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { chapters } from '../courses/firstaid/lessons'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE, COURSE_BUNDLE_CHAPTER } from '../config/pricing'

const CHAPTER_OPTIONS = [
  { value: COURSE_BUNDLE_CHAPTER, label: `ทั้งคอร์ส (฿${COURSE_BUNDLE_PRICE})` },
  ...chapters
    .filter((c) => CHAPTER_PRICES[c.id])
    .map((c) => ({ value: c.id, label: `หมวด ${c.id}: ${c.title} (฿${CHAPTER_PRICES[c.id]})` })),
]

const defaultPriceFor = (chapter) =>
  chapter === COURSE_BUNDLE_CHAPTER ? COURSE_BUNDLE_PRICE : CHAPTER_PRICES[chapter]

const statusLabel = { active: 'ยังไม่ใช้', redeemed: 'ใช้แล้ว', void: 'ยกเลิก' }
const statusClass = { active: 'badge-brand', redeemed: 'badge-success', void: 'badge-muted' }

// สร้าง/ดูโค้ดปลดล็อกบทเรียน (Phase 1) — ขายมือผ่าน PromptPay/LINE แล้วส่งโค้ดให้ลูกค้า
// redeem เองในแอป (/api/entitlements/redeem)
export default function AdminVouchers() {
  const [chapter, setChapter] = useState(CHAPTER_OPTIONS[0].value)
  const [count, setCount] = useState(1)
  const [priceThb, setPriceThb] = useState(defaultPriceFor(CHAPTER_OPTIONS[0].value))
  const [vouchers, setVouchers] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(() => isSupabaseConfigured)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const authedFetch = async (url, opts = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    })
  }

  const fetchVouchers = async () => {
    const res = await authedFetch('/api/vouchers/list')
    const data = await res.json().catch(() => ({}))
    return res.ok ? data.vouchers || [] : []
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    fetchVouchers().then((data) => {
      if (cancelled) return
      setVouchers(data)
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    if (!isSupabaseConfigured || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await authedFetch('/api/vouchers/create', {
        method: 'POST',
        body: JSON.stringify({ chapter, count: Number(count) || 1, priceThb: priceThb ? Number(priceThb) : null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'สร้างโค้ดไม่สำเร็จ'); return }
      const fresh = await fetchVouchers()
      setVouchers(fresh)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied((c) => (c === text ? '' : c)), 1500)
    } catch {
      setError('คัดลอกไม่สำเร็จ — กดค้างที่โค้ดเพื่อคัดลอกเอง')
    }
  }

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">โค้ดปลดล็อกบทเรียน</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ก่อน
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">หมวดที่จะปลดล็อก</label>
        <select
          className="input"
          value={chapter}
          onChange={(e) => {
            const next = Number(e.target.value)
            setChapter(next)
            setPriceThb(defaultPriceFor(next))
          }}
        >
          {CHAPTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">จำนวนโค้ด</label>
            <input className="input" type="number" min={1} max={100} value={count}
              onChange={(e) => setCount(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">ราคา (บาท)</label>
            <input className="input" type="number" min={0} value={priceThb ?? ''}
              onChange={(e) => setPriceThb(e.target.value)} />
          </div>
        </div>

        {error && <div className="callout callout-warning" style={{ marginTop: 10 }}>{error}</div>}

        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }}
          disabled={!isSupabaseConfigured || busy} onClick={create}>
          <Plus size={16} /> {busy ? 'กำลังสร้าง…' : 'สร้างโค้ด'}
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div className="text-caption" style={{ textAlign: 'center', padding: 12 }}>กำลังโหลด…</div>}
        {!loading && !vouchers.length && (
          <div className="text-caption" style={{ textAlign: 'center', padding: 12 }}>ยังไม่มีโค้ด</div>
        )}
        {vouchers.map((v) => (
          <div key={v.code} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--color-bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Ticket size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong" style={{ fontFamily: 'monospace' }}>{v.code}</div>
              <div className="text-caption">
                {v.chapter === COURSE_BUNDLE_CHAPTER ? 'ทั้งคอร์ส' : `หมวด ${v.chapter}`}
                {v.price_thb ? ` • ฿${v.price_thb}` : ''}
              </div>
            </div>
            <span className={`badge ${statusClass[v.status] || 'badge-muted'}`}>{statusLabel[v.status] || v.status}</span>
            <button type="button" className="btn btn-secondary" onClick={() => copy(v.code)}>
              {copied === v.code ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
