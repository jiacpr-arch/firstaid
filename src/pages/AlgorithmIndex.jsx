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
      <header style={{ marginTop: 8 }}>
        <div className="text-eyebrow">Emergency · {algorithms.length} ผัง</div>
        <h1 className="text-display" style={{ margin: 0 }}>ผังช่วยชีวิต</h1>
        <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          แตะหัวข้อเพื่อดูขั้นตอนแบบกดตอบทีละข้อ — ใช้ได้ตอนเกิดเหตุจริง
        </div>
      </header>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {algorithms.map((a, i) => (
          <Link
            key={a.id}
            to={`/algorithms/${a.id}`}
            className="card card-hover"
            style={{
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1, color: a.color }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="text-body-strong" style={{ lineHeight: 1.4 }}>{a.title}</div>
            <div className="text-caption">{a.summary}</div>
          </Link>
        ))}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
