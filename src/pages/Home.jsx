import { Link } from 'react-router-dom'
import { BookOpen, Map, Activity, Phone, Award, UserCheck } from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'

const QUICK = [
  { to: '/learn', label: 'เริ่มเรียน', desc: '10 บทเรียนสั้น ๆ ประมาณ 1 ชั่วโมง', icon: BookOpen, color: '#16A34A' },
  { to: '/algorithms', label: 'เปิดดูตามอาการ', desc: 'Flowchart ฉุกเฉิน 11 หัวข้อ', icon: Map, color: '#2563EB' },
  { to: '/simulation', label: 'ฝึกสถานการณ์', desc: 'ฝึกตัดสินใจกับเหตุการณ์จำลอง', icon: Activity, color: '#7C3AED' },
  { to: '/certificate', label: 'ใบประกาศของฉัน', desc: 'ดู/ดาวน์โหลดใบประกาศภาคทฤษฎีและปฏิบัติ', icon: Award, color: '#D97706' },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', desc: 'สแกน QR หรือกรอกรหัสจากครูผู้สอน', icon: UserCheck, color: '#0EA5E9' },
]

export default function Home() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)

  return (
    <div className="page-container">
      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div className="text-caption">หลักสูตร</div>
        <div className="text-display">ปฐมพยาบาลเบื้องต้น</div>
        <div className="text-body text-text-muted" style={{ marginTop: 4 }}>
          สำหรับประชาชนทั่วไป — เรียนทฤษฎีออนไลน์ ฝึกปฏิบัติกับครูผู้สอน
        </div>
      </div>

      <a
        href="tel:1669"
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#FEF2F2',
          border: '1.5px solid #FCA5A5',
          marginBottom: 16,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: '#DC2626',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Phone size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-headline" style={{ color: '#991B1B' }}>เหตุฉุกเฉิน — โทร 1669</div>
          <div className="text-caption" style={{ color: '#7F1D1D' }}>กดเพื่อโทรทันที</div>
        </div>
      </a>

      <div style={{ display: 'grid', gap: 10 }}>
        {QUICK.map(({ to, label, desc, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="card"
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

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
        {learner?.name ? `กำลังเรียนในชื่อ ${learner.name}` : 'ยังไม่ได้ตั้งชื่อ — แตะ "ใบประกาศของฉัน" เพื่อกรอกชื่อ'}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
