import { useEffect, useState } from 'react'
import { MessageCircle, Check, Phone } from 'lucide-react'
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

// ด่านแอด LINE หน้าทางเข้าแอป — ต้องแอด LINE OA @jiacpr ก่อนถึงจะเริ่มใช้งานได้
// (honor system: ผู้ใช้กด “ฉันแอดแล้ว” เอง ไม่ verify จริง) เก็บ lead เข้า LINE OA
// ให้พนักงานทักตามต่อ. ยกเว้นปุ่มฉุกเฉิน “โทร 1669” ที่ต้องกดได้เสมอแม้ยังไม่แอด
export default function LineEntryGate({ onConfirm }) {
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
      source: 'entry_line_gate',
      channel: 'line',
    })
  }

  const onConfirmClick = () => {
    fbqTrack('trackCustom', 'EntryLineGateConfirmed')
    onConfirm?.()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
        background: '#F0FDF4',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
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

        <div className="text-display" style={{ textAlign: 'center', marginTop: 12 }}>
          แอด LINE ก่อนเริ่มใช้งาน
        </div>
        <div className="text-body text-text-muted" style={{ textAlign: 'center', marginTop: 6 }}>
          แอด LINE ทางการ <b>{LINE_ID}</b> เพื่อเข้าใช้งานเรียนปฐมพยาบาลออนไลน์ฟรี
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
              width={160}
              height={160}
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
          <Check size={16} /> ฉันแอดแล้ว — เข้าใช้งาน
        </button>
      </div>

      {/* ฉุกเฉิน: ต้องกดโทร 1669 ได้เสมอแม้ยังไม่แอด LINE */}
      <a
        href="tel:1669"
        onClick={() => fbqTrack('trackCustom', 'EntryGateEmergencyCall')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', maxWidth: 420, marginTop: 14, padding: '13px',
          borderRadius: 12, background: '#DC2626', color: '#fff',
          fontWeight: 800, fontSize: 15, textDecoration: 'none',
        }}
      >
        <Phone size={18} /> เหตุฉุกเฉิน — โทร 1669
      </a>
    </div>
  )
}
