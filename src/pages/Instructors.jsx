import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Check, MessageCircle, Ticket, Users } from 'lucide-react'
import { INSTRUCTOR_OFFER, instructorSeatPrice, isFoundingPriceActive } from '../config/pricing'
import { lineMessageUrl } from '../utils/lineLinks'
import Seo from '../components/Seo'

// หน้าขายสำหรับผู้สอน/องค์กร (/instructors) — เปิดได้โดยไม่ต้องล็อกอิน ใช้เป็นลิงก์ใน LINE/โพสต์
// คลาสของเว็บนี้สร้างโดยแอดมินเท่านั้น จึงไม่มีปุ่มซื้อ: ทุกปุ่มพาไปแชต LINE @jiacpr พร้อมข้อความที่พิมพ์ไว้ให้
// ราคาอยู่ที่ src/config/pricing.js (INSTRUCTOR_OFFER)

const baht = (n) => n.toLocaleString('th-TH')
const lineBtn = { background: '#06C755', color: '#fff', border: 'none', fontWeight: 800 }

const BENEFITS = [
  'นักเรียนเรียนออนไลน์และสอบ Pre-test มาก่อนวันอบรม — วันสอนใช้เวลากับการฝึกได้เต็มที่',
  'เห็นว่าใครเรียนถึงไหน ใครสอบผ่านแล้ว และส่งข้อความเตือนคนที่ยังไม่พร้อมได้',
  'วันอบรมสแกน QR เช็คชื่อและให้คะแนนแต่ละสถานีในมือถือ ผู้ช่วยสอนใช้ได้โดยไม่ต้องมีบัญชี',
]

export default function Instructors() {
  const o = INSTRUCTOR_OFFER
  const founding = isFoundingPriceActive()
  const price = instructorSeatPrice()

  return (
    <div className="page-container" data-testid="instructors-page">
      <Seo title="สำหรับผู้สอนปฐมพยาบาล — เปิดคลาสออนไลน์ให้นักเรียน | FirstAid Morroo" path="/instructors"
        description="ผู้สอนและองค์กรเปิดคลาสปฐมพยาบาลให้นักเรียนเรียนออนไลน์ล่วงหน้า ติดตามผลทั้งคลาส และเช็คชื่อวันอบรมด้วย QR" />
      <Link to="/" className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> หน้าหลัก
      </Link>
      <div className="text-eyebrow" style={{ marginTop: 8 }}>สำหรับผู้สอน</div>
      <h1 className="text-display">ให้นักเรียนพร้อมก่อนวันอบรม</h1>
      <p className="text-caption" style={{ marginTop: 4 }}>
        เปิดคลาสปฐมพยาบาลของคุณบน firstaid.morroo.com นักเรียนสแกน QR เข้าคลาส เรียนออนไลน์ล่วงหน้า แล้วคุณดูผลทั้งคลาสได้ในหน้าเดียว
      </p>

      <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BENEFITS.map((b) => (
          <div key={b} className="text-body" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Check size={16} color="var(--color-brand)" style={{ flexShrink: 0, marginTop: 4 }} /> <span>{b}</span>
          </div>
        ))}
      </div>

      <section className="card" style={{ marginTop: 12, border: '2px solid var(--color-brand)' }}>
        <div className="text-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={14} /> แพ็กเกจรายคลาส</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-brand)' }} data-testid="instructors-seat-price">฿{baht(price)}</span>
          <span className="text-caption">/ ที่นั่ง</span>
          {founding && <s className="text-caption">฿{baht(o.seatPrice)}</s>}
        </div>
        {founding && <div className="text-body-strong">ราคาผู้ใช้รุ่นแรก เมื่อสั่งภายใน {o.foundingEndsLabel}</div>}
        <ul className="text-body" style={{ margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>นักเรียนในคลาสเรียนออนไลน์ได้ครบทุกหมวดโดยไม่ต้องซื้อเอง</li>
          <li>หน้าติดตามผลทั้งคลาส + เช็คชื่อและให้คะแนนวันอบรม</li>
          <li>ขั้นต่ำ {o.minSeats} ที่นั่ง · ชำระครั้งเดียว ไม่ตัดเงินอัตโนมัติ</li>
          <li><b>คลาสแรกทดลองฟรี {o.trialSeats} ที่นั่ง</b></li>
        </ul>
        <a href={lineMessageUrl(`สนใจเปิดคลาสปฐมพยาบาลบน firstaid.morroo.com (ผู้สอน)\nขอทดลองคลาสแรกฟรี ${o.trialSeats} ที่นั่ง`)}
          target="_blank" rel="noopener noreferrer" className="btn btn-block" style={{ ...lineBtn, marginTop: 12 }}
          data-testid="instructors-line-class">
          <MessageCircle size={18} /> ขอเปิดคลาสทาง LINE @jiacpr
        </a>
        <p className="text-caption" style={{ marginTop: 6 }}>ทีม JIA สร้างคลาสให้ แล้วส่งรหัสคลาสและรหัสผู้สอนกลับทาง LINE</p>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="text-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={14} /> สถาบัน / โรงพยาบาล / บริษัท</div>
        <div className="text-title" style={{ marginTop: 4 }}>เริ่มต้น ฿{baht(o.institutionYearlyFrom)} / ปี</div>
        <p className="text-body" style={{ marginTop: 4 }}>
          เหมาจ่ายรายปี เปิดได้หลายคลาสตลอดปี ออกใบเสนอราคาและใบกำกับภาษีได้ ชำระโดยโอนเงิน
        </p>
        <a href={lineMessageUrl('ขอใบเสนอราคาแพ็กเกจสถาบัน (รายปี) — ระบบคลาสปฐมพยาบาล firstaid.morroo.com')}
          target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}
          data-testid="instructors-line-quote">
          <MessageCircle size={18} /> ขอใบเสนอราคาทาง LINE
        </a>
      </section>

      <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/join" className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} /> เป็นนักเรียน? เข้าร่วมคลาสด้วยรหัสจากครู
        </Link>
      </div>
    </div>
  )
}
