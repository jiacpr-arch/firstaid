import { Link } from 'react-router-dom'
import {
  BookOpen, HeartPulse, Bandage, Skull, Phone, Award, MessageCircle,
  CheckCircle2, ArrowRight, Map, Activity, Gamepad2,
} from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { lessons, chapters } from '../courses/firstaid/lessons'
import { algorithms } from '../courses/firstaid/algorithms'
import { scenarios } from '../courses/firstaid/scenarios'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'
import { phCapture } from '../lib/posthog'

// กดแล้วเปิดแชตพร้อมข้อความ "สนใจเรียน + มาจากหน้า landing" พิมพ์ไว้ให้ ลูกค้าแค่กดส่ง
const LINE_URL = lineInterestUrl('กดจากหน้า landing คนใหม่')

const FIRST_LESSON_PATH = `/learn/${lessons[0].id}`

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

function trackStartClick(position) {
  phCapture('landing_start_click', { position })
  fbqTrack('trackCustom', 'LandingStartLearning', { position })
}

const CHAPTER_ICONS = { BookOpen, HeartPulse, Bandage, Skull }

const TRUST_POINTS = [
  'ฟรี 100% ไม่มีค่าใช้จ่าย',
  'บทสั้น ๆ บทละ 5–10 นาที',
  'เรียนจบ สอบผ่าน ได้ใบเซอร์',
  'เริ่มได้เลย ไม่ต้องสมัครก่อน',
]

const STATS = [
  { value: lessons.length, label: 'บทเรียน', icon: BookOpen, color: '#16A34A' },
  { value: algorithms.length, label: 'ผังช่วยชีวิตฉุกเฉิน', icon: Map, color: '#2563EB' },
  { value: scenarios.length, label: 'สถานการณ์จำลอง', icon: Activity, color: '#7C3AED' },
  { value: 'ฟรี', label: 'ใบประกาศ', icon: Award, color: '#D97706' },
]

const HOW_IT_WORKS = [
  { step: 1, title: 'เรียนบทสั้น ๆ ทีละบท', desc: 'อ่านง่าย มีรูปและวิดีโอ พร้อมคำถามท้ายบทช่วยจำ' },
  { step: 2, title: 'ฝึกกับสถานการณ์จำลอง', desc: 'ลองตัดสินใจกับเหตุการณ์เสมือนจริง ก่อนเจอของจริง' },
  { step: 3, title: 'สอบผ่าน รับใบประกาศทันที', desc: 'ใบประกาศภาคทฤษฎี ดาวน์โหลดได้เลย ไม่มีค่าใช้จ่าย' },
]

function StartButton({ to, label, position, style }) {
  return (
    <Link
      to={to}
      onClick={() => trackStartClick(position)}
      className="btn btn-primary btn-lg btn-block"
      style={{ boxShadow: '0 8px 20px rgba(22, 163, 74, 0.35)', ...style }}
    >
      {label}
      <ArrowRight size={20} />
    </Link>
  )
}

