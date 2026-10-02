import { Link } from 'react-router-dom'
import {
  BookOpen, HeartPulse, Bandage, Skull, Phone, Award, MessageCircle,
  Check, ArrowRight, Activity, Gamepad2, Map, CalendarDays, UserCheck, Clock,
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

import { CLASSROOM_ART, chapterArtwork } from '../config/courseArtwork'

const LINE_URL = lineInterestUrl('กดจากหน้า landing คนใหม่')
const FIRST_LESSON_PATH = `/learn/${lessons[0].id}`
function fbqTrack(...args) { try { window.fbq?.(...args) } catch { /* Optional analytics */ } }
function trackStartClick(position) {
  phCapture('landing_start_click', { position })
  fbqTrack('trackCustom', 'LandingStartLearning', { position })
}
function trackLineLead() {
  fbqTrack('track', 'Lead', { content_name: 'cpr_aed_inperson_course', source: 'landing_line_button', channel: 'line' })
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
  useEnsureProgress(learner?.id)

  // เคยเริ่มเรียนไปแล้วแต่ยังไม่พ้น onboarding (ยังไม่แอด/ข้าม LINE) — ชวน "เรียนต่อ" แทน "เริ่มเรียน"
  const hasStarted = readLessonIds.size > 0
  const nextLesson = hasStarted ? (lessons.find((l) => !readLessonIds.has(l.id)) ?? lessons[0]) : lessons[0]
  const ctaLabel = hasStarted ? `เรียนต่อ — บทที่ ${nextLesson.order}` : 'เริ่มบทที่ 1 ฟรี'
  const ctaTo = hasStarted ? `/learn/${nextLesson.id}` : FIRST_LESSON_PATH

  return (
    <div className="course-landing">
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
            <span className="course-kicker"><span /> คอร์สออนไลน์ฟรี · สำหรับประชาชนทั่วไป</span>
            <h1>เรียนปฐมพยาบาล<br /><em>เริ่มช่วยเป็น</em><br />ตั้งแต่วันนี้</h1>
            <p>ค่อย ๆ เรียนรู้วิธีรับมือเหตุฉุกเฉิน ตั้งแต่การประเมินความปลอดภัย ไปจนถึง CPR และการใช้ AED</p>
            <div className="course-hero-actions"><StartButton to={ctaTo} label={ctaLabel} position="hero" /><Link to="/learn" className="course-text-link">ดูบทเรียนทั้งหมด <ArrowRight size={17} /></Link></div>
            <div className="course-checks"><span><Check size={16} /> ไม่ต้องสมัครก่อน</span><span><Check size={16} /> บทสั้น เรียนตามเวลาที่สะดวก</span></div>
          </div>
          <figure className="course-hero-art">
            <img src={CLASSROOM_ART} alt="ภาพประกอบครูและนักเรียนเรียนรู้เรื่องปฐมพยาบาลในห้องฝึก" width="1536" height="1024" fetchPriority="high" />
            <figcaption><span className="course-art-icon"><BookOpen size={21} /></span><span>ความรู้เล็ก ๆ ที่ใช้ได้ตลอดชีวิต<small>เรียนทฤษฎี แล้วต่อยอดด้วยการฝึกปฏิบัติ</small></span></figcaption>
          </figure>
        </section>
        <section className="course-stats" aria-label="รายละเอียดคอร์ส">
          <div><strong>{lessons.length}</strong><span>บทเรียนสั้น ๆ</span></div><div><strong>{chapters.length}</strong><span>หมวดการเรียนรู้</span></div><div><strong>{scenarios.length}</strong><span>สถานการณ์ให้ฝึก</span></div><div><Award size={29} /><span>สอบผ่าน รับใบประกาศ<br /><b>ภาคทฤษฎีฟรี</b></span></div>
        </section>
        <section className="course-start-section">
          <div><span className="course-kicker">เริ่มตรงนี้</span><h2>{hasStarted ? 'กลับมาเรียนต่อกัน' : 'บทแรก เริ่มจากพื้นฐาน'}</h2><p>เรียนทีละเรื่อง แล้วทบทวนด้วยคำถามท้ายบท</p></div>
          <Link to={ctaTo} onClick={() => trackStartClick('first_lesson')} className="course-first-lesson"><span className="course-lesson-number">{String(nextLesson.order).padStart(2, '0')}</span><span><strong>{nextLesson.title}</strong><small><Clock size={14} /> {nextLesson.minutes} นาที · มีคำถามท้ายบท</small></span><ArrowRight size={22} /></Link>
        </section>
        <section className="course-section">
          <div className="course-section-heading"><div><span className="course-kicker">เลือกเรื่องที่อยากเรียนรู้</span><h2>พร้อมรับมือเรื่องใกล้ตัว</h2></div><Link to="/learn" className="course-text-link">ดูครบ {lessons.length} บท <ArrowRight size={17} /></Link></div>
          <div className="course-chapters">{chapters.map(ch => {
            const Icon = CHAPTER_ICONS[ch.icon] ?? BookOpen
            const items = lessons.filter(l => l.chapter === ch.id)
            const art = chapterArtwork[ch.id]
            return <Link to={`/learn#chapter-${ch.id}`} key={ch.id} className="course-chapter"><div className="course-chapter-art"><img src={art.src} alt={art.alt} width="600" height="400" loading="lazy" /><span><Icon size={22} /></span></div><div className="course-chapter-copy"><small>หมวดที่ {ch.id} · {items.length} บทเรียน</small><h3>{ch.title}</h3><p>{items.slice(0, 3).map(l => l.title.replace(/\s*\(.*\)$/, '')).join(' · ')}</p><span className="course-chapter-bottom">ดูบทเรียน <ArrowRight size={17} /></span></div></Link>
          })}</div>
        </section>
        <section className="course-practice-banner">
          <div><span className="course-kicker">ลองคิด ลองตัดสินใจ</span><h2>ถ้าเหตุเกิดตรงหน้า<br />เราจะช่วยอย่างไร?</h2><p>ฝึกกับ FIRST AID HERO เกมจำลองเหตุการณ์ที่ให้คุณเลือกวิธีช่วยเหลือด้วยตัวเอง</p><Link to="/game" className="btn btn-secondary btn-lg" onClick={() => phCapture('landing_game_click')}><Gamepad2 size={20} /> ลองเล่นเกม <ArrowRight size={18} /></Link></div>
          <div className="course-game-art" aria-hidden="true"><img className="course-game-scene" src="/images/backgrounds/noodle_shop.webp" alt="" loading="lazy" /><img className="course-game-character" src="/images/characters/kru_fah/happy.webp" alt="" loading="lazy" /><span className="course-game-label"><Activity size={17} /> FIRST AID HERO</span></div>
        </section>
        <section className="course-section"><div className="course-section-heading"><div><span className="course-kicker">เส้นทางการเรียน</span><h2>เรียนรู้ → ฝึกคิด → ทบทวน</h2></div></div><ol className="course-journey">{[
          ['เรียนบทสั้น ๆ ทีละบท', 'เริ่มจากพื้นฐาน อ่านเนื้อหาและตอบคำถามท้ายบท'],
          ['ฝึกกับสถานการณ์จำลอง', 'นำสิ่งที่เรียนมาลองใช้กับเหตุการณ์เสมือนจริง'],
          ['สอบรับใบประกาศภาคทฤษฎี', 'เรียนและฝึกครบตามเกณฑ์ แล้วทำแบบทดสอบหลังเรียน'],
        ].map(([title, desc], i) => <li key={title}><span>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{desc}</p></li>)}</ol></section>
        <section className="course-tools"><h2>ทางลัดสำหรับผู้เรียน</h2><nav aria-label="ทางลัดสำหรับผู้เรียน">{OTHER_LINKS.map(({to, label, desc, icon: Icon}) => <Link to={to} key={to}><Icon size={23} /><span><strong>{label}</strong><small>{desc}</small></span><ArrowRight size={17} /></Link>)}</nav></section>
        <section className="course-certificate"><div className="course-cert-mark"><img src="/cert-logo.png" alt="ตรา Jia Training Center" width="110" height="110" loading="lazy" /><Award size={28} /></div><div><span className="course-kicker">เก็บความภูมิใจหลังเรียนจบ</span><h2>ใบประกาศภาคทฤษฎี ไม่มีค่าใช้จ่าย</h2><p>เรียนครบ ฝึกผ่านตามเกณฑ์ และสอบผ่าน แล้วดาวน์โหลดใบประกาศได้เลย หากต้องการใบรับรองภาคปฏิบัติ CPR &amp; AED ต้องฝึกกับครูผู้สอน</p><a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={trackLineLead} className="course-text-link"><MessageCircle size={18} /> สนใจฝึกปฏิบัติ ทัก LINE {LINE_ID} ↗</a></div></section>
        <a href="tel:1669" className="course-emergency-note"><Phone size={23} /><span><strong>มีเหตุฉุกเฉินตอนนี้ โทร 1669</strong><small>ติดต่อทีมฉุกเฉินทันที ไม่ต้องรอเรียนจบ</small></span><ArrowRight size={19} /></a>
        <footer className="course-footer"><span>FirstAid · Jia Training Center</span><p>เนื้อหาดัดแปลงจากคู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป โดยหมอเจี่ย</p></footer>
      </main>
    </div>
  )
}
