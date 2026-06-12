import { useEffect, useState } from 'react'
import { ExternalLink, Newspaper } from 'lucide-react'

// ข่าวกู้ชีพ/AED จาก JiaAED public API (cache ฝั่ง server 5 นาที)
// เก็บผลล่าสุดลง localStorage เพื่อให้ยังแสดงได้ตอนออฟไลน์ — โหลดไม่ได้และไม่มี cache = ไม่แสดง section
const NEWS_API = 'https://jiaaed.com/api/news/public?limit=3'
const CACHE_KEY = 'jiaaed-news-cache-v1'

function readCache() {
  try {
    const items = JSON.parse(localStorage.getItem(CACHE_KEY))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function trackNewsClick(item) {
  window.fbq?.('trackCustom', 'JiaAedNewsClick', { topic: item.topic ?? '' })
}

export default function JiaAedNewsFeed() {
  const [items, setItems] = useState(readCache)

  useEffect(() => {
    const controller = new AbortController()
    fetch(NEWS_API, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.items)) return
        setItems(data.items)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.items))
        } catch {
          // storage เต็ม/ปิดใช้งาน — ข้ามได้ แค่เสีย cache ออฟไลน์
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div className="text-caption" style={{ marginBottom: 6, paddingLeft: 4 }}>
        ข่าวกู้ชีพ/AED จาก JiaAED
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            onClick={() => trackNewsClick(item)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#D9770615',
              color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Newspaper size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong">{item.source_title}</div>
              {item.our_blurb && (
                <div className="text-caption" style={{ marginTop: 2 }}>{item.our_blurb}</div>
              )}
              <div className="text-caption" style={{ marginTop: 4, color: 'var(--color-text-muted)' }}>
                {[
                  item.source_name,
                  item.published_at &&
                    new Date(item.published_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    }),
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 4 }} />
          </a>
        ))}
      </div>
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <a
          href="https://jiaaed.com/news"
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ดูข่าวทั้งหมดที่ jiaaed.com/news →
        </a>
      </div>
    </div>
  )
}
