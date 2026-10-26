import { Link } from 'react-router-dom'
import { Users, Calendar, Award, Image, Film, Clapperboard, Ticket, LogOut, GraduationCap, BookOpen } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { OPEN_ADMIN } from '../config/adminAccess'

// จัดเมนูตามงานที่ทำ ไม่ใช่ตามตาราง — "คลาสของฉัน" รวมกลุ่มผู้เรียน + วันอบรมไว้แล้ว
// หน้า Cohorts / Sessions แบบเดิมยังเข้าได้ แต่พับไว้ใน "เครื่องมือขั้นสูง"
const GROUPS = [
  {
    title: 'งานสอน',
    items: [
      { to: '/admin/teach', label: 'คลาสของฉัน', desc: 'สร้างคลาส · ดูความพร้อมนักเรียน · เช็คชื่อวันอบรม · รายงาน LINE', icon: GraduationCap, color: '#0F766E' },
      { to: '/admin/guide', label: 'คู่มือผู้สอน', desc: 'วิธีสร้างคลาส รหัสผู้ช่วย เช็คชื่อ สถานี และรายงาน LINE', icon: BookOpen, color: '#475569' },
    ],
  },
  {
    title: 'เนื้อหาบทเรียน',
    items: [
      { to: '/admin/lesson-videos', label: 'คลิปประจำบท + mini quiz', desc: 'ใส่ YouTube + คำถามท้ายคลิป → ผู้เรียนต้องดูและผ่านก่อนเรียนต่อ', icon: Clapperboard, color: '#EA580C' },
      { to: '/admin/lesson-media', label: 'ใส่รูป/วิดีโอในเนื้อหา', desc: 'บทเรียน / สถานการณ์ / ผัง → แนบสื่อ → แสดงทันที', icon: Film, color: '#DB2777' },
      { to: '/admin/media', label: 'คลังสื่อ (อัปโหลดทั่วไป)', desc: 'อัปรูป/วิดีโอ แล้วได้ URL ไปใช้เอง', icon: Image, color: '#7C3AED' },
    ],
  },
  {
    title: 'ขาย & ใบประกาศ',
    items: [
      { to: '/admin/vouchers', label: 'โค้ดปลดล็อกบทเรียน', desc: 'สร้าง/ดูโค้ดขายเรียนออนไลน์รายหมวด', icon: Ticket, color: '#0891B2' },
      { to: '/admin/certificates', label: 'ใบประกาศ', desc: 'ใบออกอัตโนมัติ — ดูเงื่อนไขการออกใบ (ค้นหา/เพิกถอนยังไม่เปิด)', icon: Award, color: '#D97706' },
    ],
  },
]

const ADVANCED = [
  { to: '/admin/cohorts', label: 'กลุ่มผู้เรียนแบบเดิม', desc: 'กลุ่มที่สร้างก่อนมีระบบคลาส / แก้รายชื่อเป็นจุด ๆ', icon: Users, color: '#16A34A' },
  { to: '/admin/sessions', label: 'วันอบรม & บูธแบบเดิม', desc: 'เปิดรอบเช็คชื่อแยก (เช่น บูธงาน) / แก้ข้อมูลรอบอบรม', icon: Calendar, color: '#2563EB' },
]

const h2 = { margin: '20px 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-secondary, #64748B)' }

function MenuCard({ to, label, desc, icon: Icon, color }) {
  return (
    <Link to={to} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
  )
}

export default function AdminDashboard() {
  const logout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }
  return (
    <div className="page-container">
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">ครูผู้สอน</div>
          <div className="text-title">หน้าควบคุม</div>
        </div>
        {!OPEN_ADMIN && (
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <LogOut size={16} /> ออก
          </button>
        )}
      </div>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 style={h2}>{g.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {g.items.map((item) => <MenuCard key={item.to} {...item} />)}
          </div>
        </section>
      ))}

      <details style={{ marginTop: 20 }}>
        <summary className="text-caption" style={{ cursor: 'pointer' }}>⚙️ เครื่องมือขั้นสูง</summary>
        <div className="text-caption" style={{ margin: '8px 0' }}>
          ปกติไม่ต้องใช้ — "คลาสของฉัน" จัดการให้ครบแล้ว ข้อมูลชุดเดียวกัน
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ADVANCED.map((item) => <MenuCard key={item.to} {...item} />)}
        </div>
      </details>
    </div>
  )
}
