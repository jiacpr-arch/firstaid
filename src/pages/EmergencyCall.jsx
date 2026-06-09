import { Phone } from 'lucide-react'

const TIPS = [
  { label: 'เกิดอะไร', desc: 'อธิบายเหตุการณ์สั้น ๆ เช่น "รถชน ผู้บาดเจ็บ 2 คน หมดสติ 1 คน"' },
  { label: 'ที่ไหน', desc: 'บอกที่ตั้ง + จุดสังเกต — เลขที่บ้าน ถนน ใกล้ร้านอะไร' },
  { label: 'ใคร — อาการอย่างไร', desc: 'อายุ เพศ จำนวนคน อาการสำคัญ (หายใจ/ไม่หายใจ, มีเลือดออก ฯลฯ)' },
  { label: 'เบอร์โทรกลับ', desc: 'เบอร์ที่เจ้าหน้าที่โทรกลับได้ทันที' },
]

export default function EmergencyCall() {
  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div className="text-caption">เหตุฉุกเฉินทางการแพทย์</div>
        <div className="text-display">โทร 1669</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          สายด่วน สถาบันการแพทย์ฉุกเฉินแห่งชาติ — โทรฟรี 24 ชม.
        </div>
      </div>

      <a href="tel:1669" className="btn btn-danger btn-block btn-lg" style={{ marginTop: 20 }}>
        <Phone size={20} /> โทร 1669 ตอนนี้
      </a>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="text-headline" style={{ marginBottom: 12 }}>ข้อมูลที่ต้องบอก 4 ข้อ</div>
        <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TIPS.map((t) => (
            <li key={t.label}>
              <div className="text-body-strong">{t.label}</div>
              <div className="text-caption">{t.desc}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="callout callout-info" style={{ marginTop: 16 }}>
        <div className="text-body-strong" style={{ marginBottom: 4 }}>ใจเย็น — พูดช้า ๆ ชัด ๆ</div>
        <div className="text-body">
          เจ้าหน้าที่อาจถามคำถามเพิ่มและสอนช่วยเหลือผ่านโทรศัพท์ — อย่าวางสายจนกว่าจะได้รับอนุญาต
        </div>
      </div>
    </div>
  )
}
