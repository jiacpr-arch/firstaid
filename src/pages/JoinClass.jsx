import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Users, CheckCircle2, HeartPulse, BookOpen } from 'lucide-react'
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
              : body.error === 'phone_required' ? 'คลาสนี้ต้องกรอกเบอร์โทร (ใช้เบอร์เดียวกันตอนเรียน CPR ออนไลน์)'
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

  if (joined?.cprPromoCode) {
    // คลาสรวม CPR + ปฐมพยาบาล: เรียนออนไลน์ 2 เว็บก่อนวันเรียนจริง — CPR ใช้โค้ดคลาส
    // (?promo= เปิดหน้ากรอกโค้ดของ cpr.morroo.com ให้เลย) ด้วยชื่อ+เบอร์เดียวกับที่เข้าคลาสนี้
    // เพราะครูจับคู่ความคืบหน้า CPR กับคลาสด้วยเบอร์โทร
    const cprUrl = `https://cpr.morroo.com/?promo=${encodeURIComponent(joined.cprPromoCode)}`
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <CheckCircle2 size={44} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 10 }}>เข้าร่วมคลาสแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {joined.cohortName} — ก่อนวันเรียนจริง เรียนออนไลน์ให้ครบ 2 ขั้น
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong"><BookOpen size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />ขั้นที่ 1: ปฐมพยาบาล (เว็บนี้)</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ทำ pre-test → เรียนทุกบท → post-test ผ่าน 80% (ล็อกอิน LINE เพื่อเปิดบทที่ 2 เป็นต้นไป — คนในคลาสเรียนฟรีทุกบท)
          </div>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
            เริ่มเรียนปฐมพยาบาล
          </button>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong"><HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />ขั้นที่ 2: CPR & AED (cpr.morroo.com)</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ใช้โค้ดคลาส <b>{joined.cprPromoCode}</b> เรียนฟรีทุกบท — กรอก<b>ชื่อและเบอร์เดียวกัน</b>กับที่ใช้เข้าคลาสนี้ ครูจึงจะเห็นความคืบหน้า
          </div>
          <a href={cprUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}>
            ไปเรียน CPR
          </a>
        </div>
      </div>
    )
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
