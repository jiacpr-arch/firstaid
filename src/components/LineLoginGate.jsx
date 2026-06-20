import { MessageCircle } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { startLineLogin } from '../utils/lineAuth'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

// ด่านสมัคร/ล็อกอินหลังเรียนจบบทแรก — ล็อกอินด้วย LINE เท่านั้น (เปิดไม่ได้/ปิดไม่ได้)
// ระหว่างล็อกอินจะเพิ่มเพื่อน OA @jiacpr อัตโนมัติ (bot_prompt) แล้วสร้างบัญชีจริงผ่าน Supabase Auth
export default function LineLoginGate() {
  const learner = useLearnerStore((s) => s.learner)

  const onLogin = () => {
    fbqTrack('track', 'Lead', {
      content_name: 'cpr_aed_inperson_course',
      source: 'lesson1_line_login',
      channel: 'line',
    })
    startLineLogin(learner?.id)
  }

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
      <div
        className="card"
        style={{ width: '100%', maxWidth: 400, border: '1px solid #BBF7D0' }}
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
          เรียนจบบทแรกแล้ว 🎉
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
      </div>
    </div>
  )
}
