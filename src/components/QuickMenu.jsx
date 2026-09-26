import { Link } from 'react-router-dom'
import { BookOpen, Map, Activity, Award, UserCheck, CalendarDays } from 'lucide-react'
import { lessons } from '../courses/firstaid/lessons'
import { algorithms } from '../courses/firstaid/algorithms'
import { scenarios } from '../courses/firstaid/scenarios'

// เมนูหลักของระบบ (นับจำนวนจากข้อมูลจริง ไม่ hardcode) — กริด 2 คอลัมน์ ไอคอนโทนเดียวกันทั้งชุด
// warm = โทนทราย ใช้กับเรื่องใบประกาศ/คนจริง (ตาม iconbox-warm ของ JIA Learning Hub)
const QUICK = [
  { to: '/learn', label: 'บทเรียน', desc: `${lessons.length} บท บทละ 3–10 นาที`, icon: BookOpen },
  { to: '/algorithms', label: 'ผังช่วยชีวิต', desc: `${algorithms.length} ผัง · เปิดดูตอนเกิดเหตุ`, icon: Map },
  { to: '/simulation', label: 'สถานการณ์จำลอง', desc: `${scenarios.length} เรื่อง · ฝึกตัดสินใจ`, icon: Activity },
  { to: '/schedule', label: 'อบรมภาคปฏิบัติ', desc: 'เช็ครอบ CPR & AED แล้วจองได้เลย', icon: CalendarDays, warm: true },
  { to: '/certificate', label: 'ใบประกาศของฉัน', desc: 'ดู/ดาวน์โหลดใบประกาศ', icon: Award, warm: true },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', desc: 'สแกน QR หรือกรอกรหัสจากครู', icon: UserCheck, warm: true },
]

export default function QuickMenu({ style, className }) {
  return (
    <div
      className={className}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, ...style }}
    >
      {QUICK.map(({ to, label, desc, icon: Icon, warm }) => (
        <Link
          key={to}
          to={to}
          className="card card-hover"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}
        >
          <span style={{
            width: 40, height: 40, borderRadius: 10,
            background: warm ? '#F4EAD3' : '#E7F0E7', color: warm ? '#8A6D2F' : '#2E6D5D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={22} strokeWidth={1.6} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{label}</span>
          <span className="text-caption" style={{ fontSize: 12, lineHeight: 1.5 }}>{desc}</span>
        </Link>
      ))}
    </div>
  )
}
