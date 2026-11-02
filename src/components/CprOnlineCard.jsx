import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ExternalLink, HeartPulse } from 'lucide-react'
import { cprCourseUrl } from '../hooks/useClassCpr'
import { phCapture } from '../lib/posthog'

// ปุ่ม + QR ไปเรียน CPR & AED ออนไลน์ที่ cpr.morroo.com — กดบนมือถือ หรือสแกน QR จากจอคอม/แท็บเล็ต
// promoCode (คลาสรวม CPR) แนบเป็น ?promo= ให้ cpr.morroo.com เปิดหน้ากรอกโค้ดให้เลย
export default function CprOnlineCard({ promoCode = null, title = 'ต่อด้วย CPR & AED ออนไลน์', desc, source = 'unknown', style }) {
  const url = cprCourseUrl(promoCode)
  const [qr, setQr] = useState(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 360, margin: 1 }).then((d) => { if (!cancelled) setQr(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [url])

  return (
    <div className="card" style={{ marginTop: 16, borderColor: '#F3C4C4', background: '#FFF7F7', ...style }}>
      <div className="text-body-strong" style={{ color: '#B91C1C' }}>
        <HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />{title}
      </div>
      <div className="text-caption" style={{ marginTop: 4 }}>
        {desc || 'เรียนต่อที่ cpr.morroo.com — กดปุ่มด้านล่าง หรือสแกน QR ด้วยมือถือ'}
        {promoCode && <> · ใช้โค้ดคลาส <b>{promoCode}</b></>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        {qr && (
          <img src={qr} alt="QR ไปเรียน CPR & AED ออนไลน์" width={120} height={120}
            style={{ borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)' }} />
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block"
            onClick={() => phCapture('cpr_online_click', { source, promo: !!promoCode })}>
            <ExternalLink size={16} /> ไปเรียน CPR & AED ออนไลน์
          </a>
          <div className="text-caption" style={{ marginTop: 6, wordBreak: 'break-all' }}>{url.replace('https://', '')}</div>
        </div>
      </div>
    </div>
  )
}
