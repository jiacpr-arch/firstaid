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
      className="card card-hover"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
        background: '#163D3A', border: '1px solid #163D3A', color: '#F8FBF8',
        textDecoration: 'none',
        ...style,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: '#30544D', color: '#BFDDB3',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Gamepad2 size={22} strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="text-headline">ยังไม่พร้อมเรียน? ลองเล่นเกมก่อน</div>
        <div className="text-caption" style={{ color: '#C9DCD4' }}>
          FIRST AID HERO — เกมตัดสินใจช่วยชีวิต 17 เคส เล่นฟรีไม่ต้องสมัคร
        </div>
      </div>
      <ArrowRight size={18} strokeWidth={1.8} />
    </Link>
  )
}
