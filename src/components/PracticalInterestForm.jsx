import { useState } from 'react'
import { Phone, CheckCircle2, Send } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'

function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* never crash */ }
}

/**
 * Small inline form — lets a learner register interest in the practical CPR/AED class.
 * Submits name + phone to /api/leads/interest and notifies admin via LINE.
 */
export default function PracticalInterestForm({ source = 'unknown' }) {
  const learner = useLearnerStore((s) => s.learner)
  const [name, setName] = useState(learner?.name || '')
  const [phone, setPhone] = useState(learner?.phone || '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) { setError('กรุณากรอกชื่อและเบอร์โทร'); return }
    setError('')
    setLoading(true)
    try {
      const resp = await fetch('/api/leads/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), learnerId: learner?.id, source }),
      })
      if (!resp.ok) throw new Error('server error')
      fbqTrack('track', 'Lead', { content_name: 'cpr_aed_inperson_course', source, channel: 'form' })
      fbqTrack('trackCustom', 'practical_interest', { source })
      setDone(true)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{
        marginTop: 12, padding: '14px 16px', borderRadius: 12,
        background: '#F0FDF4', border: '1px solid #BBF7D0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <CheckCircle2 size={20} color="#16A34A" style={{ flexShrink: 0 }} />
        <div>
          <div className="text-body-strong" style={{ color: '#15803D' }}>รับทราบแล้ว ขอบคุณ!</div>
          <div className="text-caption" style={{ color: '#166534' }}>ทีมงานจะติดต่อกลับที่เบอร์ที่ให้ไว้</div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          style={{ borderRadius: 10, padding: '10px 12px', fontSize: 14 }}
          maxLength={80}
        />
        <div style={{ position: 'relative' }}>
          <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="tel"
            placeholder="เบอร์โทรศัพท์"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            style={{ borderRadius: 10, padding: '10px 12px 10px 34px', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
            maxLength={20}
          />
        </div>
        {error && <div className="text-caption" style={{ color: '#DC2626' }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: 10 }}>
          <Send size={15} /> {loading ? 'กำลังส่ง…' : 'ฝากชื่อสนใจคลาสปฏิบัติ'}
        </button>
      </div>
    </form>
  )
}
