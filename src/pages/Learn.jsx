import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { BookOpen, CheckCircle2, ClipboardCheck, FileText } from 'lucide-react'
import { lessons } from '../courses/firstaid/lessons'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import ProgressBar from '../components/ProgressBar'
import CallEmergencyButton from '../components/CallEmergencyButton'

export default function Learn() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const readSet = useProgressStore((s) => s.readLessonIds)
  const refresh = useProgressStore((s) => s.refresh)

  useEffect(() => {
    if (learner?.id) refresh(learner.id)
  }, [learner?.id, refresh])

  const total = lessons.length
  const done = lessons.filter((l) => readSet.has(l.id)).length

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">หลักสูตร</div>
        <div className="text-title">บทเรียน</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="text-body-strong">ความก้าวหน้า</span>
          <span className="text-caption">{done} / {total} บท</span>
        </div>
        <ProgressBar value={done} max={total} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link to="/pre-test" className="btn btn-secondary" style={{ flex: 1 }}>
            <ClipboardCheck size={16} /> Pre-test
          </Link>
          <Link to="/post-test" className="btn btn-primary" style={{ flex: 1 }}>
            <FileText size={16} /> Post-test
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lessons.map((l) => {
          const isRead = readSet.has(l.id)
          return (
            <Link
              key={l.id}
              to={`/learn/${l.id}`}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: isRead ? '#D1FAE5' : 'var(--color-bg-tertiary)',
                color: isRead ? '#065F46' : 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
              }}>
                {isRead ? <CheckCircle2 size={20} /> : <BookOpen size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-body-strong">{l.order}. {l.title}</div>
                <div className="text-caption">{l.summary} • {l.minutes} นาที</div>
              </div>
              {isRead && <span className="badge badge-success">เรียนแล้ว</span>}
            </Link>
          )
        })}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
