import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, QrCode, Users, ShieldCheck } from 'lucide-react'
import { READINESS } from '../../api/_lib/readiness.js'

// คู่มือระบบผู้สอนสำหรับ admin (/admin/guide) — เนื้อหาตรงกับ /admin/teach และ /scan/:id
// เขียนให้ครูอ่านเข้าใจ: เรียงตามลำดับเวลา (ก่อนวันอบรม → วันอบรม → หลังอบรม) เรื่องตั้งค่าระบบแยกไว้ท้ายสุด

const h2 = { fontSize: 18, fontWeight: 700, margin: '28px 0 8px' }
const list = { margin: '6px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }
const badgeClass = (tone) => (tone === 'success' ? 'badge badge-success' : tone === 'warning' ? 'badge badge-warning' : 'badge')

function Step({ n, title, when }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '32px 0 8px' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 16, background: 'var(--color-brand)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0,
      }}>{n}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
        <div className="text-caption">{when}</div>
      </div>
    </div>
  )
}

function CodeCard({ icon: Icon, color, title, who, children }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: `${color}15`, color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon size={20} /></div>
      <div style={{ flex: 1 }}>
        <div className="text-body-strong">{title}</div>
        <div className="text-caption" style={{ color }}>{who}</div>
        <div className="text-body" style={{ marginTop: 4 }}>{children}</div>
      </div>
    </div>
  )
}

function Faq({ q, children }) {
  return (
    <details className="card" style={{ padding: '12px 14px' }}>
      <summary className="text-body-strong" style={{ cursor: 'pointer' }}>{q}</summary>
      <div className="text-body" style={{ marginTop: 8 }}>{children}</div>
    </details>
  )
}

