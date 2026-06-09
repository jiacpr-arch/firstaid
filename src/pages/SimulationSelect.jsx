import { Link } from 'react-router-dom'
import { scenarios } from '../courses/firstaid/scenarios'
import CallEmergencyButton from '../components/CallEmergencyButton'

export default function SimulationSelect() {
  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ฝึกตัดสินใจกับสถานการณ์จำลอง</div>
        <div className="text-title">เลือกฉาก</div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scenarios.map((s) => (
          <Link
            key={s.id}
            to={`/simulation/${s.id}`}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: `4px solid ${s.color}` }}
          >
            <div className="text-body-strong">{s.title}</div>
            <div className="text-caption">{s.summary}</div>
            <div className="text-caption" style={{ marginTop: 2 }}>{s.minutes} นาที • {s.steps.length} ข้อตัดสินใจ</div>
          </Link>
        ))}
      </div>
      <CallEmergencyButton />
    </div>
  )
}
