import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { UserCheck, ScanLine, CheckCircle2, ChevronRight } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { saveAttendance, upsertLearner } from '../db/database'
import { isSupabaseConfigured } from '../config/supabaseClient'
import Seo from '../components/Seo'

// ถ้ามี sessionCode ใน URL แสดงว่ามาจาก QR → โหมดคีออส (หลายคนใช้อุปกรณ์เดียวกัน)
// ใช้ fresh UUID ต่อคนเพื่อป้องกัน attendance ชนกัน; ไม่ผูกกับ learner.id ของอุปกรณ์
function useKioskMode(paramCode) {
  return !!paramCode
}

export default function CheckIn() {
  useEnsureLearner()
  const { sessionCode: paramCode } = useParams()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const isKiosk = useKioskMode(paramCode)

  const [code, setCode] = useState(paramCode || '')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ถ้าไม่ใช่คีออส ให้ prefill ชื่อ/เบอร์จาก learner store
  const [nameVal, setNameVal] = useState(isKiosk ? '' : (learner?.name || ''))
  const [phoneVal, setPhoneVal] = useState(isKiosk ? '' : (learner?.phone || ''))

  const submit = async () => {
    if (!code.trim() || !nameVal.trim()) return
    setLoading(true)
    setError('')
    try {
      // คีออส: ใช้ UUID ใหม่ต่อคนเพื่อไม่ให้ attendance ทับกัน
      // ส่วนตัว: ใช้ learner.id เดิมเพื่อดูสถานะได้ทีหลัง
      const learnerId = isKiosk ? uuid() : learner.id

      if (isSupabaseConfigured) {
        const resp = await fetch('/api/attendance/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionCode: code.trim().toUpperCase(),
            learnerId,
            learnerName: nameVal.trim(),
            learnerPhone: phoneVal.trim() || null,
          }),
        })
        const body = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          setError(body.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
          setLoading(false)
          return
        }
      } else {
        // Supabase ยังไม่ได้ตั้งค่า — เซฟ local เท่านั้น (graceful degrade)
        await saveAttendance({ learnerId, sessionId: code.trim().toUpperCase(), status: 'pending' })
      }

      // อัปเดต learner store เฉพาะโหมดส่วนตัว (ไม่ใช่คีออส)
      if (!isKiosk) {
        const patch = { name: nameVal.trim(), phone: phoneVal.trim() }
        updateLearner(patch)
        await upsertLearner({ ...learner, ...patch }).catch(() => {})
      }

      setDone(true)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setNameVal('')
    setPhoneVal('')
    setDone(false)
    setError('')
  }

  if (done) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เช็คชื่อสำเร็จ!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {isKiosk
              ? `ลงชื่อ ${nameVal} เรียบร้อยแล้ว`
              : 'รอครูผู้สอนอนุมัติเพื่อรับใบประกาศภาคปฏิบัติ'}
          </div>
        </div>
        {isKiosk ? (
          <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={reset}>
            <ChevronRight size={18} /> คนถัดไป
          </button>
        ) : (
          <Link to="/certificate" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
            ดูสถานะใบประกาศ
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="page-container">
      <Seo title="เช็คชื่อเข้าอบรม | Jia Training Center" noindex path="/checkin" />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">{isKiosk ? 'ลงทะเบียนที่บูธ' : 'เช็คชื่อภาคปฏิบัติ'}</div>
        <div className="text-title">{isKiosk ? 'กรอกชื่อและเบอร์โทร' : 'กรอกรหัส session'}</div>
      </div>

      {!isKiosk && (
        <div className="card" style={{ marginTop: 12 }}>
          <label className="label">รหัส 6 หลัก (ที่ครูแสดงบนจอ)</label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="เช่น A3F9K2"
            maxLength={6}
            style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
          />
          <div className="text-caption" style={{ marginTop: 6, textAlign: 'center' }}>
            หรือ <Link to="/checkin/scan" style={{ color: 'var(--color-brand)' }}>
              <ScanLine size={14} style={{ verticalAlign: 'middle' }} /> สแกน QR
            </Link>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ชื่อ-นามสกุล</label>
        <input className="input" value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="ชื่อ นามสกุล" autoFocus={isKiosk} />
        <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
        <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="tel" placeholder="0812345678" />
      </div>

      {error && (
        <div className="callout callout-danger" style={{ marginTop: 8 }}>{error}</div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 16 }}
        disabled={!code.trim() || !nameVal.trim() || loading}
        onClick={submit}
      >
        <UserCheck size={18} /> {loading ? 'กำลังส่ง…' : 'ส่งเช็คชื่อ'}
      </button>
    </div>
  )
}