export default function AdminTeachGuide() {
  return (
    <div className="page-container">
      <Link to="/admin" className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div className="text-title" style={{ marginTop: 4 }}>คู่มือผู้สอน</div>
      <p className="text-caption" style={{ marginTop: 4 }}>
        ใช้เมนู <b>สำหรับผู้สอน</b> เมนูเดียวพอ — ตั้งแต่เปิดคลาส จนจบวันอบรม
      </p>

      <div className="card" style={{ marginTop: 12, background: 'var(--color-brand-soft, #ECFDF5)' }}>
        <div className="text-body-strong">สรุปใน 3 ขั้น</div>
        <ol style={{ ...list, listStyle: 'decimal' }}>
          <li><b>ก่อนวันอบรม</b> — สร้างคลาส แจกรหัสคลาสให้นักเรียนไปเรียนออนไลน์ในมือถือ แล้วคอยดูว่าใคร “พร้อม”</li>
          <li><b>วันอบรม</b> — สแกน QR ของนักเรียนเพื่อเช็คชื่อ ให้คะแนนตามสถานี ใบเซอร์ออกให้เอง</li>
          <li><b>หลังอบรม</b> — ส่งสรุปเข้า LINE แล้วกดปิดคลาส</li>
        </ol>
        <Link to="/admin/teach" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>เริ่มเลย → ไปหน้าสำหรับผู้สอน</Link>
      </div>

      <h2 style={h2}>รหัสและ QR มี 3 อย่าง อย่าสับสน</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CodeCard icon={Users} color="#0F766E" title="รหัสคลาส (6 ตัว) + QR เข้าคลาส" who="แจกให้นักเรียน — แจกในกลุ่ม LINE ได้">
          นักเรียนใช้ <b>ครั้งเดียว</b> ตอนเข้าร่วมคลาส จากนั้นเรียนออนไลน์ได้เลย ระบบจะรู้ว่าเป็นนักเรียนของคลาสเรา
        </CodeCard>
        <CodeCard icon={KeyRound} color="#B45309" title="รหัสผู้ช่วย (8 ตัว)" who="ให้เฉพาะคนที่มาช่วยครูสแกน — ห้ามให้นักเรียน">
          เหมือนรหัสผ่านชั่วคราว ผู้ช่วยเปิดลิงก์ผู้ช่วย ใส่รหัสนี้ แล้วช่วยเช็คชื่อและให้คะแนนสถานีได้โดยไม่ต้องมีบัญชีแอดมิน
        </CodeCard>
        <CodeCard icon={QrCode} color="#2563EB" title="QR ประจำตัวนักเรียน" who="นักเรียนเปิดในมือถือตัวเอง แล้วยื่นให้ครูสแกน">
          ใช้ในวันอบรม นักเรียนกดเมนู “QR ของฉัน” (หรือเปิด firstaid.morroo.com/my-qr) ครูหรือผู้ช่วยสแกนเพื่อเช็คชื่อและบันทึกคะแนน
        </CodeCard>
      </div>

      <h2 style={h2}>หน้าผู้สอนมี 4 แท็บ</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {[
              ['คลาส/QR', 'โชว์ QR/รหัสให้นักเรียนเข้าคลาส · ดูรหัสผู้ช่วย · สลับหรือปิดคลาส', 'ตอนเปิดคลาส'],
              ['ภาพรวม', 'ใครพร้อม ใครยังขาดอะไร (แตะชื่อเพื่อดูรายคน)', 'ก่อนวันอบรม'],
              ['ทฤษฎี', 'ตารางคะแนนเรียนออนไลน์ละเอียดรายคน', 'อยากดูละเอียด'],
              ['ปฏิบัติ', 'สแกนเช็คชื่อ · ตั้งสถานี · กระดานผล · ส่งรายงาน LINE', 'วันอบรม'],
            ].map(([tab, what, when], i, arr) => (
              <tr key={tab} style={{ borderBottom: i === arr.length - 1 ? 0 : '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{tab}</td>
                <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{what}</td>
                <td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }} className="text-caption">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption" style={{ marginTop: 6 }}>ตัวเลขในหน้าผู้สอนอัปเดตเองทุก 30 วินาที หรือกดปุ่มรีเฟรชมุมขวาบน</p>

      <Step n={1} title="ก่อนวันอบรม" when="ล่วงหน้า 1–2 สัปดาห์" />
      <ol style={{ ...list, listStyle: 'decimal' }}>
        <li>เข้า <b>หน้าควบคุม → สำหรับผู้สอน</b> แล้วกด <b>สร้างคลาสใหม่</b></li>
        <li>ตั้งชื่อคลาส เช่น “รุ่นที่ 7 / ต.ค. 69” (สถานที่ใส่หรือไม่ใส่ก็ได้)
          <div className="text-caption">ถ้าเป็นคลาสที่สอน CPR ด้วย ให้ติ๊ก “คลาสรวม CPR + ปฐมพยาบาล” ระบบจะสร้างโค้ดเรียน CPR ออนไลน์ให้นักเรียนเอง</div>
        </li>
        <li>ระบบจะโชว์ <b>รหัสคลาส</b> และ <b>รหัสผู้ช่วย</b> — ไม่ต้องรีบจด ดูซ้ำได้ที่แท็บ คลาส/QR</li>
        <li>ส่งรหัสคลาส (หรือปุ่ม “คัดลอกลิงก์”) เข้ากลุ่ม LINE ของนักเรียน หรือฉาย QR ขึ้นจอให้สแกน</li>
        <li>นักเรียนเรียนออนไลน์ในมือถือ — ครูเข้าแท็บ <b>ภาพรวม</b> เพื่อดูว่าใครพร้อมแล้ว</li>
      </ol>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">ป้ายสถานะนักเรียนหมายความว่า</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {[
            ['ready', 'สอบหลังเรียน (Post-test) ผ่านแล้ว ได้ใบเซอร์ภาคทฤษฎี พร้อมมาอบรมปฏิบัติ'],
            ['almost', 'อ่านบทเรียนครบแล้ว เหลือแค่สอบหลังเรียนให้ผ่าน'],
            ['in_progress', 'เริ่มเรียนแล้ว แต่ยังอ่านบทเรียนไม่ครบ'],
            ['not_started', 'เข้าคลาสแล้ว แต่ยังไม่ได้เริ่มเรียนเลย — ควรทักไปเตือน'],
          ].map(([k, desc]) => (
            <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span className={badgeClass(READINESS[k].tone)} style={{ minWidth: 76, textAlign: 'center' }}>{READINESS[k].label}</span>
              <span className="text-body">{desc}</span>
            </div>
          ))}
        </div>
        <div className="text-caption" style={{ marginTop: 8 }}>ใต้ชื่อแต่ละคนจะมีบรรทัด “ขาด: …” บอกว่ายังต้องทำอะไรอีก กดปุ่ม CSV เพื่อโหลดรายชื่อไปเปิดใน Excel ได้</div>
      </div>

      <Step n={2} title="วันอบรมภาคปฏิบัติ" when="ใช้แท็บ “ปฏิบัติ”" />
      <ol style={{ ...list, listStyle: 'decimal' }}>
        <li><b>เช็คสถานีก่อนเริ่ม</b> — ระบบเตรียมสถานีไว้ให้แล้ว 7 สถานี (สถานีฝึก + สถานีสอบ) แก้ไขได้ในหัวข้อ “สถานีฝึก/สอบ”</li>
        <li><b>เช็คชื่อ</b> — ให้นักเรียนเปิด QR ประจำตัว แล้วกด <b>สแกน QR นักเรียน</b>
          <div className="text-caption">ถ้ามือถือนักเรียนมีปัญหา เลื่อนลงไปที่ “เช็คชื่อมือจากรายชื่อคลาส” แล้วกด เช็คชื่อ ข้างชื่อได้เลย</div>
        </li>
        <li><b>ให้คะแนนที่แต่ละสถานี</b> — ในหน้าสแกน เลือกสถานีก่อน แล้วสแกนนักเรียน ติ๊กตามเช็คลิสต์
          <div className="text-caption">สถานีสอบจะเปิดให้ก็ต่อเมื่อนักเรียนผ่านสถานีฝึกครบแล้ว</div>
        </li>
        <li><b>ดูกระดานสถานี</b> — เห็นทั้งห้องว่าใครผ่านสถานีไหนแล้ว ใครยังค้าง</li>
      </ol>
      <div className="callout callout-info" style={{ marginTop: 10 }}>
        <b>ใบเซอร์ภาคปฏิบัติออกให้เองอัตโนมัติ</b> ทันทีที่นักเรียนสอบสถานีผ่าน
        แต่นักเรียนต้องมี <b>ใบเซอร์ภาคทฤษฎีก่อน</b> (คือสถานะ “พร้อม”) ถ้ายังไม่มี ระบบจะรอ แล้วออกให้ทันทีที่นักเรียนสอบหลังเรียนผ่าน
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 6px' }}>มีผู้ช่วยหลายคน? แจกรหัสผู้ช่วย</h3>
      <ol style={{ ...list, listStyle: 'decimal' }}>
        <li>แท็บ <b>คลาส/QR</b> → กล่องสีเหลือง “รหัสผู้ช่วย” → กด <b>คัดลอกลิงก์</b> และ <b>คัดลอกรหัส</b></li>
        <li>ส่งทั้งสองอย่างให้ผู้ช่วยทาง LINE ส่วนตัว (ไม่ใช่กลุ่มนักเรียน)</li>
        <li>ผู้ช่วยเปิดลิงก์ ใส่รหัส แล้วสแกนได้ทันที ไม่ต้องสมัครหรือล็อกอิน</li>
      </ol>
      <div className="callout" style={{ marginTop: 10 }}>
        ผู้ช่วย <b>ทำได้</b>: เช็คชื่อ ให้คะแนนสถานี ดูกระดานผล (เห็นชื่อและเบอร์โทรนักเรียน)<br />
        ผู้ช่วย <b>ทำไม่ได้</b>: ดูคะแนนเรียนออนไลน์ สร้าง/ปิดคลาส<br />
        ถ้ารหัสหลุดไปถึงคนอื่น กด <b>เปลี่ยนรหัส</b> — รหัสเก่าจะใช้ไม่ได้ทันที (แล้วส่งรหัสใหม่ให้ผู้ช่วยตัวจริง)
      </div>

      <Step n={3} title="หลังอบรม" when="จบวัน" />
      <ol style={{ ...list, listStyle: 'decimal' }}>
        <li>ท้ายแท็บ <b>ปฏิบัติ</b> มีการ์ด “รายงานสรุป” บอกว่าผ่านกี่คน ค้างกี่คน — กด <b>ส่งเข้า LINE</b> เพื่อเก็บไว้
          <div className="text-caption">ข้อความเป็นตัวเลขรวม ไม่มีชื่อนักเรียน ส่งเข้า LINE ของแอดมิน</div>
        </li>
        <li>แท็บ <b>คลาส/QR</b> → กด <b>ปิดคลาสนี้</b> (ตัวแดงด้านล่าง)
          <div className="text-caption">ปิดแล้วรหัสผู้ช่วยใช้ไม่ได้อีก แต่ข้อมูลและใบเซอร์ของนักเรียนยังอยู่ครบ</div>
        </li>
      </ol>

      <h2 style={h2}>เมนูอื่นในหน้าควบคุมต้องใช้ไหม?</h2>
      <ul style={list}>
        <li><b>กลุ่มผู้เรียน (Cohorts)</b> — ไม่ต้องใช้ เป็นรายการรวมทุกคลาสแบบเก่า คลาสที่สร้างจากหน้าผู้สอนจะโผล่ในนี้เองด้วย</li>
        <li><b>คลาสภาคปฏิบัติ / บูธ</b> — ใช้เฉพาะงานบูธหรืออีเวนต์ที่ไม่มีคลาสออนไลน์ คลาสปกติไม่ต้องเข้า</li>
      </ul>

      <h2 style={h2}>ปัญหาที่เจอบ่อย</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Faq q="กดเข้าหน้าผู้สอนแล้วเด้งไปหน้าล็อกอิน">
          ต้องล็อกอินด้วยอีเมลที่ได้รับสิทธิ์แอดมินเท่านั้น ถ้าเป็นครูใหม่ ให้ผู้ดูแลระบบเพิ่มอีเมลให้ก่อน (ดูหัวข้อท้ายหน้า)
        </Faq>
        <Faq q="นักเรียนสแกน QR ใน LINE แล้วเข้าไม่ได้ / ข้อมูลหาย">
          ลิงก์จะพยายามเด้งออกไปเปิดใน Chrome/Safari เอง เพราะเบราว์เซอร์ใน LINE เก็บข้อมูลไม่ได้
          ถ้าไม่เด้ง ให้นักเรียนกด “…” มุมขวาบน → เปิดในเบราว์เซอร์
        </Faq>
        <Faq q="ไม่เห็นชื่อนักเรียนในแท็บภาพรวม">
          กดรีเฟรช แล้วถามนักเรียนว่าใส่รหัสคลาสถูกคลาสหรือเปล่า (รหัสของคลาสที่เปิดอยู่แสดงอยู่บนสุดของหน้าผู้สอน)
        </Faq>
        <Faq q="ผู้ช่วยใส่รหัสแล้วเข้าไม่ได้">
          เช็คว่าคลาสยังไม่ถูกปิด และครูไม่ได้กดเปลี่ยนรหัสไปแล้ว ถ้าใส่ผิดหลายครั้งติดกันระบบจะล็อกชั่วคราว รอสักครู่แล้วลองใหม่
        </Faq>
        <Faq q="นักเรียนสอบสถานีผ่านแล้วแต่ไม่ได้ใบเซอร์ภาคปฏิบัติ">
          เพราะนักเรียนยังไม่ผ่านสอบหลังเรียน (ยังไม่มีใบเซอร์ทฤษฎี) ไม่ต้องสแกนซ้ำ —
          ให้นักเรียนไปสอบหลังเรียนให้ผ่าน แล้วระบบจะออกใบภาคปฏิบัติให้ตามมาเอง
        </Faq>
        <Faq q="ทำหน้าผู้สอนหาย / เปลี่ยนเครื่อง">
          เข้า สำหรับผู้สอน → <b>เลือกคลาสที่มีอยู่แล้ว</b> แล้วแตะชื่อคลาส ข้อมูลทั้งหมดอยู่บนเซิร์ฟเวอร์ ไม่หาย
        </Faq>
      </div>

      <details className="card" style={{ marginTop: 28, padding: '12px 14px' }}>
        <summary className="text-body-strong" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} /> สำหรับผู้ดูแลระบบ (ตั้งค่าครั้งเดียว)
        </summary>
        <ul style={list}>
          <li>เพิ่มครูใหม่: ใส่อีเมลของครูใน <code>ADMIN_EMAILS</code> บน Vercel (หรือให้ role admin ใน Supabase)</li>
          <li>ส่งรายงานเข้า LINE ได้ต้องตั้ง <code>LINE_CHANNEL_ACCESS_TOKEN</code> และ <code>LINE_ADMIN_USER_ID</code> บน Vercel — ถ้ากดส่งแล้วขึ้นว่าไม่สำเร็จ ให้ตรวจสองค่านี้</li>
          <li>ลิงก์ <code>/teach</code> แบบเก่าจะพาไป <code>/admin/teach</code> ให้เอง</li>
        </ul>
        <div className="callout" style={{ marginTop: 10 }}>
          <b>เช็คลิสต์สถานียังไม่ผ่านการทบทวนทางการแพทย์</b> — เนื้อหาร่างโดย AI ควรให้ครูผู้เชี่ยวชาญอ่านตรวจก่อนใช้สอบจริง
        </div>
        <p className="text-caption" style={{ marginTop: 8 }}>
          ควรลองเดินระบบครบหนึ่งรอบ (สร้างคลาส → เข้าคลาส → สแกน → ส่ง LINE) ก่อนใช้ในวันอบรมจริง
        </p>
      </details>
    </div>
  )
}
