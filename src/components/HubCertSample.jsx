import { ArrowRight, Award } from 'lucide-react'
import { HUB_URL, HUB_COURSE_ID } from '../utils/hubCertificate'
import { phCapture } from '../lib/posthog'

// ตัวอย่างใบประกาศที่ได้เมื่อลงทะเบียนผ่าน JIA Hub (class.jiacpr.com) — รูปตัวอย่าง (ลายน้ำ ไม่มีลายเซ็น)
// โฮสต์อยู่ที่ Hub เอง (hotlink ไม่ copy เข้า repo นี้) เพื่อให้ทุกเว็บคอร์สใช้ภาพชุดเดียวกัน
const HUB_COURSE_URL = `${HUB_URL}/courses/${HUB_COURSE_ID}`
const SAMPLES = [
  { src: `${HUB_URL}/images/certificates/firstaid-theory.jpg`, caption: 'ภาคทฤษฎี · ออนไลน์', alt: 'ตัวอย่างใบประกาศภาคทฤษฎี (ออนไลน์) หลักสูตรปฐมพยาบาล จาก JIA Hub' },
  { src: `${HUB_URL}/images/certificates/firstaid-practical.jpg`, caption: 'ภาคปฏิบัติ · ครบหลักสูตร', alt: 'ตัวอย่างใบประกาศภาคปฏิบัติ (ครบหลักสูตร) หลักสูตรปฐมพยาบาล จาก JIA Hub' },
]

export default function HubCertSample() {
  return (
    <section className="course-section hub-cert-sample" aria-labelledby="hub-cert-sample-title">
      <div className="hub-cert-sample-copy">
        <span className="course-kicker"><Award size={16} /> ใบประกาศจากระบบกลาง JIA</span>
        <h2 id="hub-cert-sample-title">ลงทะเบียนผ่าน JIA Hub รับใบประกาศแบบนี้</h2>
        <p>
          ลงทะเบียนผ่าน JIA Hub ได้ใบประกาศจากระบบกลาง — <b>ภาคทฤษฎี</b> เมื่อเรียนและสอบผ่านออนไลน์
          และ <b>ภาคปฏิบัติ</b> เมื่อฝึกและผ่านการประเมินจริง ดาวน์โหลดเป็น PDF ได้ และมี QR Code ตรวจสอบได้
        </p>
      </div>
      <div className="hub-cert-sample-grid">
        {SAMPLES.map(({ src, caption, alt }) => (
          <figure key={src}>
            <a href={src} target="_blank" rel="noreferrer" aria-label={`เปิดภาพเต็ม: ${caption}`}>
              <img src={src} alt={alt} width="1191" height="1685" loading="lazy" decoding="async" />
            </a>
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
      <div className="hub-cert-sample-actions">
        <a
          href={HUB_COURSE_URL}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-lg"
          onClick={() => phCapture('hub_register_click', { source: 'landing_cert_sample' })}
        >
          ลงทะเบียนผ่าน JIA Hub <ArrowRight size={20} />
        </a>
        <small>ภาพตัวอย่าง ใบจริงแสดงชื่อ-นามสกุลและเลขที่ใบประกาศของผู้เรียน</small>
      </div>
    </section>
  )
}
