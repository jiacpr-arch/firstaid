import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronRight, CheckCircle2, Lock } from 'lucide-react'
import { lessonsById, lessons } from '../courses/firstaid/lessons'
import LessonStep from '../components/LessonStep'
import YouTubeLessonPlayer from '../components/YouTubeLessonPlayer'
import VideoQuiz from '../components/VideoQuiz'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { isChapterUnlocked } from '../config/pricing'
import ChapterUnlockCard from '../components/ChapterUnlockCard'
import { markLessonRead, saveQuizAttempt, upsertLearner } from '../db/database'
import { flushSync } from '../db/sync'
import { fetchLessonMedia, mediaRowToStep } from '../utils/lessonMediaSteps'
import { fetchLessonVideo } from '../utils/lessonVideo'
import ProgressBar from '../components/ProgressBar'
import LinePopup from '../components/LinePopup'
import LineLoginGate from '../components/LineLoginGate'
import { useAuthSession } from '../hooks/useAuthSession'
import { isLineLoginConfigured } from '../utils/lineAuth'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { isAutomated } from '../lib/isAutomated'
import { getNewBadge } from '../utils/badges'
import { encourage } from '../utils/encouragement'
import CertUpsellCard from '../components/CertUpsellCard'
import { track } from '../utils/analytics'
import Seo from '../components/Seo'
import { lessonJsonLd, breadcrumbJsonLd } from '../lib/seo'

// ตั้งค่า LINE Login ครบ → ด่านล็อกอินจริง (LineLoginGate) หลังจบบทแรก และกั้นบทที่ 2 ขึ้นไป
// ยังไม่ตั้ง → ด่าน honor-system เดิม (LinePopup "ฉันแอดแล้ว"/ข้าม) — ดู docs/LINE_LOGIN_SETUP.md
const REAL_LOGIN_GATE = isLineLoginConfigured && isSupabaseConfigured

// mini quiz หลังคลิป ต้องได้อย่างน้อยเท่านี้ถึงไปต่อ ไม่งั้นต้องดูคลิปซ้ำ
const VIDEO_QUIZ_PASS = 0.7

