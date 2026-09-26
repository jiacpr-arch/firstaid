import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { scenariosById } from '../courses/firstaid/scenarios'
import ScenarioRunner from '../components/ScenarioRunner'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { saveSimulationRun } from '../db/database'
import { flushSync } from '../db/sync'
import { fetchContentMedia } from '../utils/lessonMediaSteps'
import { track } from '../utils/analytics'
import Seo from '../components/Seo'
import { breadcrumbJsonLd } from '../lib/seo'

export default function SimulationRun() {
  useEnsureLearner()
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const scenario = scenariosById[scenarioId]
  const learner = useLearnerStore((s) => s.learner)
  const markScenarioPassed = useProgressStore((s) => s.markScenarioPassed)
  const [result, setResult] = useState(null)
  const [media, setMedia] = useState([])

  // โหลดสื่อที่แอดมินผูกไว้กับสถานการณ์นี้
  useEffect(() => {
    let cancelled = false
    fetchContentMedia('scenario', scenarioId).then((rows) => { if (!cancelled) setMedia(rows) })
    return () => { cancelled = true }
  }, [scenarioId])

  const seo = scenario && (
    <Seo
      title={`${scenario.title} — สถานการณ์จำลองปฐมพยาบาล | Jia Training Center`}
      description={`${scenario.summary} — ฝึกตัดสินใจกับสถานการณ์จำลอง ใช้เวลา ${scenario.minutes} นาที ฟรี โดย Jia Training Center`}
      path={`/simulation/${scenario.id}`}
      jsonLd={breadcrumbJsonLd([
        { name: 'หน้าแรก', path: '/' },
        { name: 'สถานการณ์จำลอง', path: '/simulation' },
        { name: scenario.title, path: `/simulation/${scenario.id}` },
      ])}
    />
  )

  if (!scenario) {
    return (
      <div className="page-container">
        <Seo title="ไม่พบฉากจำลอง — FirstAid by Jia Training Center" noindex path="/simulation" />
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
      flushSync(learner.id)
    }
    // ผ่านฉากนี้แล้ว → อัปเดต store ทันที เพื่อให้เกณฑ์ปลดล็อก Post-test นับต่อได้เลย
    if (passed) markScenarioPassed(scenarioId)
    track('simulation_complete', { scenarioId, score, total, passed })
    setResult({ score, total, passed })
  }

  if (result) {
    return (
      <div className="page-container">
        {seo}
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color={result.passed ? '#347053' : '#946A25'} style={{ margin: '0 auto' }} />
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
      {seo}
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
