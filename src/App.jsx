import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { useSettingsStore } from './stores/settingsStore'
import { useLearnerStore } from './stores/learnerStore'
import { useEnsureLearner } from './hooks/useLearner'
import { useAuthSession } from './hooks/useAuthSession'
import { initAuthListener } from './stores/authStore'
import { isSupabaseConfigured } from './config/supabaseClient'
import { lessons } from './courses/firstaid/lessons'
import { courseMeta } from './config/courseMode'
import OfflineIndicator from './components/OfflineIndicator'
import MetaPixel from './components/MetaPixel'
import BottomTabBar from './components/BottomTabBar'
import { HouseAdStrip } from './components/HouseAdBanner'
import CallEmergencyButton from './components/CallEmergencyButton'
import RequireAdmin from './components/RequireAdmin'
import { initPostHog, identifyLearner } from './lib/posthog'

const FIRST_LESSON_PATH = `/learn/${lessons[0].id}`

import Home from './pages/Home'
import Learn from './pages/Learn'
import LessonReader from './pages/LessonReader'
import ExamPage from './pages/ExamPage'
import AlgorithmIndex from './pages/AlgorithmIndex'
import AlgorithmDetail from './pages/AlgorithmDetail'
import SimulationSelect from './pages/SimulationSelect'
import SimulationRun from './pages/SimulationRun'
import Certification from './pages/Certification'
import EmergencyCall from './pages/EmergencyCall'
import CheckIn from './pages/CheckIn'
import CheckInScan from './pages/CheckInScan'
import Settings from './pages/Settings'
import News from './pages/News'
import LineCallback from './pages/LineCallback'

const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminSessions = lazy(() => import('./pages/AdminSessions'))
const AdminSessionDetail = lazy(() => import('./pages/AdminSessionDetail'))
const AdminCohorts = lazy(() => import('./pages/AdminCohorts'))
const AdminCertificates = lazy(() => import('./pages/AdminCertificates'))
const AdminMedia = lazy(() => import('./pages/AdminMedia'))
const AdminLessonMedia = lazy(() => import('./pages/AdminLessonMedia'))

const AdminFallback = () => (
  <div className="page-container py-12 text-center text-caption">กำลังโหลด admin…</div>
)

export default function App() {
  const theme = useSettingsStore((s) => s.theme)
  const location = useLocation()

  // มี learner ภายในเสมอ (anonymous) เพื่อเก็บโปรไฟล์/ความก้าวหน้า
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const { session, loading: authLoading } = useAuthSession()

  // เริ่มฟังสถานะ session ของผู้เรียน (Supabase Auth) ครั้งเดียว
  useEffect(() => initAuthListener(), [])

  useEffect(() => { initPostHog() }, [])

  useEffect(() => {
    if (learner?.id) identifyLearner({ learnerId: learner.id, lineUserId: learner.lineUserId, displayName: learner.name })
  }, [learner?.id, learner?.lineUserId, learner?.name])

  useEffect(() => {
    const root = document.documentElement
    const apply = (isDark) => root.classList.toggle('dark', isDark)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const onChange = (e) => apply(e.matches)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    apply(theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.title = courseMeta.title
  }, [])

  const isAdmin = location.pathname.startsWith('/admin')
  // Onboarding: บังคับเรียนบทแรกก่อนเสมอจนกว่าจะล็อกอินด้วย LINE (จบบทแรกแล้วเด้งหน้าล็อกอิน)
  // ยกเว้นฝั่ง admin และหน้าโทรฉุกเฉิน /call (โทร 1669 ต้องเข้าได้เสมอ)
  // ถ้า Supabase ไม่ได้ตั้งค่า (dev/local) → fallback ไปด่าน honor-system เดิม (lineAdded)
  const onboarding = !isAdmin && (isSupabaseConfigured ? !session : (!learner || !learner.lineAdded))

  // กัน flash: รอเช็ค session ให้เสร็จก่อน ไม่งั้นผู้ใช้ที่ล็อกอินแล้วจะถูกเด้งกลับบทแรกชั่วขณะ
  if (isSupabaseConfigured && authLoading && !isAdmin) {
    return (
      <div className="page-container py-12 text-center text-caption" style={{ minHeight: '100vh' }}>
        กำลังตรวจสอบสิทธิ์…
      </div>
    )
  }

  if (
    onboarding &&
    location.pathname !== FIRST_LESSON_PATH &&
    location.pathname !== '/call' &&
    location.pathname !== '/auth/line/callback'
  ) {
    return <Navigate to={FIRST_LESSON_PATH} replace />
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:lessonId" element={<LessonReader />} />
        <Route path="/pre-test" element={<ExamPage kind="pre" />} />
        <Route path="/post-test" element={<ExamPage kind="post" />} />

        <Route path="/algorithms" element={<AlgorithmIndex />} />
        <Route path="/algorithms/:topic" element={<AlgorithmDetail />} />

        <Route path="/simulation" element={<SimulationSelect />} />
        <Route path="/simulation/:scenarioId" element={<SimulationRun />} />

        <Route path="/certificate" element={<Certification />} />
        <Route path="/call" element={<EmergencyCall />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/checkin/scan" element={<CheckInScan />} />
        <Route path="/checkin/:sessionCode" element={<CheckIn />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/news" element={<News />} />
        <Route path="/auth/line/callback" element={<LineCallback />} />

        <Route path="/admin/login" element={
          <Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>
        } />
        <Route path="/admin" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminDashboard /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/cohorts" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminCohorts /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/sessions" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminSessions /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/sessions/:id" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminSessionDetail /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/certificates" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminCertificates /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/media" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminMedia /></RequireAdmin></Suspense>
        } />
        <Route path="/admin/lesson-media" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminLessonMedia /></RequireAdmin></Suspense>
        } />
      </Routes>
      {!isAdmin && !onboarding && <HouseAdStrip />}
      {!isAdmin && !onboarding && <BottomTabBar />}
      {/* ระหว่าง onboarding ซ่อนแท็บบาร์เพื่อบังคับเรียนบทแรก แต่คงปุ่มโทร 1669 ไว้เสมอ */}
      {onboarding && <CallEmergencyButton />}
      <Analytics />
      <MetaPixel />
    </div>
  )
}