export default function LessonReader() {
  useEnsureLearner()
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const markReadStore = useProgressStore((s) => s.markRead)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const progressLoaded = useProgressStore((s) => s.loaded)
  useEnsureProgress(learner?.id)
  const unlockedChapters = useEntitlementStore((s) => s.chapters)
  const entitlementsLoaded = useEntitlementStore((s) => s.loaded)
  useEnsureEntitlements()
  const { session, loading: authLoading } = useAuthSession()
  // ไม่กั้นตอน prerender (navigator.webdriver) — หน้าบทเรียนต้องมีเนื้อหาให้ SEO เก็บ
  const needsLogin = REAL_LOGIN_GATE && !isAutomated && !authLoading && !session

  const lesson = lessonsById[lessonId]
  const [prevLessonId, setPrevLessonId] = useState(lessonId)
  const [stepIdx, setStepIdx] = useState(0)
  const [correctCountState, setCorrectCount] = useState(0)
  const [quizCountState, setQuizCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [earnedBadge, setEarnedBadge] = useState(null)
  const [extraMedia, setExtraMedia] = useState([])
  // คลิปที่แอดมินตั้งใน DB: undefined = ยังโหลดอยู่, null = ไม่มี (ใช้ค่าจาก lessons.js)
  const [dbVideo, setDbVideo] = useState(undefined)
  const [gateDismissed, setGateDismissed] = useState(false)
  const [videoWatched, setVideoWatched] = useState(false)
  const [videoResult, setVideoResult] = useState(null)
  const [videoAttempt, setVideoAttempt] = useState(0)
  const [videoRetry, setVideoRetry] = useState(false)

  // Reset state when lessonId changes — set-during-render pattern
  if (prevLessonId !== lessonId) {
    setPrevLessonId(lessonId)
    setStepIdx(0)
    setCorrectCount(0)
    setQuizCount(0)
    setCompleted(false)
    setEarnedBadge(null)
    setGateDismissed(false)
    setVideoWatched(false)
    setVideoResult(null)
    setVideoAttempt(0)
    setVideoRetry(false)
    setDbVideo(undefined)
  }

  useEffect(() => {
    if (lesson) track('lesson_start', { lessonId: lesson.id, lessonOrder: lesson.order, lessonTitle: lesson.title })
  }, [lessonId]) // eslint-disable-line react-hooks/exhaustive-deps

  // โหลดสื่อที่แอดมินผูกไว้กับบทนี้ (รูป/วิดีโอจาก Supabase)
  useEffect(() => {
    let cancelled = false
    fetchLessonMedia(lessonId).then((rows) => { if (!cancelled) setExtraMedia(rows) })
    fetchLessonVideo(lessonId).then((v) => { if (!cancelled) setDbVideo(v) })
    return () => { cancelled = true }
  }, [lessonId])

  // ค่าใน DB ทับ lesson.video ใน lessons.js
  const video = dbVideo ?? lesson?.video
  const videoPosition = video?.position === 'end' ? 'end' : 'start'

  const steps = useMemo(() => lesson?.steps || [], [lesson])

  // จัดกลุ่มสื่อตามขั้น: after_step 1..len = ในขั้นนั้น; 0/ก่อนเริ่ม = หน้าปก; ว่าง/เกิน = ขั้นสุดท้าย
  const mediaByStep = useMemo(() => {
    const len = steps.length
    const map = new Map()
    for (const row of extraMedia) {
      let n = row.after_step
      if (n == null || n > len) n = len
      else if (n < 0) n = 0
      if (!map.has(n)) map.set(n, [])
      map.get(n).push(row)
    }
    return map
  }, [steps.length, extraMedia])

  // ลำดับสไลด์: หน้าปก (ถ้ามีรูป after_step=0) ก่อน แล้วตามด้วยแต่ละขั้นเนื้อหา
  const slides = useMemo(() => {
    const out = []
    const cover = mediaByStep.get(0)
    if (cover?.length) out.push({ kind: 'cover', media: cover })
    // บทที่มีคลิป: คลิป → mini quiz (ต้องดูถึง 90% และผ่าน 70% ถึงไปต่อได้)
    // position 'end' = ท้ายบท (อ่านก่อนแล้วดูสรุป), นอกนั้น = ต้นบท
    const videoSlides = video ? [{ kind: 'video' }, { kind: 'videoQuiz' }] : []
    if (videoPosition !== 'end') out.push(...videoSlides)
    steps.forEach((s, i) => out.push({ kind: 'step', step: s, media: mediaByStep.get(i + 1) }))
    if (videoPosition === 'end') out.push(...videoSlides)
    return out
  }, [video, videoPosition, steps, mediaByStep])

  // Meta ต่อบท — ต้อง render ในทุก return path (รวมหน้า lock/ปลดล็อก) เพื่อให้
  // prerender เก็บ title/description/JSON-LD ที่ถูกต้องของบทนั้นเสมอ
  const seo = lesson && (
    <Seo
      title={`${lesson.title} — บทเรียนปฐมพยาบาล | Jia Training Center`}
      description={`${lesson.summary} — บทเรียนปฐมพยาบาลออนไลน์ฟรี ใช้เวลา ${lesson.minutes} นาที โดย Jia Training Center`}
      path={`/learn/${lesson.id}`}
      ogType="article"
      jsonLd={[
        lessonJsonLd(lesson),
        breadcrumbJsonLd([
          { name: 'หน้าแรก', path: '/' },
          { name: 'บทเรียน', path: '/learn' },
          { name: lesson.title, path: `/learn/${lesson.id}` },
        ]),
      ]}
    />
  )

  // รอรู้ก่อนว่าบทนี้มีคลิปจาก DB ไหม ไม่งั้นผู้เรียนจะเห็นเนื้อหาแว้บก่อนคลิปโผล่ (ไม่รอตอน prerender)
  if (lesson && dbVideo === undefined && isSupabaseConfigured && !isAutomated) {
    return <div className="page-container">{seo}<div className="text-caption" style={{ marginTop: 16 }}>กำลังโหลดบทเรียน…</div></div>
  }

  if (!lesson) {
    return (
      <div className="page-container">
        <Seo title="ไม่พบบทเรียน — FirstAid by Jia Training Center" noindex path="/learn" />
        <div className="card">ไม่พบบทเรียน</div>
        <Link to="/learn" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          กลับไปหน้าบทเรียน
        </Link>
      </div>
    )
  }

  // ด่านล็อกอินบังคับ: บทที่ 2 ขึ้นไปต้องล็อกอิน (LINE หรือบัญชี JIA) ก่อน — ครอบคลุมทุกทางเข้า
  // (ปุ่ม "บทถัดไป", list ในหน้า Learn, URL ตรง) เพราะวิ่งผ่าน route นี้หมด; ป๊อปอัพหลังจบบท 1
  // กด "ไว้ทีหลัง" ได้ แต่จะมาเจอด่านนี้อีกเมื่อเปิดบทถัดไป
  if (needsLogin && lesson.order > 1) {
    const readFirst = readLessonIds.has(lessons[0].id)
    return (
      <div className="page-container">
        {seo}
        <div style={{ marginTop: 8 }}>
          <div className="text-caption">บทเรียนปฐมพยาบาล</div>
          <h1 className="text-title" style={{ margin: 0 }}>{lesson.title}</h1>
          <div className="text-body text-text-muted" style={{ marginTop: 4 }}>{lesson.summary}</div>
        </div>
        <LineLoginGate
          inline
          source="lesson_gate"
          title={readFirst ? 'เรียนจบบทแรกแล้ว 🎉' : 'เข้าสู่ระบบเพื่อเรียนต่อ'}
        />
        <Link to="/learn" className="btn btn-secondary btn-block" style={{ marginTop: 12, maxWidth: 400, marginInline: 'auto' }}>
          <ArrowLeft size={16} /> รายการบท
        </Link>
      </div>
    )
  }

  // กันเข้าบทเรียนตรง ๆ ผ่าน URL ก่อนทำ Pre-test — รอโหลดสถานะก่อนค่อยตัดสิน
  // ยกเว้นบทแรก (order 1) ที่บังคับให้เรียนก่อนเสมอเป็นตัวดึงดูด — ข้าม Pre-test ได้
  if (progressLoaded && !preTestDone && lesson.order !== 1) {
    return (
      <div className="page-container">
        {seo}
        <div style={{ marginTop: 8 }}>
          <div className="text-caption">บทเรียนปฐมพยาบาล</div>
          <h1 className="text-title" style={{ margin: 0 }}>{lesson.title}</h1>
          <div className="text-body text-text-muted" style={{ marginTop: 4 }}>{lesson.summary}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 28, marginTop: 16 }}>
          <Lock size={44} color="var(--color-text-secondary)" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>ยังเข้าบทเรียนไม่ได้</div>
          <div className="text-body" style={{ marginTop: 8 }}>
            กรุณาทำแบบทดสอบก่อนเรียน (Pre-test) ก่อน จึงจะเริ่มเรียนได้
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to="/learn" className="btn btn-secondary" style={{ flex: 1 }}>
            <ArrowLeft size={16} /> รายการบท
          </Link>
          <Link to="/pre-test" className="btn btn-primary" style={{ flex: 1 }}>
            ไปทำ Pre-test <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  // ปลดล็อกด้วยการซื้อ — หมวด 1 ฟรีเสมอ (isChapterUnlocked คืน true ทันที) หมวด 2-4 ต้องมี
  // entitlement ผูกกับ learner_id ถาวร ครอบคลุมทั้ง URL ตรง, list ในหน้า Learn และปุ่ม "บทถัดไป"
  // เพราะทุกทางเข้าวิ่งผ่าน route นี้เหมือนกัน
  if (entitlementsLoaded && !isChapterUnlocked(lesson.chapter, unlockedChapters)) {
    return <>{seo}<ChapterUnlockCard chapter={lesson.chapter} /></>
  }

  const slide = slides[stepIdx]
  const isLast = stepIdx === slides.length - 1
  const idx = lesson.order - 1
  const nextLesson = lessons[idx + 1]

  // ความก้าวหน้าทั้งคอร์ส — กี่บทแล้ว จากทั้งหมด (อัปเดตเองหลังเรียนจบบท)
  const totalLessons = lessons.length
  const doneLessons = lessons.filter((l) => readLessonIds.has(l.id)).length

  // extra = คะแนน mini quiz ที่เพิ่งผ่านในสไลด์สุดท้าย (state ยังไม่อัปเดตตอนเรียกฟังก์ชันนี้)
  const finishLesson = async (extra = { correct: 0, total: 0 }) => {
    if (!learner?.id) return
    const quizCount = quizCountState + extra.total
    const correctCount = correctCountState + extra.correct
    const newBadge = getNewBadge({ readLessonIds, postTestDone, lessonId: lesson.id })
    await markLessonRead(learner.id, lesson.id)
    markReadStore(lesson.id)
    localStorage.setItem('lastStudyDate', new Date().toISOString().slice(0, 10))
    if (newBadge) track('badge_earned', { badgeId: newBadge.id, lessonId: lesson.id })
    const quizScore = quizCount > 0 ? Math.round((correctCount / quizCount) * 100) : null
    if (quizCount > 0) {
      await saveQuizAttempt({
        learnerId: learner.id,
        lessonId: lesson.id,
        score: quizScore,
        correctCount,
        totalQuestions: quizCount,
        passed: quizScore >= 70,
      })
    }
    setEarnedBadge(newBadge)
    flushSync(learner.id)
    track('lesson_complete', {
      lessonId: lesson.id,
      lessonOrder: lesson.order,
      lessonTitle: lesson.title,
      ...(quizScore !== null ? { quizScore, quizCorrect: correctCount, quizTotal: quizCount } : {}),
    })
    setCompleted(true)
  }

  const onAnswered = (_id, correct) => {
    setQuizCount((c) => c + 1)
    if (correct) setCorrectCount((c) => c + 1)
  }

  // จบบท 1: ด่านล็อกอินจริงเมื่อตั้งค่า LINE Login แล้ว ไม่งั้นป๊อปอัพ honor-system เดิม
  const showLoginGate = completed && lesson.order === 1 && needsLogin && !gateDismissed
  const needLoginGate = !REAL_LOGIN_GATE && completed && lesson.order === 1 && !learner?.lineAdded && !learner?.lineSkippedAt
  const confirmLine = async () => {
    updateLearner({ lineAdded: true })
    track('line_add', { source: 'lesson1_popup' })
    // แจ้ง admin LINE ว่ามีคนสนใจ (fire-and-forget — ไม่บล็อก UX ถ้า notify ล้มเหลว)
    fetch('/api/notify/line-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerId: learner?.id }),
    }).catch(() => {})
    if (learner?.id) {
      try {
        await upsertLearner({ ...learner, lineAdded: true })
      } catch {
        /* sync ล้มเหลวไม่เป็นไร — สถานะ local พอให้เรียนต่อได้ */
      }
    }
  }
  // Soft gate: กด "ดูภายหลัง" — บันทึกว่าข้าม แล้วปลดล็อกให้เรียนบทอื่นต่อได้
  const skipLine = () => {
    updateLearner({ lineSkippedAt: new Date().toISOString() })
    track('line_skip', { source: 'lesson1_popup' })
  }

  // "ไว้ทีหลัง" บนด่านล็อกอิน: ปิดป๊อปอัพ + นับเป็นข้ามเหมือน LinePopup (หน้าแรกจึงเป็น Home ไม่ใช่
  // Landing) — ไม่ได้ปลดล็อกอะไร บทที่ 2 ขึ้นไปยังกั้นด้วย session อยู่ดี
  const postponeLogin = () => {
    setGateDismissed(true)
    updateLearner({ lineSkippedAt: new Date().toISOString() })
  }

  // ทดสอบ/พรีวิว: ใส่ ?skipvideo=1 เพื่อข้ามด่านคลิป
  const skipVideoGate = new URLSearchParams(window.location.search).has('skipvideo')
  const videoSlideIdx = slides.findIndex((x) => x.kind === 'video')
  const videoPassed = videoResult && videoResult.correct / videoResult.total >= VIDEO_QUIZ_PASS

  const advanceLocked =
    !skipVideoGate &&
    ((slide?.kind === 'video' && !videoWatched) || (slide?.kind === 'videoQuiz' && !videoResult))

  const advance = () => {
    if (slide?.kind === 'videoQuiz' && !skipVideoGate) {
      const passed = videoPassed
      track('video_quiz_submit', {
        lessonId: lesson.id,
        score: Math.round((videoResult.correct / videoResult.total) * 100),
        passed,
        attempt: videoAttempt + 1,
        position: videoPosition,
      })
      if (!passed) {
        // ตก → กลับไปดูคลิปใหม่ ล็อกปุ่มต่อไปอีกรอบ
        setVideoWatched(false)
        setVideoResult(null)
        setVideoAttempt((n) => n + 1)
        setVideoRetry(true)
        setStepIdx(videoSlideIdx)
        return
      }
      setQuizCount((c) => c + videoResult.total)
      setCorrectCount((c) => c + videoResult.correct)
      if (isLast) { finishLesson({ correct: videoResult.correct, total: videoResult.total }); return }
    }
    if (!isLast) setStepIdx((i) => i + 1)
    else finishLesson()
  }

  if (completed) {
    return (
      <div className="page-container">
        {seo}
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เรียนจบบทแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>{lesson.title}</div>
          {quizCountState > 0 && (
            <div className="text-body" style={{ marginTop: 12 }}>
              ตอบคำถามถูก {correctCountState} / {quizCountState}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <ProgressBar value={doneLessons} max={totalLessons} />
            <div className="text-caption" style={{ marginTop: 6 }}>
              เรียนจบแล้ว {doneLessons} / {totalLessons} บท
            </div>
            <div className="text-body-strong" style={{ marginTop: 6, color: 'var(--color-brand-dark)' }}>
              {encourage(doneLessons, totalLessons)}
            </div>
          </div>
        </div>
        {earnedBadge && (
          <div className="card" style={{ marginTop: 12, textAlign: 'center', padding: 20, background: '#F7EFDD', border: '1.5px solid #E9D9B7' }}>
            <div style={{ fontSize: 40 }}>{earnedBadge.emoji}</div>
            <div className="text-body-strong" style={{ marginTop: 8 }}>ปลดล็อกแล้ว: {earnedBadge.label}</div>
            <div className="text-caption" style={{ marginTop: 4 }}>{earnedBadge.desc}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to="/learn" className="btn btn-secondary" style={{ flex: 1 }}>
            <ArrowLeft size={16} /> รายการบท
          </Link>
          {nextLesson ? (
            <Link to={`/learn/${nextLesson.id}`} className="btn btn-primary" style={{ flex: 1 }}>
              บทถัดไป <ChevronRight size={16} />
            </Link>
          ) : (
            <Link to="/post-test" className="btn btn-primary" style={{ flex: 1 }}>
              ทำ Post-test <ChevronRight size={16} />
            </Link>
          )}
        </div>
        {/* เรียนครบทุกบทแล้ว — ชวนมาอบรมปฏิบัติจริง */}
        {!nextLesson && <CertUpsellCard source="lesson_complete_all" />}
        {showLoginGate && <LineLoginGate onLater={postponeLogin} />}
        {needLoginGate && <LinePopup onConfirm={confirmLine} onSkip={skipLine} />}
      </div>
    )
  }

  return (
    <div className="page-container course-reader">
      {seo}
      <button type="button" onClick={() => navigate('/learn')} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> รายการบท
      </button>
      <header className="course-reader-heading" style={{ marginTop: 4 }}>
        <div className="text-caption">บทที่ {lesson.order} จาก {totalLessons}</div>
        <h1 className="text-title">{lesson.title}</h1>
        <p className="text-body">{lesson.summary}</p>
      </header>

      {/* ความก้าวหน้าทั้งคอร์ส + คำให้กำลังใจ ให้มีแรงเรียนต่อจนจบ */}
      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="text-caption">ความก้าวหน้าทั้งคอร์ส</span>
          <span className="text-caption">เรียนจบแล้ว {doneLessons} / {totalLessons} บท</span>
        </div>
        <ProgressBar value={doneLessons} max={totalLessons} />
        <div className="text-caption" style={{ marginTop: 8, color: 'var(--color-brand-dark)', fontWeight: 600 }}>
          {encourage(doneLessons, totalLessons)}
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <ProgressBar value={stepIdx + 1} max={slides.length} />
        <div className="text-caption" style={{ marginTop: 4 }}>
          {slide?.kind === 'cover' ? 'หน้าปก' : `ขั้นที่ ${stepIdx + 1} / ${slides.length}`}
        </div>
      </div>

      {slide?.kind === 'cover' ? (
        // สไลด์หน้าปก — แสดงเฉพาะรูป/วิดีโอ ก่อนเข้าเนื้อหา
        slide.media.map((row) => (
          <div key={row.id} style={{ marginBottom: 12 }}>
            <LessonStep step={mediaRowToStep(row)} />
          </div>
        ))
      ) : slide?.kind === 'video' ? (
        <div className="card course-lesson-step">
          {videoRetry && (
            <div className="callout callout-info" style={{ marginBottom: 12 }}>
              <div className="text-body">ตอบถูกยังไม่ถึงเกณฑ์ ลองดูคลิปอีกครั้งแล้วทำคำถามใหม่นะ</div>
            </div>
          )}
          <YouTubeLessonPlayer
            videoId={video.youtube}
            orientation={video.orientation}
            resetKey={videoAttempt}
            onPlay={() => track('video_play', { lessonId: lesson.id, attempt: videoAttempt + 1, position: videoPosition })}
            onWatched={() => {
              setVideoWatched(true)
              track('video_watched', { lessonId: lesson.id, attempt: videoAttempt + 1, position: videoPosition })
            }}
          />
          {!videoWatched && !skipVideoGate && (
            <div className="text-caption" style={{ marginTop: 8, textAlign: 'center' }}>
              ดูคลิปให้ถึง 90% เพื่อไปต่อ
            </div>
          )}
        </div>
      ) : slide?.kind === 'videoQuiz' ? (
        <>
          <VideoQuiz key={videoAttempt} questions={video.quiz} onComplete={setVideoResult} />
          {videoResult && (
            <div className={`callout ${videoPassed ? 'callout-info' : 'callout-danger'}`} style={{ marginTop: 12 }}>
              <div className="text-body-strong">
                ได้ {videoResult.correct} / {videoResult.total} ข้อ
              </div>
              <div className="text-body">
                {videoPassed ? 'ผ่านแล้ว ไปเรียนต่อได้เลย' : 'ยังไม่ถึง 70% กดต่อไปเพื่อกลับไปดูคลิปอีกครั้ง'}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <LessonStep step={slide.step} onQuizAnswered={onAnswered} />
          {/* รูป/วิดีโอที่ผูกกับขั้นนี้ — แสดงใต้เนื้อหาในสไลด์เดียวกัน */}
          {slide.media?.map((row) => (
            <div key={row.id} style={{ marginTop: 12 }}>
              <LessonStep step={mediaRowToStep(row)} />
            </div>
          ))}
        </>
      )}

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={advance} disabled={advanceLocked}>
        {isLast ? 'จบบทเรียน' : 'ต่อไป'} <ChevronRight size={16} />
      </button>
    </div>
  )
}
