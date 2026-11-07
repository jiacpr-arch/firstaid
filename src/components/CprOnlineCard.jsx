import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowRight, ExternalLink, HeartPulse } from 'lucide-react'
import { CPR_COURSE_PATH, CPR_PUBLIC_URL } from '../hooks/useClassCpr'
import { phCapture } from '../lib/posthog'

// ชวนต่อ CPR & AED ออนไลน์
// - นักเรียนคลาสรวม CPR (inClass): คอร์สอยู่ในเว็บนี้แล้ว (/cpr) — ปุ่มเดียว ไม่ต้องกรอกชื่อ/เบอร์/โค้ดใหม่
// - คนทั่วไป: ปุ่ม + QR ไปซื้อ/เรียนที่ cpr.morroo.com (กดบนมือถือ หรือสแกน QR จากจอคอม/แท็บเล็ต)
export default function CprOnlineCard({ inClass = false, title = 'ต่อด้วย CPR & AED ออนไลน์', desc, source = 'unknown', style }) {
  if (inClass) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: '#F3C4C4', background: '#FFF7F7', ...style }} data-testid="cpr-online-card">
        <div className="text-body-strong" style={{ color: '#B91C1C' }}>
          <HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />{title}
        </div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          {desc || 'เรียนต่อในเว็บนี้ได้เลย 6 บทสั้น ๆ + สอบปลายภาค — คนในคลาสเรียนฟรี ไม่ต้องสมัครหรือกรอกโค้ดใหม่'}
        </div>
        <Link to={CPR_COURSE_PATH} className="btn btn-primary btn-block" style={{ marginTop: 10 }}
          onClick={() => phCapture('cpr_online_click', { source, inApp: true })}>
          เรียน CPR & AED ต่อ <ArrowRight size={16} />
        </Link>
      </div>
    )
  }
  return <PublicCprCard title={title} desc={desc} source={source} style={style} />
}

function PublicCprCard({ title, desc, source, style }) {
  const url = CPR_PUBLIC_URL
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
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        {qr && (
          <img src={qr} alt="QR ไปเรียน CPR & AED ออนไลน์" width={120} height={120}
            style={{ borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)' }} />
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block"
            onClick={() => phCapture('cpr_online_click', { source, promo: false })}>
            <ExternalLink size={16} /> ไปเรียน CPR & AED ออนไลน์
          </a>
          <div className="text-caption" style={{ marginTop: 6, wordBreak: 'break-all' }}>{url.replace('https://', '')}</div>
        </div>
      </div>
    </div>
  )
}
