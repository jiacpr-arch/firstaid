import { Link } from 'react-router-dom'
import { ArrowLeft, Award, BookOpen, HeartPulse, KeyRound, LogIn, PlayCircle, Users } from 'lucide-react'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE, CPR_CHAPTER } from '../config/pricing'
import Seo from '../components/Seo'

// คู่มือนักเรียน: เรียนหมวด 5 CPR & AED ออนไลน์ใน firstaid (/cpr/guide) — เปิดได้โดยไม่ต้องล็อกอิน
// ส่งลิงก์ให้นักเรียน/ลูกค้าได้เลย (คู่มือผู้สอน /admin/guide ลิงก์มาที่นี่)

const h2 = { fontSize: 18, fontWeight: 700, margin: '24px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }
const list = { margin: '6px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }

function Faq({ q, children }) {
  return (
    <details className="card" style={{ padding: '12px 14px' }}>
      <summary className="text-body-strong" style={{ cursor: 'pointer' }}>{q}</summary>
      <div className="text-body" style={{ marginTop: 8 }}>{children}</div>
    </details>
  )
}

export default function CprGuide() {
  return (
    <div className="page-container">
      <Seo title="วิธีเรียน CPR & AED ออนไลน์ | FirstAid Morroo" path="/cpr/guide"
        description="คู่มือเรียน CPR & AED ออนไลน์ 6 บท + ข้อสอบปลายภาค และรับใบประกาศ CPR ของ JIA บน firstaid.morroo.com" />
      <Link to="/cpr" className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> หน้าคอร์ส CPR
      </Link>
      <div className="text-title" style={{ marginTop: 4 }}>
        <HeartPulse size={22} color="#B91C1C" style={{ verticalAlign: 'middle', marginRight: 6 }} />
        วิธีเรียน CPR & AED ออนไลน์
      </div>
      <p className="text-caption" style={{ marginTop: 4 }}>
        หมวด {CPR_CHAPTER} ของคอร์สออนไลน์ที่ firstaid.morroo.com — วิดีโอสั้น 6 บท + ข้อสอบปลายภาค ผ่านแล้วได้ใบประกาศ CPR & AED ของ JIA (มี QR ตรวจสอบได้)
      </p>

      <div className="card" style={{ marginTop: 12, background: 'var(--color-brand-soft, #ECFDF5)' }}>
        <div className="text-body-strong">สรุปใน 4 ขั้น</div>
        <ol style={{ ...list, listStyle: 'decimal' }}>
          <li><b>เข้าเรียน</b> — คนในคลาสรวม CPR เรียนฟรี / คนทั่วไปปลดล็อกหมวด {CPR_CHAPTER}</li>
          <li><b>เรียน 6 บท</b> — ดูวิดีโอให้จบ แล้วทำแบบทดสอบ 5 ข้อ ให้ได้ 80% ขึ้นไป</li>
          <li><b>สอบปลายภาค</b> — 10 ข้อ ได้ 80% ขึ้นไป (ต้องเข้าสู่ระบบด้วย LINE)</li>
          <li><b>รับใบประกาศ CPR</b> — กดรับในหน้าคอร์สได้ทันที</li>
        </ol>
        <Link to="/cpr" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>ไปหน้าคอร์ส CPR</Link>
      </div>

      <h2 style={h2}><Users size={20} /> 1. เข้าเรียน</h2>
      <div className="card">
        <div className="text-body-strong">นักเรียนคลาสรวม CPR + ปฐมพยาบาล (เรียนฟรี)</div>
        <ol style={{ ...list, listStyle: 'decimal' }}>
          <li>เข้าคลาสด้วย<b>รหัสคลาส</b>ที่ครูให้ พร้อมชื่อจริงและเบอร์โทร (เมนู “เข้าคลาส” หรือสแกน QR ของครู)</li>
          <li>เรียนปฐมพยาบาลให้ครบ แล้วทำ <b>Post-test</b> ให้ผ่านก่อน</li>
          <li>แถบสีแดง <b>“ขั้นสุดท้าย: เรียน CPR & AED”</b> จะขึ้นด้านบนหน้าหลัก — กด <b>ไปเรียน</b></li>
        </ol>
        <div className="text-caption" style={{ marginTop: 6 }}>ไม่ต้องไปเว็บอื่น ไม่ต้องกรอกโค้ด CPR — ครูเห็นความคืบหน้าให้อัตโนมัติ</div>
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="text-body-strong">คนทั่วไป (ซื้อหมวด {CPR_CHAPTER})</div>
        <ol style={{ ...list, listStyle: 'decimal' }}>
          <li>เปิดเมนู <b>เรียน</b> เลื่อนลงไปที่ <b>หมวด {CPR_CHAPTER}: CPR & AED ออนไลน์</b> (หรือเปิด firstaid.morroo.com/cpr)</li>
          <li><b>เข้าสู่ระบบด้วย LINE</b> — สิทธิ์ผูกกับบัญชี LINE เปลี่ยนเครื่องก็เรียนต่อได้</li>
          <li>ซื้อโค้ดหมวด {CPR_CHAPTER} (฿{CHAPTER_PRICES[CPR_CHAPTER]}) หรือทั้งคอร์ส (฿{COURSE_BUNDLE_PRICE} ได้ทุกหมวดรวม CPR) ผ่าน LINE @jiacpr</li>
          <li>กรอกโค้ดในช่อง <b>มีโค้ดแล้ว</b> บนหน้าคอร์ส CPR — บทเรียนเปิดทันที</li>
        </ol>
      </div>

      <h2 style={h2}><PlayCircle size={20} /> 2. เรียน 6 บท</h2>
      <ul style={list}>
        <li>บทที่ 1 CPR ผู้ใหญ่ · 2 CPR ทารก · 3 สำลัก ผู้ใหญ่ · 4 สำลัก ทารก · 5 CPR & AED ผู้ใหญ่ · 6 CPR & AED ทารก/เด็ก</li>
        <li>เปิดทีละบทตามลำดับ — ผ่านบทก่อนจึงเปิดบทถัดไป</li>
        <li><b>ดูวิดีโอให้จบ</b> ปุ่ม “ทำแบบทดสอบ” จึงจะกดได้</li>
        <li>แบบทดสอบท้ายบท <b>5 ข้อ</b> สุ่มจากคลัง ต้องได้ <b>80% ขึ้นไป (ถูก 4 ข้อ)</b></li>
        <li>ไม่ผ่าน → <b>กลับไปดูวิดีโอใหม่</b> แล้วสอบอีกครั้ง (สอบบทเรียนได้ไม่จำกัดครั้ง)</li>
      </ul>

      <h2 style={h2}><LogIn size={20} /> 3. สอบปลายภาค</h2>
      <ul style={list}>
        <li>เปิดเมื่อผ่านครบ 6 บท — <b>10 ข้อ</b> สุ่มจากทุกบท ต้องได้ <b>80% ขึ้นไป (ถูก 8 ข้อ)</b></li>
        <li>ต้อง<b>เข้าสู่ระบบด้วย LINE</b> ก่อนสอบ (เข้าสู่ระบบแล้วจะกลับมาที่หน้าข้อสอบเอง)</li>
        <li>สอบได้ <b>วันละ 5 ครั้ง</b> — ครบแล้วลองใหม่วันถัดไป</li>
      </ul>

      <h2 style={h2}><Award size={20} /> 4. รับใบประกาศ CPR</h2>
      <ol style={{ ...list, listStyle: 'decimal' }}>
        <li>สอบปลายภาคผ่าน → กด <b>รับใบประกาศ CPR & ดูขั้นต่อไป</b> ระบบขอรับใบให้เอง</li>
        <li>ถ้าขึ้นช่องกรอกชื่อ ให้กรอก<b>ชื่อ–นามสกุลจริง</b> (ชื่อนี้จะอยู่บนใบประกาศ) แล้วกด <b>รับใบประกาศ CPR</b></li>
        <li>กด <b>เปิด / พิมพ์ / บันทึก PDF</b> — ใบอยู่ที่ระบบกลาง JIA (class.jiacpr.com) เลือกแนวตั้ง/แนวนอน ใส่รูปได้ และมี QR ให้ HR สแกนตรวจสอบ</li>
      </ol>
      <div className="text-caption" style={{ marginTop: 6 }}>นักเรียนคลาสรวม: ต่อด้วยเมนู <b>QR ของฉัน</b> เพื่อใช้เช็คชื่อในวันอบรมภาคปฏิบัติ</div>

      <h2 style={h2}><BookOpen size={20} /> คำถามที่พบบ่อย</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Faq q="ปุ่มทำแบบทดสอบกดไม่ได้">ดูวิดีโอให้จบก่อน (ถ้าเพิ่งสอบไม่ผ่าน ต้องดูวิดีโอบทนั้นใหม่) — วิดีโอไม่เล่น ลองเปิดในเบราว์เซอร์ Chrome/Safari แทนเบราว์เซอร์ในแอป LINE</Faq>
        <Faq q="บทถัดไปยังล็อกอยู่">ต้องสอบบทก่อนหน้าให้ผ่าน 80% ก่อน — นักเรียนคลาสรวมต้องผ่าน Post-test ปฐมพยาบาลก่อนเริ่ม CPR</Faq>
        <Faq q="เคยเรียนที่ cpr.morroo.com มาแล้ว">นักเรียนคลาสรวมที่ใช้เบอร์เดียวกัน บทที่ผ่านแล้วนับต่อให้ · ใบประกาศ CPR ที่เคยได้ยังอยู่ในบัญชี JIA เดิม</Faq>
        <Faq q="ขึ้นว่าทำข้อสอบปลายภาคครบจำนวนครั้งแล้ว">สอบได้วันละ 5 ครั้ง ทบทวนวิดีโอแล้วกลับมาสอบใหม่พรุ่งนี้</Faq>
        <Faq q="สอบผ่านแล้วแต่ไม่เห็นใบประกาศ">ต้องเข้าสู่ระบบด้วยบัญชี LINE เดียวกับที่สอบ แล้วเปิดหน้าคอร์ส CPR — ถ้ามีช่องกรอกชื่อ ให้กรอกแล้วกดรับใบ · ยังไม่ได้ ติดต่อ LINE @jiacpr</Faq>
        <Faq q="ชื่อบนใบประกาศผิด">ติดต่อ LINE @jiacpr ให้ทีมงานแก้ชื่อที่ระบบกลาง JIA</Faq>
      </div>

      <div className="card" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <KeyRound size={20} />
        <div className="text-caption" style={{ flex: 1 }}>ติดปัญหาหรืออยากซื้อโค้ด ทัก LINE <b>@jiacpr</b></div>
      </div>
    </div>
  )
}
