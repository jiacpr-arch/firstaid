import { Link } from 'react-router-dom'
import { scenarios } from '../courses/firstaid/scenarios'
import { chapters } from '../courses/firstaid/lessons'
import CallEmergencyButton from '../components/CallEmergencyButton'
import Seo from '../components/Seo'
import { itemListJsonLd, breadcrumbJsonLd } from '../lib/seo'

// จัดกลุ่มสถานการณ์ตามบท (chapter) เพื่อให้ "ฝึก" เรียงตรงกับ "บทเรียน"
const grouped = chapters.map((c) => ({
  ...c,
  scenarios: scenarios.filter((s) => s.chapter === c.id),
}))
// ฉากที่ไม่ได้ระบุบท (ถ้ามี) เก็บไว้ท้ายสุด
const ungrouped = scenarios.filter((s) => !chapters.some((c) => c.id === s.chapter))

function ScenarioCard({ s }) {
  return (
    <Link
      to={`/simulation/${s.id}`}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: `4px solid ${s.color}` }}
    >
      <div className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {s.title}
        {s.bonus && (
          <span
            className="text-caption"
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            ฉากเสริม
          </span>
        )}
      </div>
      <div className="text-caption">{s.summary}</div>
      <div className="text-caption" style={{ marginTop: 2 }}>{s.minutes} นาที • {s.steps.length} ข้อตัดสินใจ</div>
    </Link>
  )
}

export default function SimulationSelect() {
  return (
    <div className="page-container">
      <Seo
        title={`สถานการณ์จำลองปฐมพยาบาล ${scenarios.length} ฉาก — ฝึกตัดสินใจฟรี | Jia Training Center`}
        description={`ฝึกตัดสินใจช่วยชีวิตกับสถานการณ์จำลอง ${scenarios.length} ฉาก ครอบคลุมทุกบทเรียนปฐมพยาบาล — ลองผิดลองถูกได้ ก่อนเจอเหตุการณ์จริง`}
        path="/simulation"
        jsonLd={[
          itemListJsonLd(scenarios.map((s) => `/simulation/${s.id}`)),
          breadcrumbJsonLd([
            { name: 'หน้าแรก', path: '/' },
            { name: 'สถานการณ์จำลอง', path: '/simulation' },
          ]),
        ]}
      />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ฝึกตัดสินใจกับสถานการณ์จำลอง</div>
        <div className="text-title">เลือกฉาก</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          {scenarios.length} ฉาก ครอบคลุมครบทุกบทเรียน
        </div>
      </div>

      {grouped.map((c) => (
        c.scenarios.length > 0 && (
          <div key={c.id} style={{ marginTop: 20 }}>
            <div className="text-body-strong" style={{ color: c.color, marginBottom: 10 }}>
              บทที่ {c.id} — {c.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.scenarios.map((s) => <ScenarioCard key={s.id} s={s} />)}
            </div>
          </div>
        )
      ))}

      <Link
        to="/game"
        className="card"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 24,
          background: 'linear-gradient(135deg, #1B2340, #2A1B40)',
          border: '1.5px solid #4A3D7A',
        }}
      >
        <div style={{ fontSize: 28 }}>🎮</div>
        <div style={{ flex: 1 }}>
          <div className="text-body-strong" style={{ color: '#F2C14E' }}>โหมดเกม — FIRST AID HERO</div>
          <div className="text-caption" style={{ color: '#B8C2E0' }}>
            ฝึกแบบเกม: จับเวลา เก็บคอมโบ ปลดล็อกเหรียญ (ของแถมสนุกๆ ไม่มีผลต่อใบเซอร์)
          </div>
        </div>
      </Link>

      {ungrouped.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="text-body-strong" style={{ marginBottom: 10 }}>อื่นๆ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ungrouped.map((s) => <ScenarioCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      <CallEmergencyButton />
    </div>
  )
}
