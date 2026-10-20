import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, QrCode } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'
import { encodeStudentQr } from '../../api/_lib/qrPayload.js'
import Seo from '../components/Seo'

// QR ประจำตัวนักเรียน — ให้ครูสแกนเพื่อเช็คชื่อภาคปฏิบัติ (ดู /admin/sessions/:id/scan)
export default function MyQr() {
  const learner = useEnsureLearner()
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const [nameVal, setNameVal] = useState('')
  const [phoneVal, setPhoneVal] = useState('')
  const [dataUrl, setDataUrl] = useState(null)

  const ready = !!learner?.id && !!learner?.name?.trim()

  useEffect(() => {
    if (!ready) return
    const text = encodeStudentQr({ id: learner.id, name: learner.name, phone: learner.phone })
    QRCode.toDataURL(text, { width: 560, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => {})
  }, [ready, learner?.id, learner?.name, learner?.phone])

  const save = async () => {
    if (!nameVal.trim()) return
    const patch = { name: nameVal.trim(), phone: phoneVal.trim() }
    updateLearner(patch)
    await upsertLearner({ ...learner, ...patch }).catch(() => {})
  }

  return (
    <div className="page-container">
      <Seo title="QR ของฉัน | Jia Training Center" noindex path="/my-qr" />
      <Link to="/checkin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> กลับ
      </Link>
      <div className="text-title" style={{ marginTop: 4 }}>QR ของฉัน</div>
      <div className="text-caption">ให้ครูสแกนเพื่อเช็คชื่อภาคปฏิบัติ — เพิ่มความสว่างหน้าจอให้สุด</div>

      {!ready ? (
        <div className="card" style={{ marginTop: 12 }}>
          <label className="label">ชื่อ-นามสกุล (ใช้บนใบประกาศ)</label>
          <input className="input" value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="ชื่อ นามสกุล" />
          <label className="label" style={{ marginTop: 10 }}>เบอร์โทร (ไม่บังคับ)</label>
          <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="tel" placeholder="0812345678" />
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!nameVal.trim()} onClick={save}>
            <QrCode size={16} /> สร้าง QR
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12, textAlign: 'center', background: '#fff' }}>
          {dataUrl && <img src={dataUrl} alt="QR ประจำตัว" style={{ width: '100%', maxWidth: 320, margin: '0 auto', display: 'block' }} />}
          <div className="text-body-strong" style={{ marginTop: 8, color: '#111' }}>{learner.name}</div>
          {learner.phone && <div className="text-caption" style={{ color: '#555' }}>{learner.phone}</div>}
        </div>
      )}
    </div>
  )
}
