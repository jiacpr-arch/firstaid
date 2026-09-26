import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import JiaAedNewsFeed from '../components/JiaAedNewsFeed'
import LearningPathCard from '../components/LearningPathCard'
import GamePromoCard from '../components/GamePromoCard'
import QuickMenu from '../components/QuickMenu'
import StreakBadge from '../components/StreakBadge'
import DailyQuiz from '../components/DailyQuiz'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { isPracticeDone, practiceChaptersRemaining } from '../utils/practice'
import { lessons } from '../courses/firstaid/lessons'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'
import Seo from '../components/Seo'
import { courseJsonLd } from '../lib/seo'

// กดแล้วเปิดแชตพร้อมข้อความ "สนใจเรียน + มาจากหน้าแรกแอป" พิมพ์ไว้ให้ ลูกค้าแค่กดส่ง
const LINE_URL = lineInterestUrl('กดจากหน้าแรกแอป')

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

export default function Home() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  useEnsureProgress(learner?.id)

  const lessonsDone = lessons.filter((l) => readLessonIds.has(l.id)).length
  const allLessonsDone = lessons.length > 0 && lessonsDone === lessons.length
  const practiceDone = isPracticeDone(passedScenarioIds)
  const practiceRemaining = practiceChaptersRemaining(passedScenarioIds)
  const progressPct = lessons.length ? Math.round((lessonsDone / lessons.length) * 100) : 0

  const nextLesson = preTestDone ? lessons.find((l) => !readLessonIds.has(l.id)) : null
  const studiedToday = localStorage.getItem('lastStudyDate') === new Date().toISOString().slice(0, 10)

  return (
    <div className="page-container">
      <Seo path="/" jsonLd={courseJsonLd()} />

      <header style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 }}>
          <span className="text-eyebrow">My learning</span>
          <StreakBadge />
        </div>
        <h1 className="text-display" style={{ margin: '2px 0 0' }}>ปฐมพยาบาลเบื้องต้น</h1>
        <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          สำหรับประชาชนทั่วไป — เรียนทฤษฎีออนไลน์ ฝึกปฏิบัติกับครูผู้สอน
        </div>
      </header>

      {/* ═══ เรียนต่อ — การ์ดเด่นที่สุดของหน้า ═══ */}
      {nextLesson && (
        <Link
          to={`/learn/${nextLesson.id}`}
          className="card-hover"
          style={{
            display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16,
            padding: 20, borderRadius: 15, background: '#163D3A', color: '#F8FBF8',
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="text-eyebrow" style={{ color: '#BFDDB3' }}>
              Continue · บทที่ {String(nextLesson.order).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 12, color: '#C9DCD4' }}>
              {nextLesson.minutes} นาที{studiedToday ? ' · เรียนวันนี้แล้ว' : ''}
            </span>
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>{nextLesson.title}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ height: 6, borderRadius: 999, background: '#30544D', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${progressPct}%`, borderRadius: 999, background: '#BFDDB3' }} />
            </span>
            <span style={{ fontSize: 12, color: '#C9DCD4' }}>เรียนแล้ว {lessonsDone} จาก {lessons.length} บท</span>
          </span>
          <span style={{
            height: 46, borderRadius: 9, background: '#FAFAF5', color: '#163D3A',
            fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            เรียนต่อ <ArrowRight size={18} strokeWidth={1.8} />
          </span>
        </Link>
      )}

      <LearningPathCard
        preTestDone={preTestDone}
        lessonsDone={lessonsDone}
        lessonsTotal={lessons.length}
        allLessonsDone={allLessonsDone}
        practiceDone={practiceDone}
        practiceRemaining={practiceRemaining}
        postTestDone={postTestDone}
      />

      <DailyQuiz />

      <QuickMenu style={{ marginBottom: 16 }} />

      <GamePromoCard source="home_game_click" style={{ marginBottom: 16 }} />

      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fbqTrack('track', 'Lead', {
          content_name: 'cpr_aed_inperson_course',
          source: 'home_line_button',
          channel: 'line',
        })}
        className="card card-hover"
        style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}
      >
        <div style={{ flex: 1 }}>
          <div className="text-body-strong">อยากฝึกปฏิบัติกับผู้สอน?</div>
          <div className="text-caption">ทัก LINE OA {LINE_ID} ดูรอบอบรม CPR &amp; AED — ทีมงานตอบเอง</div>
        </div>
        <span aria-hidden="true" style={{ fontSize: 18, color: 'var(--color-brand)' }}>↗</span>
      </a>

      <JiaAedNewsFeed />

      <div className="text-caption" style={{ marginTop: 24, textAlign: 'center', fontSize: 12 }}>
        {learner?.name ? `กำลังเรียนในชื่อ ${learner.name}` : 'ยังไม่ได้ตั้งชื่อ — แตะ "ใบประกาศของฉัน" เพื่อกรอกชื่อ'}
        {learner?.cohortName ? ` · คลาส ${learner.cohortName}` : ''}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
