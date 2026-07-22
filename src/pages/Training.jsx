import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, Clock, Users, CheckCircle2, MessageCircle, Phone,
  ClipboardCheck, ChevronRight,
} from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { lineInterestUrl } from '../utils/lineLinks'
import { phCapture } from '../lib/posthog'
import {
  practicalCourse, PRICING, COURSE_FLOW, SCHEDULE, STATIONS, INCLUDED,
} from '../config/practicalCourse'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

const LINE_URL = lineInterestUrl('กดจากหน้าคอร์สอบรมภาคปฏิบัติ')

// ฟอร์มทิ้งชื่อ-เบอร์ให้ทีมงานติดต่อกลับ — ใช้ endpoint course_interest เดิม
function InterestForm() {
  const learner = useLearnerStore((s) => s.learner)
  const [nameVal, setNameVal] = useState(learner?.name || '')
  const [phoneVal, setPhoneVal] = useState(learner?.phone || '')
  const [state, setState] = useState('idle') // idle | sending | done | error

  const submit = async () => {
    if (!nameVal.trim() || !phoneVal.trim()) return
    setState('sending')
    try {
      const resp = await fetch('/api/leads/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal.trim(),
          phone: phoneVal.trim(),
          learnerId: learner?.id || null,
          source: 'training_page',
        }),
      })
      if (!resp.ok) throw new Error('bad status')
      fbqTrack('track', 'Lead')
      phCapture('training_interest_submitted')
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto' }} />
        <div className="text-headline" style={{ marginTop: 10 }}>รับข้อมูลแล้ว!</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          ทีมงานจะติดต่อกลับโดยเร็ว — ระหว่างรอ เริ่มเรียนออนไลน์ฟรีได้เลย
        </div>
        <Link to="/learn" className="btn btn-primary btn-block" style={{ marginTop: 14 }}>
          เริ่มเรียนออนไลน์
        </Link>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="text-headline">ให้ทีมงานติดต่อกลับ</div>
      <label className="label" style={{ marginTop: 10 }}>ชื่อ</label>
      <input className="input" value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="ชื่อ นามสกุล" />
      <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
      <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="tel" placeholder="0812345678" />
      {state === 'error' && (
        <div className="callout callout-danger" style={{ marginTop: 8 }}>ส่งไม่สำเร็จ กรุณาลองใหม่ หรือทัก LINE แทน</div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 12 }}
        disabled={!nameVal.trim() || !phoneVal.trim() || state === 'sending'}
        onClick={submit}
      >
        <Phone size={18} /> {state === 'sending' ? 'กำลังส่ง…' : 'ขอให้โทรกลับ'}
      </button>
    </div>
  )
}

export default function Training() {
  useEnsureLearner()

  return (
    <div className="page-container">
      {/* Hero */}
      <div style={{ marginTop: 16 }}>
        <div className="text-caption">อบรมกับครูตัวจริง</div>
        <div className="text-display">{practicalCourse.title}</div>
        <div className="text-body text-text-muted" style={{ marginTop: 4 }}>
          {practicalCourse.subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { icon: Clock, label: `${practicalCourse.durationHours} ชั่วโมง` },
          { icon: Users, label: practicalCourse.groupSize },
          { icon: ClipboardCheck, label: 'ฝึกจริงกว่า 2.5 ชม.' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
            <Icon size={16} color="#16A34A" />
            <span className="text-caption">{label}</span>
          </div>
        ))}
      </div>

      {/* ขั้นตอนเรียน: pre-course → pre-test → อบรม → post-test */}
      <div className="text-title" style={{ marginTop: 24 }}>เรียนยังไง?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {COURSE_FLOW.map((f) => (
          <div key={f.step} className="card" style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              background: '#16A34A15', color: '#16A34A',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>
              {f.step}
            </div>
            <div style={{ flex: 1 }}>
              <div className="text-body-strong">{f.title}</div>
              <div className="text-caption" style={{ marginTop: 2 }}>{f.desc}</div>
              {f.link && (
                <Link to={f.link} className="text-caption" style={{ color: 'var(--color-brand)', display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 4 }}>
                  {f.linkLabel} <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ตารางอบรม */}
      <div className="text-title" style={{ marginTop: 24 }}>ตารางอบรม (รอบเช้า)</div>
      <div className="card" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
        {SCHEDULE.map((row, i) => (
          <div
            key={row.time}
            style={{
              display: 'flex', gap: 12, padding: '10px 14px',
              background: row.highlight ? '#16A34A0D' : undefined,
              borderTop: i > 0 ? '1px solid var(--color-border, #E5E7EB)' : undefined,
            }}
          >
            <div className="text-caption" style={{ width: 88, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {row.time}
            </div>
            <div className="text-caption" style={{ flex: 1, fontWeight: row.highlight ? 700 : undefined }}>
              {row.activity}
            </div>
          </div>
        ))}
      </div>
      <div className="text-caption text-text-muted" style={{ marginTop: 6 }}>
        รอบบ่ายใช้ 13:00–17:00 กิจกรรมเดียวกัน · หลักสูตรนี้ไม่รวม CPR/AED ซึ่งเป็นคอร์สแยก
      </div>

      {/* ฐานฝึก */}
      <div className="text-title" style={{ marginTop: 24 }}>ฝึกจริง 4 ฐาน</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {STATIONS.map((s, i) => (
          <div key={s.name} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: '#DC262615', color: '#DC2626',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
            }}>
              {i + 1}
            </div>
            <div>
              <div className="text-body-strong">{s.name}</div>
              <div className="text-caption" style={{ marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* สิ่งที่ได้รับ */}
      <div className="text-title" style={{ marginTop: 24 }}>สิ่งที่ได้รับ</div>
      <div className="card" style={{ marginTop: 10 }}>
        {INCLUDED.map((item) => (
          <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0' }}>
            <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="text-caption">{item}</span>
          </div>
        ))}
      </div>

      {/* ราคา */}
      <div className="text-title" style={{ marginTop: 24 }}>ค่าอบรม</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {PRICING.map((p) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div className="text-body-strong">{p.name}</div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className="text-title" style={{ color: '#16A34A' }}>
                  ฿{p.price.toLocaleString()}
                </span>
                <span className="text-caption text-text-muted"> {p.unit}</span>
              </div>
            </div>
            {p.earlyBird && (
              <div className="text-caption" style={{ color: '#D97706', marginTop: 2 }}>
                🐤 Early bird ฿{p.earlyBird.toLocaleString()} — {p.note}
              </div>
            )}
            {!p.earlyBird && p.note && (
              <div className="text-caption text-text-muted" style={{ marginTop: 2 }}>{p.note}</div>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-title" style={{ marginTop: 24 }}>จองรอบ / สอบถาม</div>
      <a
        href={LINE_URL}
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 10, background: '#06C755', borderColor: '#06C755' }}
        onClick={() => {
          fbqTrack('track', 'Contact')
          phCapture('training_line_clicked')
        }}
      >
        <MessageCircle size={18} /> ทัก LINE @jiacpr จองรอบอบรม
      </a>
      <div className="text-caption text-text-muted" style={{ textAlign: 'center', margin: '10px 0' }}>
        หรือ
      </div>
      <InterestForm />

      <div className="callout callout-info" style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <GraduationCap size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          ยังไม่พร้อมอบรม? เริ่มจาก<Link to="/learn" style={{ color: 'var(--color-brand)' }}>เรียนออนไลน์ฟรี</Link>ก่อนได้
          — เนื้อหาเดียวกับที่ใช้อบรมจริง แล้วค่อยมาฝึกมือกับเราทีหลัง
        </span>
      </div>
    </div>
  )
}
