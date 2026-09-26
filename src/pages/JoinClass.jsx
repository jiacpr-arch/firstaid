import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Users, CheckCircle2 } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'
import { flushSync } from '../db/sync'
import { authHeader } from '../utils/authHeader'
import { isSupabaseConfigured } from '../config/supabaseClient'
import Seo from '../components/Seo'

// เข้าร่วมคลาสด้วยรหัส 6 หลักจากครูผู้สอน (/join หรือ /join/:code จาก QR)
// ต่างจากหน้าเช็คชื่อ (คีออส): ต้อง join บน "เครื่องของตัวเอง" เพราะ enrollment
// ผูกกับ learner.id ของเครื่อง — ความคืบหน้าที่ sync ขึ้นไปถึงจะโชว์บน dashboard ครู
export default function JoinClass() {
  useEnsureLearner()
  const { code: paramCode } = useParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [code, setCode] = useState(paramCode || '')
  const [nameVal, setNameVal] = useState(learner?.name || '')
  const [phoneVal, setPhoneVal] = useState(learner?.phone || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(null)

  const submit = async () => {
    if (!code.trim() || !nameVal.trim() || !learner?.id) return
    setLoading(true)
    setError('')
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
      const resp = await fetch('/api/cohorts/join', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          learnerId: learner.id,
          name: nameVal.trim(),
          phone: phoneVal.trim() || null,
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(
          resp.status === 404 ? 'ไม่พบคลาสนี้ — ตรวจรหัสอีกครั้ง'
            : resp.status === 410 ? 'คลาสนี้ปิดรับแล้ว'
              : body.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        )
        return
      }

      const patch = {
        name: nameVal.trim(),
        phone: phoneVal.trim(),
        cohortCode: body.code,
        cohortName: body.cohortName,
      }
      updateLearner(patch)
      await upsertLearner({ ...learner, ...patch }).catch(() => {})
      // ดันความคืบหน้าที่ค้างในเครื่องขึ้น Supabase ทันที ให้ครูเห็นบน dashboard เลย
      flushSync(learner.id)
      setJoined(body)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (joined) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เข้าร่วมคลาสแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {joined.cohortName} — ครูผู้สอนจะเห็นความคืบหน้าการเรียนของคุณ
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          เริ่มเรียนเลย
        </button>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Seo title="เข้าร่วมคลาสเรียน | Jia Training Center" noindex path="/join" />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ห้องเรียน</div>
        <div className="text-title">เข้าร่วมคลาสด้วยรหัส</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ฟีเจอร์คลาสใช้ไม่ได้ในโหมดออฟไลน์
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">รหัสคลาส 6 หลัก (จากครูผู้สอน)</label>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="เช่น A3F9K2"
          maxLength={6}
          style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
        />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ชื่อ-นามสกุล (ที่จะแสดงให้ครูเห็น)</label>
        <input className="input" value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="ชื่อ นามสกุล" />
        <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
        <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="tel" placeholder="0812345678" />
      </div>

      <div className="callout callout-info" style={{ marginTop: 8 }}>
        <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        กดเข้าร่วมจาก<b>มือถือ/เครื่องของตัวเอง</b>เท่านั้น — ความคืบหน้าการเรียนผูกกับเครื่องนี้
        (ล็อกอิน LINE ใน <Link to="/settings" style={{ color: 'var(--color-brand)' }}>ตั้งค่า</Link> เพื่อย้ายเครื่องได้)
      </div>

      {error && <div className="callout callout-danger" style={{ marginTop: 8 }}>{error}</div>}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 16 }}
        disabled={!code.trim() || !nameVal.trim() || loading || !isSupabaseConfigured}
        onClick={submit}
      >
        <Users size={18} /> {loading ? 'กำลังเข้าร่วม…' : 'เข้าร่วมคลาส'}
      </button>
    </div>
  )
}
