import { Link } from 'react-router-dom'
import { Gamepad2, ArrowRight } from 'lucide-react'
import { phCapture } from '../lib/posthog'

// การ์ดโปรโมทเกม FIRST AID HERO — ใช้ร่วมกันระหว่าง Landing และ Home
// source = ชื่อ event PostHog บอกว่าคลิกจากหน้าไหน
export default function GamePromoCard({ source, style }) {
  return (
    <Link
      to="/game"
      onClick={() => phCapture(source)}
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
        background: 'linear-gradient(135deg, #1B2340, #2A1B40)',
        border: '1.5px solid #4A3D7A', textDecoration: 'none',
        ...style,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: '#DB277725', color: '#F2C14E',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Gamepad2 size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="text-headline" style={{ color: '#F2C14E' }}>ยังไม่พร้อมเรียน? ลองเล่นเกมก่อน</div>
        <div className="text-caption" style={{ color: '#B8C2E0' }}>
          FIRST AID HERO — เกมตัดสินใจช่วยชีวิต 17 เคส เล่นฟรีไม่ต้องสมัคร
        </div>
      </div>
      <ArrowRight size={18} color="#F2C14E" />
    </Link>
  )
}
