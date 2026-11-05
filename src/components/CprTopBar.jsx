import { ExternalLink, HeartPulse, RefreshCw } from 'lucide-react'
import { useClassCpr, cprCourseUrl } from '../hooks/useClassCpr'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { phCapture } from '../lib/posthog'

// แถบบนสุดของหน้าหลัก/หน้าเรียน สำหรับนักเรียนคลาสรวม CPR ที่ยังเรียน CPR & AED ออนไลน์ไม่จบ
// ปุ่มไป cpr.morroo.com พร้อมโค้ดคลาส — ขึ้นเฉพาะหลังทำ Post-test ปฐมพยาบาลผ่านแล้ว
// (ลำดับคลาส: ปฐมพยาบาลให้จบก่อน แล้วค่อยไป CPR — เคยโชว์ตั้งแต่ต้นแล้วนักเรียนข้ามไปเรียน CPR กลางคอร์ส)
export default function CprTopBar({ source = 'top_bar', style }) {
  const learner = useLearnerStore((s) => s.learner)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const cpr = useClassCpr()
  if (!postTestDone) return null
  if (!learner?.cohortCode || (cpr.status !== 'todo' && cpr.status !== 'unknown')) return null
  if (cpr.status === 'unknown' && !learner?.cprPromoCode) return null
  const promo = cpr.promoCode || learner.cprPromoCode
  const url = cprCourseUrl(promo)
  return (
    <div className="card" data-testid="cpr-top-bar"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12, borderColor: '#F3C4C4', background: '#FFF7F7', ...style }}>
      <HeartPulse size={22} color="#B91C1C" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-body-strong" style={{ color: '#B91C1C' }}>ขั้นสุดท้าย: เรียน CPR & AED ออนไลน์ (คลาสนี้ต้องเรียน)</div>
        <div className="text-caption">
          {cpr.cpr?.modulesDone > 0 ? `เรียนไปแล้ว ${cpr.cpr.modulesDone}/7 บท · ` : ''}เรียนให้จบก่อนวันอบรม · ใช้เบอร์เดียวกับที่เข้าคลาส{promo ? <> · โค้ด <b>{promo}</b></> : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 13, padding: '8px 12px' }}
          onClick={() => phCapture('cpr_online_click', { source, promo: !!promo })}>
          <ExternalLink size={14} /> ไปเรียน
        </a>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={cpr.refresh} disabled={cpr.checking}>
          <RefreshCw size={11} /> {cpr.checking ? 'กำลังเช็ค…' : 'เช็คอีกครั้ง'}
        </button>
      </div>
    </div>
  )
}
