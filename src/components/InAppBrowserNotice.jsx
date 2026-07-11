import { useEffect, useState } from 'react'
import { ExternalLink, Copy, X, Check } from 'lucide-react'
import { detectInAppBrowser } from '../utils/inAppBrowser'
import { track } from '../utils/analytics'

// แถบเตือนเมื่อเปิดผ่าน in-app browser ของ FB/IG/LINE — แนะนำเปิดใน Chrome/Safari
// เพื่อให้การเข้าสู่ระบบด้วย LINE ทำงานได้ลื่นขึ้น (กดปิดได้, ขึ้นครั้งเดียวต่อ session)
const APP_LABEL = { facebook: 'Facebook', instagram: 'Instagram', line: 'LINE' }

export default function InAppBrowserNotice() {
  const [source] = useState(detectInAppBrowser)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (source) track('inapp_browser_detected', { source })
  }, [source])

  if (!source || dismissed) return null

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      track('inapp_browser_copy_link', { source })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* คลิปบอร์ดไม่รองรับก็ไม่เป็นไร — ผู้ใช้กดเมนู ⋯ เปิดในเบราว์เซอร์เองได้ */
    }
  }

  return (
    <div
      role="alert"
      style={{
        background: '#FEF3C7',
        borderBottom: '1px solid #FDE68A',
        color: '#92400E',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <ExternalLink size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>เปิดในเบราว์เซอร์จริงเพื่อเข้าสู่ระบบได้ลื่นกว่า</b>
        <div style={{ marginTop: 2 }}>
          คุณกำลังเปิดผ่านแอป {APP_LABEL[source] || source} — กดเมนู ⋯
          แล้วเลือก “เปิดในเบราว์เซอร์” (Chrome/Safari) ไม่งั้นการเข้าสู่ระบบด้วย LINE อาจไม่สำเร็จ
        </div>
        <button
          type="button"
          onClick={copyLink}
          style={{
            marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8, border: '1px solid #D97706',
            background: '#fff', color: '#92400E', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}
        >
          {copied ? <><Check size={14} /> คัดลอกลิงก์แล้ว</> : <><Copy size={14} /> คัดลอกลิงก์</>}
        </button>
      </div>
      <button
        type="button"
        aria-label="ปิด"
        onClick={() => setDismissed(true)}
        style={{ flexShrink: 0, background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', padding: 2 }}
      >
        <X size={18} />
      </button>
    </div>
  )
}
