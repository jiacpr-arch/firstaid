import { Link } from 'react-router-dom'
import { Users, Calendar, Award, Image, Film, Clapperboard, Ticket, LogOut, GraduationCap, BookOpen } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { OPEN_ADMIN } from '../config/adminAccess'

// จัดเป็นหมวด: งานสอนอยู่บนสุด (ครูส่วนใหญ่ใช้แค่หมวดนี้) เมนูเก่า/ขั้นสูงอยู่ล่างสุด
const SECTIONS = [
  {
    title: 'สอนคลาส', hint: 'ครูใช้แค่หมวดนี้ก็พอ',
    items: [
      { to: '/admin/teach', label: 'สำหรับผู้สอน', desc: 'เปิดคลาส → แจกรหัสให้นักเรียน → ดูว่าใครพร้อม → วันอบรมสแกนเช็คชื่อ', icon: GraduationCap, color: '#0F766E' },
      { to: '/admin/guide', label: 'คู่มือผู้สอน (อ่านก่อนใช้ครั้งแรก)', desc: 'ทำทีละขั้น ตั้งแต่ก่อนวันอบรมจนปิดคลาส + ปัญหาที่เจอบ่อย', icon: BookOpen, color: '#475569' },
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
    title: 'ขายและใบเซอร์',
    items: [
      { to: '/admin/vouchers', label: 'โค้ดปลดล็อกบทเรียน', desc: 'สร้าง/ดูโค้ดขายเรียนออนไลน์รายหมวด', icon: Ticket, color: '#0891B2' },
      { to: '/admin/certificates', label: 'ใบประกาศ', desc: 'ใบเซอร์ออกอย่างไร (ออกให้อัตโนมัติ)', icon: Award, color: '#D97706' },
    ],
  },
  {
    title: 'เมนูเก่า / ขั้นสูง', hint: 'คลาสปกติไม่ต้องเข้า — ใช้ “สำหรับผู้สอน” แทน',
    items: [
      { to: '/admin/cohorts', label: 'รายการคลาสทั้งหมด (Cohorts)', desc: 'ดูทุกคลาสรวมกัน รวมคลาสที่สร้างจากหน้าผู้สอนและคลาสแบบเก่า', icon: Users, color: '#16A34A' },
      { to: '/admin/sessions', label: 'บูธ / รอบเช็คชื่อแยก', desc: 'ใช้กับงานบูธหรืออีเวนต์ที่ไม่มีคลาสออนไลน์', icon: Calendar, color: '#2563EB' },
    ],
  },
]

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

      {SECTIONS.map((sec) => (
        <section key={sec.title} style={{ marginTop: 18 }}>
          <div className="text-body-strong">{sec.title}</div>
          {sec.hint && <div className="text-caption">{sec.hint}</div>}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sec.items.map(({ to, label, desc, icon: Icon, color }) => (
              <Link key={to} to={to} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: `${color}15`,
                  color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
        </section>
      ))}
    </div>
  )
}
