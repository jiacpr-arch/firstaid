import { Link } from 'react-router-dom'
import { algorithms } from '../courses/firstaid/algorithms'
import CallEmergencyButton from '../components/CallEmergencyButton'

export default function AlgorithmIndex() {
  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ใช้ในเหตุฉุกเฉิน</div>
        <div className="text-title">Algorithm ปฐมพยาบาล</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          แตะหัวข้อเพื่อดู flowchart แบบกดทีละขั้น
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {algorithms.map((a) => (
          <Link
            key={a.id}
            to={`/algorithms/${a.id}`}
            className="card"
            style={{
              padding: 14,
              borderLeft: `4px solid ${a.color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div className="text-body-strong">{a.title}</div>
            <div className="text-caption">{a.summary}</div>
          </Link>
        ))}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
