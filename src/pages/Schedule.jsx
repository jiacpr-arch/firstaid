import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, ArrowRight, Users } from 'lucide-react'
import { fetchUpcoming, bookingUrl, thShortDate, UTM_SOURCE } from '../config/jiaBookingHub'
import CallEmergencyButton from '../components/CallEmergencyButton'
import PracticalInterestForm from '../components/PracticalInterestForm'
import Seo from '../components/Seo'
import { phCapture } from '../lib/posthog'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* tracking ห้ามพังแอป */ }
}

const TH_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const TH_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์']

// "2026-08" → "สิงหาคม 2569"
function thMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `${TH_MONTHS_FULL[m - 1]} ${y + 543}`
}

// 2026-08-22 → "เสาร์" (parse เป็น local date ตรง ๆ — date-only ไม่มีเรื่อง timezone)
function thWeekday(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return ''
  return TH_WEEKDAYS[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()]
}

/**
 * ตารางสอนภาคปฏิบัติทุกคอร์สที่เปิดจองจริงจากระบบจองกลาง class.morroo.com —
 * จัดกลุ่มตามเดือน จองพร้อมจ่ายออนไลน์ได้เลย (แบนเนอร์เดิมโชว์แค่ 3 รอบแรกของ B-CPR
 * หน้านี้คือตารางเต็ม) — สถานะ: null = กำลังโหลด, [] = ดึงไม่ได้/ไม่มีรอบว่าง
 */
export default function Schedule() {
  const [classes, setClasses] = useState(null)

  useEffect(() => {
    let alive = true
    fetchUpcoming().then((all) => {
      if (alive) setClasses(all ?? [])
    })
    return () => { alive = false }
  }, [])

  const onBook = (c) => {
    fbqTrack('track', 'Lead', { content_name: 'cpr_aed_inperson_course', source: 'schedule', channel: 'booking' })
    phCapture('booking_click', { source: 'schedule', course_key: c.course_key, class_id: c.class_id, utm_source: UTM_SOURCE })
  }

  // จัดกลุ่มรอบที่ยังมีที่ว่างตามเดือน (API เรียงวันใกล้สุดก่อนอยู่แล้ว)
  const open = (classes ?? []).filter((c) => c.seats_left > 0)
  const byMonth = open.reduce((acc, c) => {
    const ym = String(c.date).slice(0, 7)
    ;(acc[ym] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="page-container">
      <Seo
        title="ตารางสอน — รอบอบรม CPR & AED ภาคปฏิบัติ | Jia Training Center"
        description="ตารางรอบอบรมปฐมพยาบาล CPR & AED ภาคปฏิบัติทุกคอร์ส เช็ควันเวลา ที่นั่งว่าง และจองพร้อมจ่ายออนไลน์ได้เลย"
        path="/schedule"
      />
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="text-caption">อบรมภาคปฏิบัติกับครูผู้สอน</div>
        <div className="text-display">ตารางสอน</div>
        <div className="text-body text-text-muted" style={{ marginTop: 4 }}>
          รอบอบรมที่เปิดรับทั้งหมด — เลือกวันที่สะดวกแล้วจองพร้อมจ่ายออนไลน์ได้เลย
        </div>
      </div>

      {classes === null ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div className="text-caption">กำลังโหลดตารางรอบอบรม…</div>
        </div>
      ) : open.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <CalendarDays size={28} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
            <div className="text-body-strong">ตอนนี้ยังไม่มีรอบที่เปิดจอง</div>
            <div className="text-caption" style={{ marginTop: 4 }}>
              ฝากข้อมูลไว้ได้เลย — เปิดรอบใหม่เมื่อไหร่ทีมงานจะติดต่อกลับ
            </div>
          </div>
          <PracticalInterestForm source="schedule" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {Object.entries(byMonth).map(([ym, list]) => (
            <section key={ym}>
              <div className="text-headline" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CalendarDays size={16} style={{ color: 'var(--color-text-muted)' }} />
                {thMonthLabel(ym)}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {list.map((c) => (
                  <a
                    key={c.class_id}
                    href={bookingUrl(c.course_key, c.class_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onBook(c)}
                    className="card card-hover"
                    style={{ display: 'block', textDecoration: 'none' }}
                  >
                    <div className="text-body-strong">{c.course_name || c.course_key}</div>
                    <div className="text-caption" style={{ marginTop: 4 }}>
                      {thWeekday(c.date)} <b>{thShortDate(c.date)}</b> · {c.time_slot} น.
                    </div>
                    {c.place ? (
                      <div className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} /> {c.place}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                      <span className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#23736A' }}>
                        <Users size={13} /> เหลือ {c.seats_left} ที่
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 13, fontWeight: 800, color: '#1B5D54',
                      }}>
                        จอง ({Number(c.price).toLocaleString()} ฿) <ArrowRight size={13} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))}

          <div className="card" style={{ padding: 16 }}>
            <div className="text-body-strong" style={{ marginBottom: 4 }}>ไม่มีวันที่สะดวก หรืออยากจัดอบรมให้ทีม/องค์กร?</div>
            <div className="text-caption" style={{ marginBottom: 10 }}>
              ฝากข้อมูลไว้ได้เลย ทีมงานจะติดต่อกลับเพื่อนัดรอบที่เหมาะกับคุณ
            </div>
            <PracticalInterestForm source="schedule" />
          </div>
        </div>
      )}

      <CallEmergencyButton />
    </div>
  )
}
