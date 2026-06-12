import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'

const FEED_URL = 'https://jiaaed.com/api/news/public'

const fmtDate = (d) => {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// ข่าวช่วยชีวิต/AED จาก jiaaed.com — ลิงก์กลับไปข่าวต้นฉบับเสมอ (ลิขสิทธิ์เป็นของสำนักข่าวเดิม)
export default function JiaAedNewsSection({ limit = 5 }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${FEED_URL}?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => { cancelled = true }
  }, [limit])

  // ออฟไลน์หรือฟีดล่ม → ซ่อนทั้ง section ไม่ให้หน้า Home พัง
  if (!items || items.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Newspaper size={18} color="#DC2626" />
        <div className="text-headline">ข่าวการช่วยชีวิต & AED</div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((n, i) => (
          <a
            key={n.source_url || i}
            href={n.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            style={{ display: 'block' }}
          >
            <div className="text-caption" style={{ color: '#DC2626', fontWeight: 700, marginBottom: 2 }}>
              {[n.topic, n.source_name].filter(Boolean).join(' · ')}
            </div>
            <div className="text-headline" style={{ fontSize: 15 }}>{n.source_title}</div>
            {n.our_blurb && (
              <div className="text-caption" style={{ marginTop: 4, lineHeight: 1.5 }}>{n.our_blurb}</div>
            )}
            {n.published_at && (
              <div className="text-caption" style={{ marginTop: 6, fontSize: 11 }}>{fmtDate(n.published_at)}</div>
            )}
          </a>
        ))}
      </div>
      <div className="text-caption" style={{ marginTop: 8, fontSize: 11, textAlign: 'center' }}>
        ข่าวจาก{' '}
        <a href="https://jiaaed.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}>
          jiaaed.com
        </a>{' '}
        — แตะข่าวเพื่ออ่านต้นฉบับ
      </div>
    </div>
  )
}
