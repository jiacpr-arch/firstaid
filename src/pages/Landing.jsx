import { Link } from 'react-router-dom'
import {
  BookOpen, HeartPulse, Bandage, Skull, Phone, Award, MessageCircle,
  CheckCircle2, ArrowRight, Map, Activity,
} from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import GamePromoCard from '../components/GamePromoCard'
import QuickMenu from '../components/QuickMenu'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { lessons, chapters } from '../courses/firstaid/lessons'
import { algorithms } from '../courses/firstaid/algorithms'
import { scenarios } from '../courses/firstaid/scenarios'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'
import { phCapture } from '../lib/posthog'
import Seo from '../components/Seo'
import { courseJsonLd } from '../lib/seo'

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

function StartButton({ to, label, position, className = '', style }) {
  return (
    <Link
      to={to}
      onClick={() => trackStartClick(position)}
      className={`btn btn-primary btn-lg btn-block ${className}`}
      style={{ boxShadow: '0 8px 20px rgba(22, 163, 74, 0.35)', ...style }}
    >
      {label}
      <ArrowRight size={20} />
    </Link>
  )
}

function SectionHeading({ title, caption }) {
  return (
    <div className="mb-4 lg:mb-6 lg:text-center">
      <h2 className="text-title lg:text-[26px]">{title}</h2>
      {caption && <div className="text-caption mt-1 lg:text-[14px]">{caption}</div>}
    </div>
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

  const trustList = (
    <>
      {TRUST_POINTS.map((point) => (
        <div key={point} className="flex items-center gap-2 text-[13.5px] lg:text-[15px] text-white/90">
          <CheckCircle2 size={16} color="#4ADE80" className="shrink-0" />
          {point}
        </div>
      ))}
    </>
  )

  return (
    <div>
      <Seo path="/" jsonLd={courseJsonLd()} />

      {/* ═══ Top nav เฉพาะจอใหญ่ — มือถือใช้ BottomTabBar เหมือนเดิม (ซ่อนบน lg เฉพาะหน้านี้) ═══ */}
      <header
        className="hidden lg:block sticky top-0 z-30 text-white border-b border-white/10"
        style={{ background: 'rgba(15, 26, 46, 0.92)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 font-bold">
            <img src="/icons/icon-192.png" alt="" className="w-8 h-8 rounded-lg" />
            FirstAid — Jia Training Center
          </Link>
          <nav className="flex items-center gap-7 text-[15px] font-medium text-white/80">
            <Link to="/learn" className="hover:text-white transition-colors">บทเรียน</Link>
            <Link to="/algorithms" className="hover:text-white transition-colors">ผังช่วยชีวิต</Link>
            <Link to="/simulation" className="hover:text-white transition-colors">สถานการณ์จำลอง</Link>
            <Link to="/game" className="hover:text-white transition-colors">เกม</Link>
            <Link
              to={ctaTo}
              onClick={() => trackStartClick('header')}
              className="btn btn-primary"
              style={{ padding: '9px 18px' }}
            >
              เริ่มเรียนฟรี
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="text-white" style={{ background: 'linear-gradient(160deg, #0F1A2E 0%, #14532D 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-9 lg:pt-20 lg:pb-20 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-14 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 text-[13px] font-semibold mb-4">
              <HeartPulse size={14} color="#4ADE80" />
              คอร์สออนไลน์ฟรี โดย Jia Training Center
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight">
              4 นาที<br />
              <span className="text-[#4ADE80]">คือเส้นแบ่งชีวิต</span>
            </h1>

            <p className="mt-4 lg:mt-6 text-base lg:text-lg leading-relaxed text-white/85 max-w-[480px]">
              หัวใจหยุดเต้นเพียง 4 นาที สมองเริ่มเสียหายถาวร —
              เรียนวิธีปฐมพยาบาลและช่วยชีวิตคนที่คุณรัก ก่อนวันที่ต้องใช้จริง
            </p>

            <div className="mt-6 max-w-[420px] lg:max-w-sm">
              <StartButton to={ctaTo} label={ctaLabel} position="hero" />
            </div>

            {/* Trust points บนมือถือ — จอใหญ่ย้ายไปการ์ดขวา */}
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 max-w-[480px] lg:hidden">
              {trustList}
            </div>
          </div>

          {/* การ์ดสรุปฝั่งขวา เฉพาะจอใหญ่ */}
          <div className="hidden lg:block">
            <div className="rounded-2xl border border-white/15 bg-white/8 p-7 backdrop-blur">
              <div className="grid grid-cols-2 gap-5 pb-6 mb-6 border-b border-white/12">
                {STATS.map(({ value, label }) => (
                  <div key={label}>
                    <div className="text-3xl font-extrabold text-[#4ADE80] leading-tight">{value}</div>
                    <div className="text-[13px] text-white/75 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3">{trustList}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container max-w-6xl! pt-5 lg:pt-10 lg:pb-16!">
        {/* ═══ เหตุฉุกเฉินตอนนี้ — ต้องเข้าถึงได้เสมอแม้อยู่หน้า landing ═══ */}
        <a
          href="tel:1669"
          className="card card-hover flex items-center gap-3 mb-6 lg:mb-10 lg:p-5"
          style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5' }}
        >
          <div className="w-[42px] h-[42px] rounded-xl bg-[#DC2626] text-white flex items-center justify-center shrink-0">
            <Phone size={20} />
          </div>
          <div className="flex-1">
            <div className="text-body-strong lg:text-base" style={{ color: '#991B1B' }}>มีเหตุฉุกเฉินตอนนี้? โทร 1669</div>
            <div className="text-caption" style={{ color: '#7F1D1D' }}>กดเพื่อโทรทันที ไม่ต้องเรียนก่อน</div>
          </div>
        </a>

        {/* ═══ โหมดเกม — จุดเข้าแบบสนุก อยู่ตำแหน่งบนให้เห็นทันที (เข้าได้โดยไม่ติด onboarding) ═══ */}
        <GamePromoCard source="landing_game_click" />

        {/* ═══ ตัวเลขคอร์ส (จอใหญ่มีในการ์ด hero แล้ว) ═══ */}
        <div className="grid grid-cols-2 gap-2.5 mb-7 lg:hidden">
          {STATS.map(({ value, label, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-3 p-3.5">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: `${color}15`, color }}
              >
                <Icon size={20} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold leading-tight">{value}</div>
                <div className="text-caption">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ เมนูทั้งระบบ — ผู้ใช้ใหม่ต้องเห็นครบตั้งแต่หน้าแรกว่ามีอะไรให้ใช้บ้าง ═══ */}
        <SectionHeading title="เข้าใช้งานได้เลย" />
        <QuickMenu className="md:grid-cols-2 lg:grid-cols-3 md:gap-4! mb-8 lg:mb-12" />

        {/* ═══ จะได้เรียนอะไรบ้าง ═══ */}
        <SectionHeading
          title="จะได้เรียนอะไรบ้าง"
          caption={`เนื้อหา ${chapters.length} หมวด ครอบคลุมเหตุฉุกเฉินที่เจอบ่อยที่สุดในชีวิตจริง`}
        />
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-4 mb-8 lg:mb-12">
          {chapters.map((ch) => {
            const Icon = CHAPTER_ICONS[ch.icon] ?? BookOpen
            const count = lessons.filter((l) => l.chapter === ch.id).length
            return (
              <div key={ch.id} className="card card-hover flex items-center gap-3.5 lg:p-5">
                <div
                  className="w-11 h-11 lg:w-13 lg:h-13 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${ch.color}15`, color: ch.color }}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="text-headline">{ch.title}</div>
                  <div className="text-caption">{count} บทเรียน</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ═══ เรียนยังไง 3 ขั้น ═══ */}
        <SectionHeading title="เรียนง่าย ๆ 3 ขั้นตอน" />
        <div className="grid gap-2.5 md:grid-cols-3 md:gap-4 mb-8 lg:mb-12">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} className="card card-hover flex gap-3.5 md:block lg:p-5">
              <div
                className="w-8 h-8 lg:w-10 lg:h-10 rounded-full font-extrabold text-[15px] lg:text-[17px] flex items-center justify-center shrink-0 md:mb-3"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}
              >
                {step}
              </div>
              <div>
                <div className="text-body-strong lg:text-base">{title}</div>
                <div className="text-caption mt-0.5 lg:mt-1">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ ใบประกาศ — ตัวปิดการขาย ═══ */}
        <div
          className="card text-center p-5 lg:p-10 mb-8 lg:mb-12"
          style={{
            background: 'linear-gradient(150deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1.5px solid #FCD34D',
          }}
        >
          <img
            src="/cert-logo.png"
            alt="ตราใบประกาศ Jia Training Center"
            className="w-[72px] h-[72px] lg:w-24 lg:h-24 object-contain mx-auto mb-2.5"
          />
          <div className="text-headline lg:text-[22px]" style={{ color: '#92400E' }}>เรียนจบ รับใบประกาศฟรี</div>
          <div className="text-body lg:text-base mt-1.5 mb-3.5 lg:max-w-xl lg:mx-auto" style={{ color: '#78350F' }}>
            สอบผ่านรับใบประกาศภาคทฤษฎีทันที ดาวน์โหลดเก็บไว้ได้เลย
            ใช้ยื่นประกอบการทำงานหรือเก็บไว้เป็นความภูมิใจ
          </div>
          <StartButton
            to={ctaTo}
            label="เริ่มเรียนเพื่อรับใบเซอร์"
            position="certificate"
            className="lg:w-auto! lg:mx-auto"
          />
        </div>

        {/* ═══ ความน่าเชื่อถือ ═══ */}
        <div className="text-caption text-center mb-8 lg:mb-12 leading-7">
          เนื้อหาดัดแปลงจากคู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป โดยหมอเจี่ย
          <br />
          จัดทำโดย Jia Training Center — ศูนย์อบรม CPR & AED
        </div>

        {/* ═══ CTA ปิดท้าย + LINE (ตัวรอง) ═══ */}
        <div className="md:grid md:grid-cols-2 md:gap-4 md:items-stretch">
          <div className="card text-center p-5 lg:p-6 mb-3 md:mb-0 flex flex-col justify-center">
            <div className="text-title">พร้อมเรียนหรือยัง?</div>
            <div className="text-body text-text-muted mt-1.5 mb-3.5">
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
            className="card card-hover flex items-center gap-3.5 lg:p-6"
            style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
          >
            <div className="w-11 h-11 rounded-xl bg-[#06C755] text-white flex items-center justify-center shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="flex-1">
              <div className="text-headline">มีคำถาม? แอด LINE {LINE_ID}</div>
              <div className="text-caption">ทีมงานตอบเอง — สนใจอบรมปฏิบัติ CPR & AED ก็ทักได้เลย</div>
            </div>
          </a>
        </div>
      </div>

      <CallEmergencyButton />
    </div>
  )
}