export default function Landing() {
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  useEnsureProgress(learner?.id)

  // เคยเริ่มเรียนไปแล้วแต่ยังไม่พ้น onboarding (ยังไม่แอด/ข้าม LINE) — ชวน "เรียนต่อ" แทน "เริ่มเรียน"
  const hasStarted = readLessonIds.size > 0
  const nextLesson = hasStarted ? (lessons.find((l) => !readLessonIds.has(l.id)) ?? lessons[0]) : lessons[0]
  const ctaLabel = hasStarted ? `เรียนต่อ — บทที่ ${nextLesson.order}` : 'เริ่มเรียนฟรีเลย'
  const ctaTo = hasStarted ? `/learn/${nextLesson.id}` : FIRST_LESSON_PATH

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* ═══ Hero ═══ */}
      <div style={{ background: 'linear-gradient(160deg, #0F1A2E 0%, #14532D 100%)', color: '#fff' }}>
        <div className="page-container" style={{ paddingTop: 40, paddingBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 999, background: 'rgba(255,255,255,0.12)', fontSize: 13, fontWeight: 600,
            marginBottom: 16,
          }}>
            <HeartPulse size={14} color="#4ADE80" />
            คอร์สออนไลน์ฟรี โดย Jia Training Center
          </div>

          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            4 นาที<br />
            <span style={{ color: '#4ADE80' }}>คือเส้นแบ่งชีวิต</span>
          </h1>

          <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', maxWidth: 480 }}>
            หัวใจหยุดเต้นเพียง 4 นาที สมองเริ่มเสียหายถาวร —
            เรียนวิธีปฐมพยาบาลและช่วยชีวิตคนที่คุณรัก ก่อนวันที่ต้องใช้จริง
          </p>

          <div style={{ marginTop: 22, maxWidth: 420 }}>
            <StartButton to={ctaTo} label={ctaLabel} position="hero" />
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, maxWidth: 480 }}>
            {TRUST_POINTS.map((point) => (
              <div key={point} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'rgba(255,255,255,0.9)' }}>
                <CheckCircle2 size={16} color="#4ADE80" style={{ flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
        {/* ═══ เหตุฉุกเฉินตอนนี้ — ต้องเข้าถึงได้เสมอแม้อยู่หน้า landing ═══ */}
        <a
          href="tel:1669"
          className="card"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#FEF2F2', border: '1.5px solid #FCA5A5', marginBottom: 24,
          }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: '#DC2626', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Phone size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-body-strong" style={{ color: '#991B1B' }}>มีเหตุฉุกเฉินตอนนี้? โทร 1669</div>
            <div className="text-caption" style={{ color: '#7F1D1D' }}>กดเพื่อโทรทันที ไม่ต้องเรียนก่อน</div>
          </div>
        </a>

        {/* ═══ ตัวเลขคอร์ส ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 28 }}>
          {STATS.map(({ value, label, icon: Icon, color }) => (
            <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: `${color}15`, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
                <div className="text-caption">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ โหมดเกม — จุดเข้าแบบสนุกสำหรับคนยังไม่พร้อมเรียน (เข้าได้โดยไม่ติด onboarding) ═══ */}
        <Link
          to="/game"
          onClick={() => phCapture('landing_game_click')}
          className="card"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
            background: 'linear-gradient(135deg, #1B2340, #2A1B40)',
            border: '1.5px solid #4A3D7A', textDecoration: 'none',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#DB277725', color: '#F2C14E',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Gamepad2 size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-headline" style={{ color: '#F2C14E' }}>ยังไม่พร้อมเรียน? ลองเล่นเกมก่อน</div>
            <div className="text-caption" style={{ color: '#B8C2E0' }}>
              FIRST AID HERO — เกมตัดสินใจช่วยชีวิต 17 เคส เล่นฟรีไม่ต้องสมัคร
            </div>
          </div>
          <ArrowRight size={18} color="#F2C14E" />
        </Link>

        {/* ═══ จะได้เรียนอะไรบ้าง ═══ */}
        <div className="text-title" style={{ marginBottom: 4 }}>จะได้เรียนอะไรบ้าง</div>
        <div className="text-caption" style={{ marginBottom: 14 }}>
          เนื้อหา {chapters.length} หมวด ครอบคลุมเหตุฉุกเฉินที่เจอบ่อยที่สุดในชีวิตจริง
        </div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {chapters.map((ch) => {
            const Icon = CHAPTER_ICONS[ch.icon] ?? BookOpen
            const count = lessons.filter((l) => l.chapter === ch.id).length
            return (
              <div key={ch.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: `${ch.color}15`, color: ch.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="text-headline">{ch.title}</div>
                  <div className="text-caption">{count} บทเรียน</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ═══ เรียนยังไง 3 ขั้น ═══ */}
        <div className="text-title" style={{ marginBottom: 14 }}>เรียนง่าย ๆ 3 ขั้นตอน</div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} className="card" style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999, background: 'var(--color-brand-soft)',
                color: 'var(--color-brand-dark)', fontWeight: 800, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {step}
              </div>
              <div>
                <div className="text-body-strong">{title}</div>
                <div className="text-caption" style={{ marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ ใบประกาศ — ตัวปิดการขาย ═══ */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(150deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1.5px solid #FCD34D', padding: 20, marginBottom: 28, textAlign: 'center',
          }}
        >
          <img
            src="/cert-logo.png"
            alt="ตราใบประกาศ Jia Training Center"
            style={{ width: 72, height: 72, objectFit: 'contain', margin: '0 auto 10px' }}
          />
          <div className="text-headline" style={{ color: '#92400E' }}>เรียนจบ รับใบประกาศฟรี</div>
          <div className="text-body" style={{ color: '#78350F', marginTop: 6, marginBottom: 14 }}>
            สอบผ่านรับใบประกาศภาคทฤษฎีทันที ดาวน์โหลดเก็บไว้ได้เลย
            ใช้ยื่นประกอบการทำงานหรือเก็บไว้เป็นความภูมิใจ
          </div>
          <StartButton to={ctaTo} label="เริ่มเรียนเพื่อรับใบเซอร์" position="certificate" />
        </div>

        {/* ═══ ความน่าเชื่อถือ ═══ */}
        <div className="text-caption" style={{ textAlign: 'center', marginBottom: 28, lineHeight: 1.7 }}>
          เนื้อหาดัดแปลงจากคู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป โดยหมอเจี่ย
          <br />
          จัดทำโดย Jia Training Center — ศูนย์อบรม CPR & AED
        </div>

        {/* ═══ CTA ปิดท้าย + LINE (ตัวรอง) ═══ */}
        <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 12 }}>
          <div className="text-title">พร้อมเรียนหรือยัง?</div>
          <div className="text-body text-text-muted" style={{ marginTop: 6, marginBottom: 14 }}>
            ใช้เวลาแค่วันละไม่กี่นาที — ความรู้ที่อาจช่วยชีวิตคนตรงหน้าคุณได้จริง
          </div>
          <StartButton to={ctaTo} label={ctaLabel} position="footer" />
        </div>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fbqTrack('track', 'Lead', {
            content_name: 'cpr_aed_inperson_course',
            source: 'landing_line_button',
            channel: 'line',
          })}
          className="card"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: '#F0FDF4', border: '1.5px solid #BBF7D0',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#06C755', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <MessageCircle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-headline">มีคำถาม? แอด LINE {LINE_ID}</div>
            <div className="text-caption">ทีมงานตอบเอง — สนใจอบรมปฏิบัติ CPR & AED ก็ทักได้เลย</div>
          </div>
        </a>
      </div>

      <CallEmergencyButton />
    </div>
  )
}
