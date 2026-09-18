import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ArrowRight } from 'lucide-react'
import { fetchUpcoming, bookingUrl, thShortDate, CONSUMER_COURSE_KEY, UTM_SOURCE } from '../config/jiaBookingHub'
import { phCapture } from '../lib/posthog'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* tracking ห้ามพังแอป */ }
}

/**
 * รอบอบรมภาคปฏิบัติ (B-CPR) ที่เปิดจองจริงจากระบบจองกลาง class.morroo.com —
 * ให้ผู้เรียนจองพร้อมจ่ายเงินได้เลยโดยไม่ต้องรอทีมงานติดต่อกลับ
 * ดึงข้อมูลไม่ได้หรือไม่มีรอบว่าง → ไม่ render อะไรเลย (หน้าเดิมทำงานตามปกติ)
 */
export default function UpcomingClassBanner({ source = 'unknown' }) {
  const [classes, setClasses] = useState(null)

  useEffect(() => {
    let alive = true
    fetchUpcoming().then((all) => {
      if (!alive || !all) return
      const open = all.filter((c) => c.course_key === CONSUMER_COURSE_KEY && c.seats_left > 0).slice(0, 3)
      if (open.length) setClasses(open)
    })
    return () => { alive = false }
  }, [])

  if (!classes) return null

  const onBook = (classId) => {
    fbqTrack('track', 'Lead', { content_name: 'cpr_aed_inperson_course', source, channel: 'booking' })
    phCapture('booking_click', { source, course_key: CONSUMER_COURSE_KEY, class_id: classId, utm_source: UTM_SOURCE })
  }

  return (
    <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: 13 }}>
        <CalendarDays size={15} style={{ flexShrink: 0 }} />
        รอบอบรมที่เปิดรับ — จองออนไลน์ได้เลย
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {classes.map((c) => (
          <a
            key={c.class_id}
            href={bookingUrl(c.course_key, c.class_id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onBook(c.class_id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
            }}
          >
            <span style={{ fontSize: 13, color: '#14532D' }}>
              <b>{thShortDate(c.date)}</b> · {c.time_slot} น.
              <span style={{ color: '#16A34A', marginLeft: 6 }}>เหลือ {c.seats_left} ที่</span>
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              fontSize: 12, fontWeight: 800, color: '#047857',
            }}>
              จอง ({Number(c.price).toLocaleString()} ฿) <ArrowRight size={13} />
            </span>
          </a>
        ))}
      </div>
      <Link
        to="/schedule"
        style={{
          display: 'block', marginTop: 8, textAlign: 'center',
          fontSize: 12, fontWeight: 700, color: '#047857', textDecoration: 'none',
        }}
      >
        ดูตารางสอนทุกรอบ →
      </Link>
    </div>
  )
}
