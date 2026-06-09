import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { algorithmsById } from '../courses/firstaid/algorithms'
import AlgorithmFlowchart from '../components/AlgorithmFlowchart'
import CallEmergencyButton from '../components/CallEmergencyButton'

export default function AlgorithmDetail() {
  const { topic } = useParams()
  const algorithm = algorithmsById[topic]

  if (!algorithm) {
    return (
      <div className="page-container">
        <div className="card">ไม่พบ algorithm</div>
        <Link to="/algorithms" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          กลับไปรายการ
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Link to="/algorithms" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> รายการ algorithm
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">{algorithm.summary}</div>
        <div className="text-title" style={{ color: algorithm.color }}>{algorithm.title}</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <AlgorithmFlowchart algorithm={algorithm} />
      </div>
      <CallEmergencyButton />
    </div>
  )
}
