import { Link } from 'react-router-dom'
import {
  BookOpen, HeartPulse, Bandage, Skull, Phone, Award, MessageCircle,
  Check, ArrowRight, Activity, Gamepad2, Map, CalendarDays, UserCheck,
} from 'lucide-react'
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

// หน้า landing โทน JIA Learning Hub (ครีม + เขียวคลินิก, Sarabun)
// hero ใช้ข้อความเดียวกับ Ad A "4 นาที คือเส้นแบ่งชีวิต" ให้คนจากแอดเห็นข้อความตรงกัน

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

function trackLineLead() {
  fbqTrack('track', 'Lead', {
    content_name: 'cpr_aed_inperson_course',
    source: 'landing_line_button',
    channel: 'line',
  })
}

const CHAPTER_ICONS = { BookOpen, HeartPulse, Bandage, Skull }

const minMinutes = Math.min(...lessons.map((l) => l.minutes))
const maxMinutes = Math.max(...lessons.map((l) => l.minutes))

const HERO_CHECKS = ['ไม่ต้องสมัครก่อน', 'ฟรีทั้งคอร์ส', `บทละ ${minMinutes}–${maxMinutes} นาที`]

const STATS = [
  { value: lessons.length, label: 'บทเรียน' },
  { value: algorithms.length, label: 'ผังช่วยชีวิต' },
  { value: scenarios.length, label: 'สถานการณ์จำลอง' },
]

const HOW_IT_WORKS = [
  { title: 'เรียนบทสั้น ๆ ทีละบท', desc: 'อ่านง่าย มีรูปและวิดีโอ พร้อมคำถามท้ายบทช่วยจำ' },
  { title: 'ฝึกตัดสินใจกับสถานการณ์จำลอง', desc: 'ลองเลือกทางช่วยกับเหตุการณ์เสมือนจริง ก่อนเจอของจริง' },
  { title: 'สอบผ่าน รับใบประกาศภาคทฤษฎี', desc: 'ดาวน์โหลดได้ทันที ไม่มีค่าใช้จ่าย' },
]

// ทางเข้าส่วนอื่นของระบบ — ผู้เรียนภาคปฏิบัติที่เข้ามาหน้าแรกต้องหาเช็คชื่อ/ตารางเจอ
const OTHER_LINKS = [
  { to: '/algorithms', label: 'เปิดผังตามอาการ', icon: Map },
  { to: '/simulation', label: 'ฝึกสถานการณ์', icon: Activity },
  { to: '/schedule', label: 'ตารางอบรมปฏิบัติ', icon: CalendarDays },
  { to: '/certificate', label: 'ใบประกาศของฉัน', icon: Award },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', icon: UserCheck },
]

const pad2 = (n) => String(n).padStart(2, '0')

function Eyebrow({ children, dot = false }) {
  return (
    <div className="flex items-center gap-2 text-[10px] lg:text-[11px] font-bold tracking-[2px] uppercase text-hub-eyebrow">
      {dot && <span className="w-[5px] h-[5px] rounded-full bg-[#688C73]" />}
      {children}
    </div>
  )
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div className="mb-3.5 lg:mb-6 flex flex-col gap-1">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[22px] lg:text-[34px] leading-[1.4] font-bold tracking-[-0.4px] lg:tracking-[-0.6px]">{title}</h2>
    </div>
  )
}

function StartButton({ to, label, position, className = '' }) {
  return (
    <Link
      to={to}
      onClick={() => trackStartClick(position)}
      className={`inline-flex items-center justify-center gap-2.5 rounded-xl bg-hub-green hover:bg-hub-green-hover text-white! font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-hub-green ${className}`}
    >
      {label}
      <ArrowRight size={20} strokeWidth={1.8} />
    </Link>
  )
}

