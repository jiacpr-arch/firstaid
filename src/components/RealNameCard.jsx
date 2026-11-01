import { useState } from 'react'
import { IdCard } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'
import { fetchHubState, saveCardName } from '../utils/hubCertificate'
import { authHeader } from '../utils/authHeader'
import { prefillRealName, realNameProblem } from '../../api/_lib/realName.js'
import { track } from '../utils/analytics'

// ขอชื่อ-นามสกุลจริงจากผู้เรียน (ใช้คู่กับ needsRealName ใน api/_lib/realName.js) — ชื่อนี้ไปที่
// ใบประกาศ (บัตรนักเรียน JIA) และรายชื่อในคลาสที่ครูเห็น
export default function RealNameCard({ source = 'lesson', onSaved, style }) {
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const [name, setName] = useState(() => prefillRealName(learner?.name, { lineName: learner?.lineName || '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // ผู้เรียนพิมพ์เองตรงนี้ → ไม่เทียบกับชื่อ LINE (บางคนตั้งชื่อ LINE เป็นชื่อจริงอยู่แล้ว)
  const problem = realNameProblem(name)

  const save = async () => {
    if (problem || busy || !learner?.id) return
    setBusy(true)
    setError('')
    const clean = name.trim().replace(/\s+/g, ' ')
    try {
      const patch = { name: clean, realNameAt: new Date().toISOString() }
      updateLearner(patch)
      await upsertLearner({ ...learner, ...patch })
      track('real_name_saved', { source })

      // บัตรนักเรียน JIA (ใบประกาศจากระบบกลางใช้ชื่อนี้) — ชื่อที่ครูยืนยันแล้วไม่แตะ
      const hub = await fetchHubState()
      if (hub?.signedIn && hub.profile && !hub.profile.nameLocked) {
        await saveCardName(hub.profile, { name: clean, phone: hub.profile.phone || learner.phone || '' }).catch(() => {})
      }
      // รายชื่อในคลาสที่ครูเห็น
      if (learner.cohortCode) {
        const h = await authHeader()
        await fetch('/api/cohorts/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ code: learner.cohortCode, learnerId: learner.id, name: clean, phone: learner.phone || null }),
        }).catch(() => {})
      }
      onSaved?.(clean)
    } catch (err) {
      console.error('save real name failed', err)
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={style} data-testid="real-name-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--color-brand-soft)',
          color: 'var(--color-brand-dark)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IdCard size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="text-body-strong">กรอกชื่อ-นามสกุลจริงก่อนเรียนต่อ</div>
          <div className="text-caption" style={{ marginTop: 2 }}>
            ชื่อนี้จะพิมพ์บนใบประกาศ และแสดงให้ครูผู้สอนเห็น — ใช้ชื่อจริงตามบัตรประชาชน ไม่ใช่ชื่อ LINE
          </div>
        </div>
      </div>
      <label className="label" style={{ marginTop: 12 }}>ชื่อ-นามสกุล</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="เช่น สมชาย ใจดี" autoComplete="name" />
      {name.trim() && problem && (
        <div className="text-caption" style={{ marginTop: 4, color: 'var(--color-danger, #c0392b)' }}>{problem}</div>
      )}
      {error && <div className="text-caption" style={{ marginTop: 4, color: 'var(--color-danger, #c0392b)' }}>{error}</div>}
      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }}
        disabled={!!problem || busy} onClick={save}>
        {busy ? 'กำลังบันทึก…' : 'บันทึกชื่อ'}
      </button>
    </div>
  )
}
