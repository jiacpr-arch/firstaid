import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ExternalLink, Globe, X } from 'lucide-react'
import {
  HOUSE_ADS_ENABLED,
  HOUSE_ADS_ROTATE_SECONDS,
  houseAds,
  pickAdsForRoute,
} from '../config/houseAds'
import { useSettingsStore } from '../stores/settingsStore'

// ปิดแบนเนอร์ได้ 24 ชม. หลังกดปิด แล้วค่อยกลับมาโชว์
const DISMISS_MS = 24 * 60 * 60 * 1000

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

// แถบโฆษณาแบบติดถาวร (sticky) เหนือเมนูล่าง — โผล่ทุกหน้าผู้ใช้
// หมุนเวียนเวปในเครือตามบริบทของหน้า และกดปิดได้
export function HouseAdStrip() {
  const location = useLocation()
  const dismissedAt = useSettingsStore((s) => s.houseAdDismissedAt)
  const dismissHouseAd = useSettingsStore((s) => s.dismissHouseAd)
  const [index, setIndex] = useState(0)
  const [prevPath, setPrevPath] = useState(location.pathname)
  // เวลาขณะ mount — ใช้เทียบอายุการปิดแบนเนอร์ (เลี่ยงเรียก Date.now() ตอน render)
  const [mountedAt] = useState(() => Date.now())

  // เลือกชุดแบนเนอร์ตาม path; เปลี่ยนหน้าแล้วรีเซ็ตลำดับให้เริ่มจากตัวที่ตรงบริบท
  const ads = useMemo(() => pickAdsForRoute(location.pathname), [location.pathname])
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname)
    setIndex(0)
  }

  useEffect(() => {
    if (ads.length < 2) return
    const t = setInterval(
      () => setIndex((i) => (i + 1) % ads.length),
      HOUSE_ADS_ROTATE_SECONDS * 1000,
    )
    return () => clearInterval(t)
  }, [ads])

  const dismissed = dismissedAt > 0 && mountedAt - dismissedAt < DISMISS_MS
  const visible = HOUSE_ADS_ENABLED && ads.length > 0 && !dismissed

  // เลื่อนปุ่มฉุกเฉิน/เนื้อหาขึ้นเมื่อแถบโชว์ (สไตล์ที่ body.has-house-strip ใน index.css)
  useEffect(() => {
    document.body.classList.toggle('has-house-strip', visible)
    return () => document.body.classList.remove('has-house-strip')
  }, [visible])

  if (!visible) return null
  const ad = ads[index % ads.length]

  return (
    <div className="house-ad-strip">
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackAdClick(ad)}
        className="house-ad-strip-link"
      >
        <div className="house-ad-strip-icon" style={{ background: `${ad.color}15`, color: ad.color }}>
          <Globe size={18} />
        </div>
        <div className="house-ad-strip-text">
          <div className="house-ad-strip-name" style={{ color: ad.color }}>{ad.name}</div>
          <div className="text-caption house-ad-strip-tagline">{ad.tagline}</div>
        </div>
        <ExternalLink size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      </a>
      <button
        type="button"
        className="house-ad-strip-close"
        aria-label="ปิดแบนเนอร์เว็บในเครือ"
        onClick={() => {
          window.fbq?.('trackCustom', 'HouseAdDismiss', { site: ad.id })
          dismissHouseAd()
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
