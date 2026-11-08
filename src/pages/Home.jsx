import { CLASSROOM_ART } from '../config/courseArtwork'
import { Link } from 'react-router-dom'
import { ArrowRight, UserRound } from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import JiaAedNewsFeed from '../components/JiaAedNewsFeed'
import LearningPathCard from '../components/LearningPathCard'
import GamePromoCard from '../components/GamePromoCard'
import QuickMenu from '../components/QuickMenu'
import ClassBanner from '../components/ClassBanner'
import BuyCourseBanner from '../components/BuyCourseBanner'
import StreakBadge from '../components/StreakBadge'
import DailyQuiz from '../components/DailyQuiz'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { isPracticeDone, practiceChaptersRemaining, practiceLink, nextLearningStep } from '../utils/practice'
import { lessons } from '../courses/firstaid/lessons'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'
import Seo from '../components/Seo'
import { courseJsonLd } from '../lib/seo'
import CprTopBar from '../components/CprTopBar'

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

  // ขั้นถัดไป: บทถัดไป หรือฝึกท้ายหมวดก่อน ถ้าบทถัดไปอยู่หมวดใหม่ที่ยังติดด่านฝึก
  const step = preTestDone ? nextLearningStep(lessons, readLessonIds, passedScenarioIds) : null
  const nextLesson = step?.lesson ?? null
  const practiceFirst = step?.kind === 'practice'
  const studiedToday = localStorage.getItem('lastStudyDate') === new Date().toISOString().slice(0, 10)

  return (
    <div className="page-container course-home">
      <Seo path="/" jsonLd={courseJsonLd()} />

      <header style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 }}>
          <span className="text-eyebrow">My learning</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <StreakBadge />
            {/* บัญชี / ออกจากระบบ — เดิมอยู่แค่หน้าบทเรียน ผู้ใช้หาไม่เจอ */}
            <Link to="/settings" aria-label="บัญชีของฉัน" title="บัญชีของฉัน" style={{
              width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)',
            }}>
              <UserRound size={18} />
            </Link>
          </span>
        </div>
        <h1 className="text-display" style={{ margin: '2px 0 0' }}>ปฐมพยาบาลเบื้องต้น</h1>
        <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          สำหรับประชาชนทั่วไป — เรียนทฤษฎีออนไลน์ ฝึกปฏิบัติกับครูผู้สอน
        </div>
      </header>

      <CprTopBar source="home_top" />
      <ClassBanner />
      <BuyCourseBanner source="home_top" style={{ marginBottom: 16 }} />

      <figure className="course-home-art"><img src={CLASSROOM_ART} alt="ภาพประกอบห้องเรียนปฐมพยาบาล" width="1536" height="1024" /><figcaption>ค่อย ๆ เรียนรู้ แล้วฝึกให้มั่นใจ</figcaption></figure>

      {/* ═══ เรียนต่อ — การ์ดเด่นที่สุดของหน้า ═══ */}
      {nextLesson && (
        <Link
          to={step.to}
          className="card-hover"
          style={{
            display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16,
            padding: 20, borderRadius: 15, background: '#163D3A', color: '#F8FBF8',
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="text-eyebrow" style={{ color: '#BFDDB3' }}>
              {practiceFirst ? `ฝึกท้ายหมวด ${step.chapter}` : `Continue · บทที่ ${String(nextLesson.order).padStart(2, '0')}`}
            </span>
            <span style={{ fontSize: 12, color: '#C9DCD4' }}>
              {practiceFirst ? '' : `${nextLesson.minutes} นาที`}{studiedToday ? `${practiceFirst ? '' : ' · '}เรียนวันนี้แล้ว` : ''}
            </span>
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>
            {practiceFirst ? `ฝึกสถานการณ์หมวด ${step.chapter}: ${step.chapterTitle}` : nextLesson.title}
          </span>
          {practiceFirst && (
            <span style={{ fontSize: 13, color: '#C9DCD4' }}>
              ฝึกให้ผ่าน 1 ฉาก แล้วบทที่ {nextLesson.order} {nextLesson.title} จะเปิดให้เรียนต่อ
            </span>
          )}
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
            {practiceFirst ? 'ไปฝึกสถานการณ์' : 'เรียนต่อ'} <ArrowRight size={18} strokeWidth={1.8} />
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
        practiceTo={practiceLink(passedScenarioIds)}
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
