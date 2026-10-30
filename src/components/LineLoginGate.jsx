import { useEffect } from 'react'
import { MessageCircle, UserRound } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { startHubLogin } from '../utils/hubAuth'
import { track } from '../utils/analytics'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

// ด่านสมัคร/ล็อกอิน — ต้องล็อกอินทางใดทางหนึ่งจึงเรียนบทที่ 2 ขึ้นไปได้ (LessonReader เป็นคนกั้น)
// LINE เป็นทางหลัก (ผ่านระบบกลาง class.jiacpr.com เหมือนทุกแอป JIA — บัญชีเดียวกัน) สร้างบัญชีจริง
// ผ่าน Supabase Auth ทั้งคู่ — ทางที่สอง (เข้าสู่ระบบด้วยบัญชี JIA กลาง ผ่าน class.jiacpr.com) สำหรับ
// คนไม่มี/ไม่อยากใช้ LINE เท่านั้น จำเป็นเพราะด่านนี้บังคับ ถ้ามีแค่ LINE คนไม่มี LINE จะเรียนต่อไม่ได้เลย
//
// - ป๊อปอัพ (ค่าเริ่มต้น): เด้งตอนเรียนจบบทแรก — onLater ("ไว้ทีหลัง") แค่ปิดป๊อปอัพให้กลับไปใช้
//   ส่วนอื่นของแอป (ผังช่วยชีวิต/ปุ่ม 1669 ที่ป๊อปอัพบังอยู่) แต่บทถัดไปยังเปิดไม่ได้จนกว่าจะล็อกอิน
// - inline: การ์ดในหน้า ใช้ตอนเปิดบทที่ 2 ขึ้นไปโดยยังไม่ล็อกอิน — แถบเมนูล่างยังกดได้
export default function LineLoginGate({ inline = false, title = 'เรียนจบบทแรกแล้ว 🎉', source = 'lesson1', onLater }) {
  const learner = useLearnerStore((s) => s.learner)

  // วัด drop-off ของด่าน: lesson_complete (บท 1) → login_gate_view → student_registered
  useEffect(() => {
    track('login_gate_view', { source })
  }, [source])

  const onLogin = () => {
    fbqTrack('track', 'Lead', {
      content_name: 'cpr_aed_inperson_course',
      source: `${source}_line_login`,
      channel: 'line',
    })
    startHubLogin(learner?.id, undefined, { line: true })
  }

  // ทางเลือกสำรอง (LINE เป็นหลัก) สำหรับคนไม่มี/ไม่อยากใช้ LINE — ด่านนี้บังคับต้องล็อกอินทางใด
  // ทางหนึ่ง จึงต้องมีทางออกให้คนไม่มี LINE เข้าเรียนต่อได้จริง ไม่ใช่แค่ทางเลือกเสริม
  const onHubLogin = () => {
    fbqTrack('track', 'Lead', {
      content_name: 'cpr_aed_inperson_course',
      source: `${source}_hub_login`,
      channel: 'jia_hub',
    })
    startHubLogin(learner?.id)
  }

  const onLaterClick = () => {
    track('login_gate_later', { source })
    onLater()
  }

  const card = (
    <div
      className="card"
      style={{
        width: '100%',
        maxWidth: 400,
        border: '1px solid #C4D8C4',
        ...(inline ? { margin: '16px auto 0' } : { maxHeight: '90vh', overflowY: 'auto' }),
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: '#06C755',
          color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageCircle size={28} />
        </div>
      </div>

      <div className="text-title" style={{ textAlign: 'center', marginTop: 12 }}>
        {title}
      </div>
      <div className="text-body text-text-muted" style={{ textAlign: 'center', marginTop: 6 }}>
        เข้าสู่ระบบด้วย LINE เพื่อเรียนบทต่อไปฟรี บันทึกความก้าวหน้า และรับใบประกาศ
        — ระบบจะเพิ่มเพื่อน LINE <b>@jiacpr</b> ให้อัตโนมัติเพื่อรับสิทธิ์พิเศษคอร์สอบรมจริง
      </div>

      <button
        type="button"
        onClick={onLogin}
        className="btn btn-block"
        style={{
          marginTop: 18, padding: '14px', borderRadius: 12,
          background: '#06C755', color: '#fff', fontWeight: 800, fontSize: 16, border: 'none',
        }}
      >
        <MessageCircle size={20} /> เข้าสู่ระบบด้วย LINE
      </button>

      <div className="text-caption" style={{ marginTop: 10, textAlign: 'center' }}>
        ใช้บัญชี LINE ของคุณเข้าสู่ระบบอย่างปลอดภัย ไม่ต้องตั้งรหัสผ่านใหม่
      </div>

      <button
        type="button"
        onClick={onHubLogin}
        className="btn btn-block"
        style={{
          marginTop: 10, padding: '13px', borderRadius: 12,
          background: '#fff', color: '#111827', fontWeight: 700, fontSize: 14,
          border: '1px solid #D1D5DB',
        }}
      >
        <UserRound size={18} /> ไม่มี LINE? เข้าสู่ระบบด้วยบัญชี JIA
      </button>

      {onLater && (
        <button
          type="button"
          onClick={onLaterClick}
          className="btn btn-ghost btn-block"
          style={{ marginTop: 6, fontSize: 13 }}
        >
          ไว้ทีหลัง
        </button>
      )}
    </div>
  )

  if (inline) return card

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}
    >
      {card}
    </div>
  )
}
