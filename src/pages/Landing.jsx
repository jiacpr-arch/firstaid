import { Link } from 'react-router-dom'
import {
  BookOpen, HeartPulse, Bandage, Skull, Phone, Award, MessageCircle,
  Check, ArrowRight, Activity, Gamepad2, Map, CalendarDays, UserCheck,
} from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { lessons, chapters } from '../courses/firstaid/lessons'
import { nextLearningStep } from '../utils/practice'
import { algorithms } from '../courses/firstaid/algorithms'
import { scenarios } from '../courses/firstaid/scenarios'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'
import { phCapture } from '../lib/posthog'
import { track } from '../utils/analytics'
import Seo from '../components/Seo'
import HubCertSample from '../components/HubCertSample'
import { COURSE_BUNDLE_PRICE, CHAPTER_PRICES, CPR_CHAPTER, FREE_CHAPTER } from '../config/pricing'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { courseJsonLd } from '../lib/seo'
import { trackLandingContact } from '../lib/trainingAds'
import { trackGoogleLandingContact } from '../lib/trainingGoogleAds'

import { CLASSROOM_ART, chapterArtwork } from '../config/courseArtwork'

const LINE_URL = lineInterestUrl('กดจากหน้า landing คนใหม่')
const FIRST_LESSON_PATH = `/learn/${lessons[0].id}`
function trackStartClick(position) {
  phCapture('landing_start_click', { position })
}
function trackLineLead() {
  trackLandingContact(window, document)
  trackGoogleLandingContact(window, document)
}
const CHAPTER_ICONS = { BookOpen, HeartPulse, Bandage, Skull }
const OTHER_LINKS = [
  { to: '/algorithms', label: 'ผังช่วยชีวิต', desc: `${algorithms.length} ผัง เปิดดูตามอาการ`, icon: Map },
  { to: '/simulation', label: 'ฝึกสถานการณ์', desc: `${scenarios.length} เหตุการณ์ ฝึกตัดสินใจ`, icon: Activity },
  { to: '/schedule', label: 'อบรมปฏิบัติ', desc: 'ดูรอบอบรม CPR & AED', icon: CalendarDays },
  { to: '/certificate', label: 'ใบประกาศของฉัน', desc: 'ดูและดาวน์โหลดใบประกาศ', icon: Award },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', desc: 'สแกน QR หรือกรอกรหัสจากครู', icon: UserCheck },
]
function StartButton({ to, label, position }) {
  return <Link to={to} onClick={() => trackStartClick(position)} className="btn btn-primary btn-lg">{label}<ArrowRight size={20} /></Link>
}
export default function Landing() {
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  useEnsureProgress(learner?.id)
  useEnsureEntitlements()
  const entStatus = useEntitlementStore((s) => s.status)
  const ownsCourse = useEntitlementStore((s) => s.chapters.has(0))
  // ราคาขึ้นก่อนเสมอ (คนเข้าครั้งแรกต้องเห็นว่าคอร์สราคาเท่าไร) — ปุ่มหลักเป็นปุ่มซื้อ
  // ยกเว้นคนที่ปลดล็อกทั้งคอร์สแล้ว ให้ปุ่มหลักเป็นเริ่ม/เรียนต่อแทน
  const showBuy = !(entStatus === 'ok' && ownsCourse)
  const chapterPrice = Math.min(...Object.entries(CHAPTER_PRICES).filter(([c]) => Number(c) !== CPR_CHAPTER).map(([, p]) => p))

  // เคยเริ่มเรียนไปแล้วแต่ยังไม่พ้น onboarding (ยังไม่แอด/ข้าม LINE) — ชวน "เรียนต่อ" แทน "เริ่มเรียน"
  const hasStarted = readLessonIds.size > 0
  // ขั้นถัดไปเคารพด่านฝึกท้ายหมวด — จบหมวดแล้วยังไม่ฝึก ให้ปุ่มพาไปฝึกก่อน ไม่ใช่บทที่ล็อกอยู่
  const step = hasStarted ? nextLearningStep(lessons, readLessonIds, passedScenarioIds) : null
  const nextLesson = step?.lesson ?? lessons[0]
  const ctaLabel = !hasStarted ? (showBuy ? `ลองเรียนบทที่ 1 ฟรี` : 'เริ่มบทที่ 1')
    : step?.kind === 'practice' ? `ฝึกท้ายหมวด ${step.chapter} ก่อนเรียนต่อ`
      : `เรียนต่อ — บทที่ ${nextLesson.order}`
  const ctaTo = !hasStarted ? FIRST_LESSON_PATH : (step?.to ?? `/learn/${nextLesson.id}`)

  return (
    <div className="course-landing course-landing-compact">
      <Seo path="/" jsonLd={courseJsonLd()} />
      <header className="course-nav">
        <div className="course-width course-nav-inner">
          <Link to="/" className="course-brand"><span className="course-brand-mark"><HeartPulse size={23} /></span><span>FirstAid<small>Jia Training Center</small></span></Link>
          <nav aria-label="เมนูหลัก" className="course-desktop-nav">
            <Link to="/learn">บทเรียน</Link><Link to="/algorithms">ผังช่วยชีวิต</Link><Link to="/simulation">ฝึกสถานการณ์</Link><Link to="/game">เกม</Link>
          </nav>
          <a href="tel:1669" className="course-emergency"><Phone size={16} /> โทร 1669</a>
        </div>
      </header>
      <main className="course-width">
        <section className="course-hero">
          <div className="course-hero-copy">
            <span className="course-kicker"><span /> คอร์สออนไลน์ · สำหรับประชาชนทั่วไป</span>
            <h1>เรียนปฐมพยาบาล<br /><em>เริ่มช่วยเป็น</em><br />ตั้งแต่วันนี้</h1>
            <p>ค่อย ๆ เรียนรู้วิธีรับมือเหตุฉุกเฉิน ตั้งแต่การประเมินความปลอดภัย ไปจนถึง CPR และการใช้ AED</p>
            {showBuy && (
              <div className="course-price" aria-label="ราคาคอร์ส">
                <div className="course-price-main"><strong>฿{COURSE_BUNDLE_PRICE}</strong><span>ทั้งคอร์ส · ทุกหมวด + CPR &amp; AED</span></div>
                <small>หรือซื้อแยกหมวดละ ฿{chapterPrice} · CPR &amp; AED ฿{CHAPTER_PRICES[CPR_CHAPTER]} · จ่ายบัตร/PromptPay เรียนได้ทันที</small>
              </div>
            )}
            <div className="course-hero-actions">
              {showBuy
                ? <><Link to="/buy" onClick={() => { trackStartClick('hero_buy'); track('cta_click', { source: 'landing_hero' }) }} className="btn btn-primary btn-lg">ซื้อคอร์ส ฿{COURSE_BUNDLE_PRICE}<ArrowRight size={20} /></Link><Link to={ctaTo} onClick={() => trackStartClick('hero')} className="course-text-link">{ctaLabel} <ArrowRight size={17} /></Link></>
                : <><StartButton to={ctaTo} label={ctaLabel} position="hero" /><Link to="/learn" className="course-text-link">ดูบทเรียนทั้งหมด <ArrowRight size={17} /></Link></>}
            </div>
            <div className="course-checks">{showBuy && <span><Check size={16} /> หมวด {FREE_CHAPTER} ทดลองเรียนฟรี ไม่ต้องสมัคร</span>}<span><Check size={16} /> บทสั้น เรียนตามเวลาที่สะดวก</span></div>
          </div>
          <figure className="course-hero-art">
            <img src={CLASSROOM_ART} alt="ภาพประกอบครูและนักเรียนเรียนรู้เรื่องปฐมพยาบาลในห้องฝึก" width="1536" height="1024" fetchPriority="high" />
            <figcaption><span className="course-art-icon"><BookOpen size={21} /></span><span>ความรู้เล็ก ๆ ที่ใช้ได้ตลอดชีวิต<small>เรียนทฤษฎี แล้วต่อยอดด้วยการฝึกปฏิบัติ</small></span></figcaption>
          </figure>
        </section>
        <section className="course-stats" aria-label="รายละเอียดคอร์ส">
          <div><strong>{lessons.length}</strong><span>บทเรียนสั้น ๆ</span></div><div><strong>{chapters.length}</strong><span>หมวดการเรียนรู้</span></div><div><strong>{scenarios.length}</strong><span>สถานการณ์ให้ฝึก</span></div><div><Award size={29} /><span>สอบผ่าน รับใบประกาศ<br /><b>ภาคทฤษฎี</b></span></div>
        </section>
        <section className="course-section">
          <div className="course-section-heading"><div><span className="course-kicker">เลือกเรื่องที่อยากเรียนรู้</span><h2>พร้อมรับมือเรื่องใกล้ตัว</h2></div><Link to="/learn" className="course-text-link">ดูครบ {lessons.length} บท <ArrowRight size={17} /></Link></div>
          <div className="course-chapters">{chapters.map(ch => {
            const Icon = CHAPTER_ICONS[ch.icon] ?? BookOpen
            const items = lessons.filter(l => l.chapter === ch.id)
            const art = chapterArtwork[ch.id]
            return <Link to={`/learn#chapter-${ch.id}`} key={ch.id} className="course-chapter"><div className="course-chapter-art"><img src={art.src} alt={art.alt} width="600" height="400" loading="lazy" /><span><Icon size={22} /></span></div><div className="course-chapter-copy"><small>หมวดที่ {ch.id} · {items.length} บทเรียน</small><h3>{ch.title}</h3><span className="course-chapter-bottom">ดูบทเรียน <ArrowRight size={17} /></span></div></Link>
          })}</div>
        </section>
        <HubCertSample />
        <Link to="/game" className="course-game-shortcut" onClick={() => phCapture('landing_game_click')}><Gamepad2 size={26} /><span><strong>FIRST AID HERO</strong><small>ลองฝึกตัดสินใจผ่านเกมช่วยชีวิต</small></span><ArrowRight size={22} /></Link>
        <section className="course-tools"><h2>ทางลัดสำหรับผู้เรียน</h2><nav aria-label="ทางลัดสำหรับผู้เรียน">{OTHER_LINKS.map(({to, label, desc, icon: Icon}) => <Link to={to} key={to}><Icon size={23} /><span><strong>{label}</strong><small>{desc}</small></span><ArrowRight size={17} /></Link>)}</nav></section>
        <div className="course-practical-note"><Award size={21} /><p>ใบประกาศภาคทฤษฎีรับได้เมื่อเรียนและสอบผ่าน<br /><a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={trackLineLead}><MessageCircle size={15} /> สนใจฝึกปฏิบัติ ทัก LINE {LINE_ID} ↗</a></p></div>
        <footer className="course-footer"><span>FirstAid · Jia Training Center</span><p>เนื้อหาดัดแปลงจากคู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป โดยหมอเจี่ย</p></footer>
      </main>
    </div>
  )
}
