import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { scenariosById } from '../courses/firstaid/scenarios'
import ScenarioRunner from '../components/ScenarioRunner'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { saveSimulationRun } from '../db/database'
import { fetchContentMedia } from '../utils/lessonMediaSteps'

export default function SimulationRun() {
  useEnsureLearner()
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const scenario = scenariosById[scenarioId]
  const learner = useLearnerStore((s) => s.learner)
  const [result, setResult] = useState(null)
  const [media, setMedia] = useState([])

  // โหลดสื่อที่แอดมินผูกไว้กับสถานการณ์นี้
  useEffect(() => {
    let cancelled = false
    fetchContentMedia('scenario', scenarioId).then((rows) => { if (!cancelled) setMedia(rows) })
    return () => { cancelled = true }
  }, [scenarioId])

  if (!scenario) {
    return (
      <div className="page-container">
        <div className="card">ไม่พบฉาก</div>
        <Link to="/simulation" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>กลับ</Link>
      </div>
    )
  }

  const onFinish = async ({ history, score, total }) => {
    const passed = score >= Math.ceil(total * 0.7)
    if (learner?.id) {
      await saveSimulationRun({
        learnerId: learner.id,
        scenarioId,
        score,
        total,
        passed,
        history,
      })
    }
    setResult({ score, total, passed })
  }

  if (result) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color={result.passed ? '#10B981' : '#D97706'} style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>
            ตอบถูก {result.score} / {result.total}
          </div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {result.passed ? 'ผ่านเกณฑ์ 70% — เก่งมาก!' : 'ลองทบทวนแล้วฝึกใหม่ได้'}
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }}
            onClick={() => navigate('/simulation')}>
            เลือกฉากอื่น
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => setResult(null)}>
            ฝึกใหม่
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Link to="/simulation" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> รายการฉาก
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">{scenario.summary}</div>
        <div className="text-title" style={{ color: scenario.color }}>{scenario.title}</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <ScenarioRunner scenario={scenario} onFinish={onFinish} media={media} />
      </div>
    </div>
  )
}
