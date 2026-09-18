import { Link } from 'react-router-dom'
import { BookOpen, Map, Activity, Award, UserCheck, CalendarDays } from 'lucide-react'
import { lessons } from '../courses/firstaid/lessons'
import { algorithms } from '../courses/firstaid/algorithms'
import { scenarios } from '../courses/firstaid/scenarios'

// เมนูหลักของระบบ — ใช้ร่วมกันระหว่าง Home และ Landing (นับจำนวนจากข้อมูลจริง ไม่ hardcode)
const QUICK = [
  { to: '/learn', label: 'เริ่มเรียน', desc: `${lessons.length} บทเรียนสั้น ๆ บทละ 5–10 นาที`, icon: BookOpen, color: '#16A34A' },
  { to: '/algorithms', label: 'เปิดดูตามอาการ', desc: `Flowchart ฉุกเฉิน ${algorithms.length} หัวข้อ`, icon: Map, color: '#2563EB' },
  { to: '/simulation', label: 'ฝึกสถานการณ์', desc: `ฝึกตัดสินใจกับ ${scenarios.length} เหตุการณ์จำลอง`, icon: Activity, color: '#7C3AED' },
  { to: '/schedule', label: 'ตารางสอนภาคปฏิบัติ', desc: 'เช็ครอบอบรม CPR & AED แล้วจองออนไลน์ได้เลย', icon: CalendarDays, color: '#059669' },
  { to: '/certificate', label: 'ใบประกาศของฉัน', desc: 'ดู/ดาวน์โหลดใบประกาศภาคทฤษฎีและปฏิบัติ', icon: Award, color: '#D97706' },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', desc: 'สแกน QR หรือกรอกรหัสจากครูผู้สอน', icon: UserCheck, color: '#0EA5E9' },
]

export default function QuickMenu({ style, className }) {
  return (
    <div className={className} style={{ display: 'grid', gap: 10, ...style }}>
      {QUICK.map(({ to, label, desc, icon: Icon, color }) => (
        <Link
          key={to}
          to={to}
          className="card card-hover"
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: `${color}15`,
            color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-headline">{label}</div>
            <div className="text-caption">{desc}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
