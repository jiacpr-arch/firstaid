import { useEffect, useState } from 'react'
import { ExternalLink, Globe } from 'lucide-react'
import { HOUSE_ADS_ENABLED, HOUSE_ADS_ROTATE_SECONDS, houseAds } from '../config/houseAds'

function trackAdClick(ad) {
  window.fbq?.('trackCustom', 'HouseAdClick', { site: ad.id })
}

// แบนเนอร์เดี่ยวแบบหมุนเวียน — ใช้แทรกตามหน้าต่าง ๆ
export default function HouseAdBanner() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * houseAds.length))

  useEffect(() => {
    if (houseAds.length < 2) return
    const t = setInterval(
      () => setIndex((i) => (i + 1) % houseAds.length),
      HOUSE_ADS_ROTATE_SECONDS * 1000,
    )
    return () => clearInterval(t)
  }, [])

  if (!HOUSE_ADS_ENABLED || houseAds.length === 0) return null
  const ad = houseAds[index]

  return (
    <div style={{ marginTop: 20 }}>
      <div className="text-caption" style={{ marginBottom: 6, paddingLeft: 4 }}>
        เว็บในเครือ morroo.com
      </div>
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        className="card"
        onClick={() => trackAdClick(ad)}
        style={{ display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: `${ad.color}15`,
          color: ad.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Globe size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-headline" style={{ color: ad.color }}>{ad.name}</div>
          <div className="text-caption">{ad.tagline}</div>
        </div>
        <ExternalLink size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      </a>
      {houseAds.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {houseAds.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              onClick={() => setIndex(i)}
              style={{
                width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
                background: i === index ? 'var(--color-text-muted)' : 'var(--color-border)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// รายชื่อเว็บในเครือทั้งหมด — ใช้ในหน้า Settings
export function HouseAdList() {
  if (!HOUSE_ADS_ENABLED || houseAds.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div className="text-caption">เว็บในเครือ morroo.com</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {houseAds.map((ad) => (
          <a
            key={ad.id}
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            onClick={() => trackAdClick(ad)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${ad.color}15`,
              color: ad.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong" style={{ color: ad.color }}>{ad.name}</div>
              <div className="text-caption">{ad.tagline}</div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          </a>
        ))}
      </div>
    </div>
  )
}
