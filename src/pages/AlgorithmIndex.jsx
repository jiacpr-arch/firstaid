import { Link } from 'react-router-dom'
import { algorithms } from '../courses/firstaid/algorithms'
import CallEmergencyButton from '../components/CallEmergencyButton'
import Seo from '../components/Seo'
import { itemListJsonLd, breadcrumbJsonLd } from '../lib/seo'

export default function AlgorithmIndex() {
  return (
    <div className="page-container">
      <Seo
        title={`ผังช่วยชีวิตฉุกเฉิน ${algorithms.length} เรื่อง — CPR, AED, สำลัก | Jia Training Center`}
        description={`Algorithm ปฐมพยาบาลแบบกดทีละขั้น ${algorithms.length} เรื่อง: CPR, การใช้ AED, สำลัก, เลือดออก, ชัก, จมน้ำ, งูกัด และอื่น ๆ — ใช้ได้จริงในเหตุฉุกเฉิน`}
        path="/algorithms"
        jsonLd={[
          itemListJsonLd(algorithms.map((a) => `/algorithms/${a.id}`)),
          breadcrumbJsonLd([
            { name: 'หน้าแรก', path: '/' },
            { name: 'ผังช่วยชีวิต', path: '/algorithms' },
          ]),
        ]}
      />
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
