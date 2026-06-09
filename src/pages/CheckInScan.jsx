import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CheckInScan() {
  const containerId = 'qr-scan-region'
  const scannerRef = useRef(null)
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    let html5QrcodeScanner = null
    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        if (!active) return
        const { Html5QrcodeScanner } = mod
        html5QrcodeScanner = new Html5QrcodeScanner(
          containerId,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          false,
        )
        html5QrcodeScanner.render(
          (decodedText) => {
            // Expect URL like https://<host>/checkin/CODE or just CODE
            try {
              const url = new URL(decodedText)
              const parts = url.pathname.split('/').filter(Boolean)
              const code = parts[parts.length - 1]
              navigate(`/checkin/${code}`)
            } catch {
              navigate(`/checkin/${decodedText.trim()}`)
            }
          },
          () => {},
        )
        scannerRef.current = html5QrcodeScanner
      } catch (e) {
        setError(e?.message || 'เปิดกล้องไม่ได้')
      }
    })()
    return () => {
      active = false
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {})
      }
    }
  }, [navigate])

  return (
    <div className="page-container">
      <Link to="/checkin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> กลับ
      </Link>
      <div className="text-title" style={{ marginTop: 4 }}>สแกน QR ภาคปฏิบัติ</div>
      <div className="text-caption">หันกล้องไปที่ QR ที่ครูผู้สอนแสดงบนจอ</div>

      <div id={containerId} style={{ marginTop: 16 }} />

      {error && (
        <div className="callout callout-danger" style={{ marginTop: 12 }}>
          {error} — กรุณากรอกรหัสด้วยตัวเอง
        </div>
      )}
    </div>
  )
}
