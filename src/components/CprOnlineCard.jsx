import { Link } from 'react-router-dom'
import { ArrowRight, HeartPulse } from 'lucide-react'
import { CPR_COURSE_PATH } from '../hooks/useClassCpr'
import { CHAPTER_PRICES, CPR_CHAPTER } from '../config/pricing'
import { phCapture } from '../lib/posthog'

// ชวนต่อ CPR & AED ออนไลน์ — คอร์สอยู่ในเว็บนี้แล้ว (หมวด 5, หน้า /cpr) ไม่ต้องข้ามไปเว็บอื่น
// - นักเรียนคลาสรวม CPR (inClass): เรียนฟรี ไม่ต้องกรอกชื่อ/เบอร์/โค้ดใหม่
// - คนทั่วไป: ปลดล็อกหมวด 5 แบบหมวดอื่น (หน้า /cpr แสดงการ์ดซื้อ/กรอกโค้ด)
export default function CprOnlineCard({ inClass = false, title = 'ต่อด้วย CPR & AED ออนไลน์', desc, source = 'unknown', style }) {
  return (
    <div className="card" style={{ marginTop: 16, borderColor: '#F3C4C4', background: '#FFF7F7', ...style }} data-testid="cpr-online-card">
      <div className="text-body-strong" style={{ color: '#B91C1C' }}>
        <HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />{title}
      </div>
      <div className="text-caption" style={{ marginTop: 4 }}>
        {desc || (inClass
          ? 'เรียนต่อในเว็บนี้ได้เลย 6 บทสั้น ๆ + สอบปลายภาค — คนในคลาสเรียนฟรี ไม่ต้องสมัครหรือกรอกโค้ดใหม่'
          : `หมวด ${CPR_CHAPTER} ในเว็บนี้: CPR ผู้ใหญ่/ทารก, สำลัก, ใช้เครื่อง AED — 6 บทสั้น ๆ + สอบปลายภาค ได้ใบประกาศ CPR (฿${CHAPTER_PRICES[CPR_CHAPTER]})`)}
      </div>
      <Link to={CPR_COURSE_PATH} className="btn btn-primary btn-block" style={{ marginTop: 10 }}
        onClick={() => phCapture('cpr_online_click', { source, inApp: true, inClass })}>
        {inClass ? 'เรียน CPR & AED ต่อ' : 'ดูหมวด CPR & AED'} <ArrowRight size={16} />
      </Link>
    </div>
  )
}
