import { Link } from 'react-router-dom'
import { Users, Calendar, Award, Image, Film, LogOut } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

const QUICK = [
  { to: '/admin/lesson-media', label: 'ใส่รูป/วิดีโอในบทเรียน', desc: 'เลือกบท → แนบสื่อ → แสดงในบทเรียนทันที', icon: Film, color: '#DB2777' },
  { to: '/admin/cohorts', label: 'กลุ่มผู้เรียน (Cohorts)', desc: 'สร้างกลุ่ม / ดูความก้าวหน้า', icon: Users, color: '#16A34A' },
  { to: '/admin/sessions', label: 'คลาสภาคปฏิบัติ', desc: 'เปิด session + เช็คชื่อ + อนุมัติ', icon: Calendar, color: '#2563EB' },
  { to: '/admin/certificates', label: 'ใบประกาศ', desc: 'ค้นหา / ออกใหม่ / เพิกถอน', icon: Award, color: '#D97706' },
  { to: '/admin/media', label: 'คลังสื่อ (อัปโหลดทั่วไป)', desc: 'อัปรูป/วิดีโอ แล้วได้ URL ไปใช้เอง', icon: Image, color: '#7C3AED' },
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
        <button type="button" className="btn btn-ghost" onClick={logout}>
          <LogOut size={16} /> ออก
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {QUICK.map(({ to, label, desc, icon: Icon, color }) => (
          <Link key={to} to={to} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
    </div>
  )
}
