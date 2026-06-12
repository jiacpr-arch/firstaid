import { Link } from 'react-router-dom'
import { ExternalLink, Newspaper } from 'lucide-react'
import { useJiaAedNews } from '../hooks/useJiaAedNews'

function trackNewsClick(item) {
  window.fbq?.('trackCustom', 'JiaAedNewsClick', { topic: item.topic ?? '' })
}

export function JiaAedNewsCard({ item }) {
  return (
    <a
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
  )
}

export default function JiaAedNewsFeed() {
  const items = useJiaAedNews(3)

  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div className="text-caption" style={{ marginBottom: 6, paddingLeft: 4 }}>
        ข่าวกู้ชีพ/AED จาก JiaAED
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
          <JiaAedNewsCard key={item.id} item={item} />
        ))}
      </div>
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <Link to="/news" className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          ดูข่าวทั้งหมด →
        </Link>
      </div>
    </div>
  )
}
