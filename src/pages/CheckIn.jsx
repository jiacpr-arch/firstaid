import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { UserCheck, ScanLine, CheckCircle2 } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { saveAttendance, upsertLearner } from '../db/database'

export default function CheckIn() {
  useEnsureLearner()
  const { sessionCode: paramCode } = useParams()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [code, setCode] = useState(paramCode || '')
  const [name, setName] = useState(learner?.name || '')
  const [phone, setPhone] = useState(learner?.phone || '')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!code.trim() || !name.trim()) return
    const patch = { name: name.trim(), phone: phone.trim() }
    updateLearner(patch)
    await upsertLearner({ ...learner, ...patch })
    await saveAttendance({
      learnerId: learner.id,
      sessionId: code.trim().toUpperCase(),
      status: 'pending',
    })
    // TODO: POST to /api/attendance/checkin once Supabase is configured
    setDone(true)
  }

  if (done) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เช็คชื่อสำเร็จ</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            รอครูผู้สอนอนุมัติเพื่อรับใบประกาศภาคปฏิบัติ
          </div>
        </div>
        <Link to="/certificate" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          ดูสถานะใบประกาศ
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">เช็คชื่อภาคปฏิบัติ</div>
        <div className="text-title">กรอกรหัส session</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">รหัส 6 หลัก (ที่ครูแสดงบนจอ)</label>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="เช่น A3F9K2"
          maxLength={8}
          style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
        />
        <div className="text-caption" style={{ marginTop: 6, textAlign: 'center' }}>
          หรือ <Link to="/checkin/scan" style={{ color: 'var(--color-brand)' }}>
            <ScanLine size={14} style={{ verticalAlign: 'middle' }} /> สแกน QR
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ชื่อ-นามสกุล</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>

      <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }}
        disabled={!code.trim() || !name.trim()} onClick={submit}>
        <UserCheck size={18} /> ส่งเช็คชื่อ
      </button>
    </div>
  )
}
