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

// ด่านแอด LINE ก่อนปลดล็อกใบประกาศ — เก็บ lead เข้า LINE OA @jiacpr ให้พนักงาน
// ทักตามต่อ (ชวนมาอบรมภาคปฏิบัติจริง). ผู้เรียนต้องแอดแล้วกดยืนยันเอง (honor system)
export default function LineGateCard({ onConfirm }) {
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
      source: 'cert_line_gate',
      channel: 'line',
    })
  }

  const onConfirmClick = () => {
    fbqTrack('trackCustom', 'CertLineGateConfirmed')
    onConfirm?.()
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 16,
        borderRadius: 14,
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 800, color: '#047857',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        อีกขั้นเดียว
      </div>
      <div className="text-body-strong" style={{ marginTop: 4 }}>
        แอด LINE เพื่อรับใบประกาศ
      </div>
      <div className="text-caption" style={{ marginTop: 4 }}>
        แอด LINE ทางการ {LINE_ID} แล้วพิมพ์ <b>ชื่อ-เบอร์</b> ทักในแชท
        เพื่อยืนยันตัวตนและรับสิทธิ์พิเศษคอร์สอบรมภาคปฏิบัติจริง
      </div>

      <ol style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li className="text-caption">กดปุ่ม “เพิ่มเพื่อน LINE” ด้านล่าง</li>
        <li className="text-caption">พิมพ์ชื่อ-เบอร์ทักในแชท</li>
        <li className="text-caption">กลับมากด “ฉันแอดแล้ว” เพื่อดาวน์โหลด</li>
      </ol>

      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onAddFriend}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginTop: 14, padding: '13px 14px', borderRadius: 12,
          background: '#06C755', color: '#fff', fontWeight: 800, fontSize: 15,
          textDecoration: 'none',
        }}
      >
        <MessageCircle size={18} /> เพิ่มเพื่อน LINE {LINE_ID}
      </a>

      {qr && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
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
        style={{ marginTop: 14 }}
      >
        <Check size={16} /> ฉันแอดแล้ว — รับใบประกาศ
      </button>
    </div>
  )
}
