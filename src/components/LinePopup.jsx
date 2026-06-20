import { useEffect, useState } from 'react'
import { MessageCircle, Check } from 'lucide-react'
import QRCode from 'qrcode'

const LINE_URL = 'https://line.me/R/ti/p/@jiacpr'
const LINE_ID = '@jiacpr'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

// ป๊อบอัพแอด LINE หลังเรียนจบบทแรก — honor system gate: ต้องกดแอด LINE OA @jiacpr
// แล้วกด "ฉันแอดแล้ว" ก่อนถึงจะเรียนต่อ/ใช้งานส่วนอื่นได้ (ปิดเองไม่ได้) เก็บ lead ให้
// พนักงานทักตามต่อชวนมาอบรมภาคปฏิบัติจริง
export default function LinePopup({ onConfirm }) {
  const [qr, setQr] = useState('')
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(LINE_URL, { margin: 1, width: 320 })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch(() => { /* ไม่มี QR ก็ยังกดปุ่มเพิ่มเพื่อนได้ */ })
    return () => { cancelled = true }
  }, [])

  const onAddFriend = () => {
    setOpened(true)
    fbqTrack('track', 'Lead', {
      content_name: 'cpr_aed_inperson_course',
      source: 'lesson1_line_popup',
      channel: 'line',
    })
  }

  const onConfirmClick = () => {
    fbqTrack('trackCustom', 'Lesson1LinePopupConfirmed')
    onConfirm?.()
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
        style={{
          width: '100%',
          maxWidth: 400,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #BBF7D0',
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
          เรียนจบบทแรกแล้ว 🎉
        </div>
        <div className="text-body text-text-muted" style={{ textAlign: 'center', marginTop: 6 }}>
          แอด LINE ทางการ <b>{LINE_ID}</b> เพื่อเรียนบทต่อไปฟรี
          และรับสิทธิ์พิเศษคอร์สอบรมภาคปฏิบัติจริง
        </div>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onAddFriend}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 18, padding: '14px', borderRadius: 12,
            background: '#06C755', color: '#fff', fontWeight: 800, fontSize: 16,
            textDecoration: 'none',
          }}
        >
          <MessageCircle size={20} /> เพิ่มเพื่อน LINE {LINE_ID}
        </a>

        {qr && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <img
              src={qr}
              alt={`QR สำหรับแอด LINE ${LINE_ID}`}
              width={150}
              height={150}
              style={{ borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
            />
            <div className="text-caption">หรือสแกน QR นี้ด้วยมือถืออีกเครื่อง</div>
          </div>
        )}

        <button
          type="button"
          onClick={onConfirmClick}
          className={`btn btn-block ${opened ? 'btn-primary' : 'btn-secondary'}`}
          style={{ marginTop: 18 }}
        >
          <Check size={16} /> ฉันแอดแล้ว — เรียนต่อ
        </button>
      </div>
    </div>
  )
}