function PulseTile({ className = '', size }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute rounded-[16px] lg:rounded-[28px] bg-hub-heart text-hub-heart-ink flex items-center justify-center -rotate-[8deg] ${className}`}
    >
      <Activity size={size} strokeWidth={1.8} />
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
  const ctaLabel = hasStarted ? `เรียนต่อ — บทที่ ${nextLesson.order}` : 'เริ่มบทที่ 1 ฟรี'
  const ctaTo = hasStarted ? `/learn/${nextLesson.id}` : FIRST_LESSON_PATH

  return (
    <div className="font-sarabun bg-hub-cream text-hub-ink min-h-screen">
      <Seo path="/" jsonLd={courseJsonLd()} />

      {/* ═══ Top bar — มือถือ: แบรนด์ + ปุ่ม 1669 / จอใหญ่: เพิ่มเมนูและปุ่มเริ่มเรียน ═══ */}
      <header className="lg:sticky top-0 z-30 bg-hub-cream/95 backdrop-blur border-b border-hub-line">
        <div className="max-w-[1152px] mx-auto px-4 lg:px-8 h-[60px] lg:h-[72px] flex items-center gap-4 lg:gap-9">
          <Link to="/" className="flex items-center gap-2.5 text-hub-ink">
            <span className="w-[34px] h-[34px] lg:w-[38px] lg:h-[38px] rounded-[11px] bg-hub-green text-white flex items-center justify-center">
              <Activity size={20} strokeWidth={1.8} />
            </span>
            <span className="flex flex-col lg:flex-row lg:gap-1.5 leading-[1.2] lg:items-baseline">
              <span className="text-base lg:text-lg font-bold">FirstAid</span>
              <span className="text-[11px] lg:text-lg text-hub-muted">by Jia Training Center</span>
            </span>
          </Link>

          <nav className="hidden lg:flex flex-1 gap-7 text-[15px]" aria-label="เมนูหลัก">
            <Link to="/learn" className="hover:text-hub-green!">บทเรียน</Link>
            <Link to="/algorithms" className="hover:text-hub-green!">ผังช่วยชีวิต</Link>
            <Link to="/simulation" className="hover:text-hub-green!">สถานการณ์จำลอง</Link>
            <Link to="/game" className="hover:text-hub-green!">เกม</Link>
          </nav>

          <a
            href="tel:1669"
            className="ml-auto lg:ml-0 h-9 lg:h-10 px-3.5 lg:px-4 rounded-full border-[1.5px] border-hub-alert text-hub-alert! text-sm font-bold flex items-center gap-1.5 hover:bg-[#FBEBE8]"
          >
            <Phone size={16} strokeWidth={1.8} />
            <span className="lg:hidden">โทร 1669</span>
            <span className="hidden lg:inline">ฉุกเฉิน โทร 1669</span>
          </a>
          <StartButton
            to={ctaTo}
            label="เริ่มเรียนฟรี"
            position="header"
            className="hidden! lg:inline-flex! h-11 px-5 text-[15px] rounded-[9px]"
          />
        </div>
      </header>

      <div className="max-w-[1152px] mx-auto lg:px-8 pb-28 lg:pb-0">
        {/* ═══ Hero ═══ */}
        <section className="relative overflow-hidden mx-3 lg:mx-0 mt-3 lg:mt-6 rounded-[24px] bg-hub-hero px-[22px] pt-7 pb-[26px] lg:p-16 lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center">
          {/* ของตกแต่งมือถือ: วงโคจร + ไทล์ชีพจร */}
          <div aria-hidden="true" className="lg:hidden">
            <div className="absolute -right-[70px] -top-10 w-[230px] h-[230px] rounded-full border-[1.5px] border-hub-orbit" />
            <div className="absolute -right-[30px] top-0 w-[150px] h-[150px] rounded-full border-[1.5px] border-hub-orbit" />
          </div>
          <PulseTile className="lg:hidden right-[26px] top-[34px] w-[62px] h-[62px] shadow-[9px_12px_0_#CBDACA]" size={30} />

          <div className="relative flex flex-col gap-3.5 lg:gap-[18px]">
            <Eyebrow dot>
              <span className="lg:hidden">Free online course</span>
              <span className="hidden lg:inline">Free online course · Learn. Practice. Save lives.</span>
            </Eyebrow>
            <h1 className="flex flex-col gap-3 lg:gap-4 mt-1.5">
              <span className="flex items-end gap-2.5 lg:gap-3.5">
                <span className="font-georgia font-normal text-[104px] lg:text-[150px] leading-[0.85] lg:leading-[0.82] text-hub-green">4</span>
                <span className="text-[30px] lg:text-[44px] font-bold leading-[1.1] pb-1 lg:pb-1.5">นาที</span>
              </span>
              <span className="text-[34px] lg:text-[52px] leading-[1.3] lg:leading-[1.25] font-bold tracking-[-0.8px] lg:tracking-[-1.4px]">
                คือเส้นแบ่งชีวิต
              </span>
            </h1>
            <p className="text-[15px] lg:text-lg leading-[1.7] lg:leading-[1.75] text-hub-body max-w-[480px]">
              หัวใจหยุดเต้นเพียง 4 นาที สมองเริ่มเสียหายถาวร เรียนปฐมพยาบาลและช่วยชีวิตคนที่คุณรัก ก่อนวันที่ต้องใช้จริง
            </p>
            <div className="mt-1.5 lg:mt-2 flex flex-col lg:flex-row lg:items-center gap-3.5 lg:gap-[18px]">
              <StartButton
                to={ctaTo}
                label={ctaLabel}
                position="hero"
                className="h-[54px] lg:h-[58px] lg:px-[30px] text-[17px] lg:text-lg"
              />
              <div className="flex flex-wrap lg:flex-col gap-x-3.5 gap-y-1.5 lg:gap-0.5 text-[13px] lg:text-sm text-[#2E5A50]">
                {HERO_CHECKS.map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check size={14} strokeWidth={2.4} className="text-hub-green shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ภาพประกอบจอใหญ่: วงโคจร + ไทล์ชีพจร + ตัวเลขคอร์ส */}
          <div aria-hidden="true" className="hidden lg:block relative h-[420px]">
            <div className="absolute left-[60px] top-2.5 w-[400px] h-[400px] rounded-full border-[1.5px] border-hub-orbit" />
            <div className="absolute left-[130px] top-20 w-[260px] h-[260px] rounded-full border-[1.5px] border-hub-orbit" />
            <PulseTile className="left-[200px] top-[150px] w-[120px] h-[120px] shadow-[15px_23px_0_#CBDACA]" size={56} />
            {STATS.map(({ value, label }, i) => (
              <div
                key={label}
                className={`absolute px-4 py-3 rounded-xl bg-white shadow-[0_10px_40px_#14392E14] flex flex-col ${
                  ['left-0 top-10', 'right-0 top-[120px]', 'left-10 bottom-5'][i]
                }`}
              >
                <span className="text-[28px] leading-[1.2] text-hub-green">{value}</span>
                <span className="text-[13px] text-hub-muted">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="px-4 lg:px-0">
          {/* ═══ ตัวเลขคอร์ส (มือถือ — จอใหญ่อยู่ในภาพ hero) ═══ */}
          <section className="lg:hidden -mx-1 mt-3 grid grid-cols-3 rounded-[15px] bg-white border border-hub-line">
            {STATS.map(({ value, label }, i) => (
              <div
                key={label}
                className={`py-3.5 px-2 flex flex-col items-center ${i < STATS.length - 1 ? 'border-r border-hub-line' : ''}`}
              >
                <span className="text-[30px] leading-[1.2] text-hub-green">{value}</span>
                <span className="text-xs text-hub-muted text-center">{label}</span>
              </div>
            ))}
          </section>

          {/* ═══ บทแรก/บทถัดไป — ให้เห็นว่าเริ่มแล้วใช้เวลาแค่ไหน ═══ */}
          <section className="pt-8 lg:pt-[72px] lg:max-w-[640px]">
            <SectionHeading
              eyebrow={hasStarted ? 'Continue' : 'Start here'}
              title={hasStarted ? `เรียนต่อบทที่ ${nextLesson.order}` : `บทแรกใช้เวลาแค่ ${nextLesson.minutes} นาที`}
            />
            <Link
              to={ctaTo}
              onClick={() => trackStartClick('first_lesson')}
              className="p-[18px] rounded-[15px] bg-white border border-hub-line flex items-center gap-3.5 hover:border-hub-green transition-colors"
            >
              <span className="w-12 h-12 rounded-xl bg-[#DFEBE2] text-[#3F6F58] font-georgia text-[22px] flex items-center justify-center shrink-0">
                {pad2(nextLesson.order)}
              </span>
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-base font-bold">{nextLesson.title}</span>
                <span className="text-[13px] text-hub-muted">{nextLesson.minutes} นาที · มีคำถามท้ายบท</span>
              </span>
              <ArrowRight size={22} strokeWidth={1.8} className="text-hub-green" />
            </Link>
          </section>

          {/* ═══ เรียน · ฝึก · สอบ ═══ */}
          <section className="pt-8 lg:pt-[72px]">
            <SectionHeading eyebrow="How it works" title="เรียน · ฝึก · สอบรับใบประกาศ" />
            <ol className="rounded-[15px] bg-hub-journey px-[18px] py-1.5 lg:p-0 lg:bg-transparent lg:grid lg:grid-cols-3 lg:gap-5">
              {HOW_IT_WORKS.map(({ title, desc }, i) => (
                <li
                  key={title}
                  className={`py-3.5 flex gap-3.5 lg:flex-col lg:gap-2.5 lg:p-7 lg:rounded-[15px] lg:bg-white lg:border lg:border-hub-line ${
                    i < HOW_IT_WORKS.length - 1 ? 'border-b border-hub-journey-line' : ''
                  }`}
                >
                  <span className="font-georgia text-2xl lg:text-4xl text-hub-green w-8 shrink-0">{pad2(i + 1)}</span>
                  <span className="flex flex-col gap-0.5 lg:gap-2">
                    <span className="text-base lg:text-xl font-bold">{title}</span>
                    <span className="text-[13px] lg:text-[15px] leading-[1.6] lg:leading-[1.7] text-[#4D625C]">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ═══ 4 หมวด ═══ */}
          <section className="pt-8 lg:pt-[72px]">
            <SectionHeading eyebrow="What you learn" title={`${chapters.length} หมวด ครอบคลุมเหตุที่เจอบ่อย`} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-5">
              {chapters.map((ch) => {
                const Icon = CHAPTER_ICONS[ch.icon] ?? BookOpen
                const chLessons = lessons.filter((l) => l.chapter === ch.id)
                const minutes = chLessons.reduce((sum, l) => sum + l.minutes, 0)
                return (
                  <div key={ch.id} className="p-4 lg:p-6 rounded-xl lg:rounded-[15px] bg-white border border-hub-line flex flex-col gap-2.5">
                    <span className="w-10 h-10 rounded-[10px] bg-hub-iconbox text-hub-iconbox-ink flex items-center justify-center">
                      <Icon size={22} strokeWidth={1.6} />
                    </span>
                    <span className="text-[15px] lg:text-lg font-bold leading-[1.4]">{ch.title}</span>
                    <span className="hidden lg:block text-sm leading-[1.8] text-[#4D625C]">
                      {chLessons.slice(0, 4).map((l) => l.title.replace(/\s*\(.*\)$/, '')).join(' · ')}
                    </span>
                    <span className="text-xs lg:text-[13px] text-hub-muted mt-auto">{chLessons.length} บท · {minutes} นาที</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ═══ เกม — ทางเข้าแบบสนุกสำหรับคนที่ยังไม่พร้อมอ่าน ═══ */}
          <section className="pt-6 lg:pt-5">
            <Link
              to="/game"
              onClick={() => phCapture('landing_game_click')}
              className="p-[18px] lg:p-6 rounded-[15px] bg-hub-dark text-[#F8FBF8]! flex items-center gap-3.5 hover:bg-[#1D4A46] transition-colors"
            >
              <span className="w-12 h-12 rounded-xl bg-hub-dark-2 text-hub-dark-accent flex items-center justify-center shrink-0">
                <Gamepad2 size={24} strokeWidth={1.6} />
              </span>
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-base lg:text-lg font-bold">ยังไม่พร้อมอ่าน? ลองเล่นเกมก่อน</span>
                <span className="text-[13px] lg:text-sm text-hub-dark-copy">FIRST AID HERO — เกมตัดสินใจช่วยชีวิต เล่นฟรีไม่ต้องสมัคร</span>
              </span>
              <ArrowRight size={20} strokeWidth={1.8} />
            </Link>
          </section>

          {/* ═══ ใบประกาศ + อบรมปฏิบัติ ═══ */}
          <section className="pt-8 lg:pt-[72px] grid gap-4 lg:grid-cols-2 lg:gap-5">
            <div className="px-[22px] py-[26px] lg:p-9 rounded-[15px] bg-hub-paper border-[1.5px] border-hub-cert flex flex-col items-center text-center lg:items-start lg:text-left gap-2.5 lg:gap-3">
              <span className="lg:hidden w-14 h-14 rounded-full border-[1.5px] border-hub-cert text-hub-cert-ink flex items-center justify-center">
                <Award size={28} strokeWidth={1.6} />
              </span>
              <span className="font-georgia text-xl lg:text-[26px] text-hub-cert-ink">Certificate of Completion</span>
              <h2 className="text-xl lg:text-[22px] leading-[1.4] font-bold">สอบผ่าน รับใบประกาศภาคทฤษฎีฟรี</h2>
              <p className="text-[13px] lg:text-[15px] leading-[1.7] lg:leading-[1.75] text-[#4D625C]">
                ใบประกาศนี้รับรองการเรียนทฤษฎีออนไลน์ ยังไม่ใช่การรับรองการฝึกปฏิบัติ
                หากต้องการใบรับรองปฏิบัติ CPR &amp; AED ต้องอบรมกับผู้สอน
              </p>
              <StartButton
                to={ctaTo}
                label="เริ่มเรียนเพื่อรับใบประกาศ"
                position="certificate"
                className="mt-1.5 h-12 lg:h-[50px] px-[22px] lg:px-6 text-[15px] lg:text-base rounded-[9px]"
              />
            </div>

            <div className="px-[22px] py-[26px] lg:p-9 rounded-[15px] bg-hub-dark text-[#F8FBF8] flex flex-col gap-2.5 lg:gap-3">
              <span className="text-[10px] lg:text-[11px] font-bold tracking-[2px] text-hub-dark-accent">ONLINE + PRACTICE</span>
              <span className="text-xl lg:text-[22px] font-bold leading-[1.4]">อยากฝึกกดหน้าอกและใช้ AED จริง?</span>
              <p className="text-[13px] lg:text-[15px] leading-[1.7] lg:leading-[1.75] text-hub-dark-copy">
                Jia Training Center เปิดอบรมปฏิบัติ CPR &amp; AED กับผู้สอน ทัก LINE OA {LINE_ID} ทีมงานตอบเอง
              </p>
              <a
                href={LINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackLineLead}
                className="mt-1.5 self-start h-12 lg:h-[50px] px-[22px] lg:px-6 rounded-[9px] bg-hub-cream text-hub-ink! text-[15px] lg:text-base font-bold flex items-center gap-2 hover:bg-white"
              >
                <MessageCircle size={18} strokeWidth={1.8} />
                ทัก LINE {LINE_ID} ↗
              </a>
            </div>
          </section>

          {/* ═══ ส่วนอื่นของระบบ ═══ */}
          <nav className="pt-8 lg:pt-12" aria-label="ส่วนอื่นของระบบ">
            <div className="mb-3"><Eyebrow>Also inside</Eyebrow></div>
            <div className="flex flex-wrap gap-2">
              {OTHER_LINKS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="h-11 px-4 rounded-full bg-white border border-hub-line text-sm flex items-center gap-2 hover:border-hub-green hover:text-hub-green!"
                >
                  <Icon size={16} strokeWidth={1.6} className="text-hub-iconbox-ink" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          {/* ═══ ปิดท้าย ═══ */}
          <section className="mt-10 lg:mt-16 p-6 lg:p-10 rounded-[24px] bg-hub-hero flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10">
            <div className="flex-1 flex flex-col gap-1">
              <h2 className="text-[22px] lg:text-[28px] font-bold leading-[1.4]">พร้อมเรียนหรือยัง?</h2>
              <p className="text-[15px] leading-[1.7] text-hub-body">
                ใช้เวลาแค่วันละไม่กี่นาที — ความรู้ที่อาจช่วยชีวิตคนตรงหน้าคุณได้จริง
              </p>
            </div>
            <StartButton to={ctaTo} label={ctaLabel} position="footer" className="h-[54px] px-7 text-[17px]" />
          </section>

          <footer className="mt-8 lg:mt-12 py-6 lg:py-7 border-t border-hub-line text-xs lg:text-[13px] leading-[1.8] text-hub-muted text-center lg:text-left lg:flex lg:justify-between">
            <p>เนื้อหาดัดแปลงจากคู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป โดยหมอเจี่ย</p>
            <p>จัดทำโดย Jia Training Center — ศูนย์อบรม CPR &amp; AED</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
