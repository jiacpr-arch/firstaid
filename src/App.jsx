import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { useSettingsStore } from './stores/settingsStore'
import { useLearnerStore } from './stores/learnerStore'
import { useProgressStore } from './stores/progressStore'
import { useEnsureLearner } from './hooks/useLearner'
import { initAuthListener } from './stores/authStore'
import { startBackgroundSync } from './db/sync'
import { courseMeta } from './config/courseMode'
import OfflineIndicator from './components/OfflineIndicator'
import InAppBrowserNotice from './components/InAppBrowserNotice'
import MetaPixel from './components/MetaPixel'
import BottomTabBar from './components/BottomTabBar'
import { HouseAdStrip } from './components/HouseAdBanner'
import RequireAdmin from './components/RequireAdmin'
import { initPostHog, identifyLearner, phCapture } from './lib/posthog'

import Home from './pages/Home'
import Landing from './pages/Landing'
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

// เกมโหมดโบนัส (FIRST AID HERO) — lazy เพื่อไม่ให้ chunk หลักโตจนชน PWA precache cap
const FirstAidGame = lazy(() => import('./pages/FirstAidGame'))

const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminSessions = lazy(() => import('./pages/AdminSessions'))
const AdminSessionDetail = lazy(() => import('./pages/AdminSessionDetail'))
const AdminCohorts = lazy(() => import('./pages/AdminCohorts'))
const AdminCertificates = lazy(() => import('./pages/AdminCertificates'))
const AdminMedia = lazy(() => import('./pages/AdminMedia'))
const AdminLessonMedia = lazy(() => import('./pages/AdminLessonMedia'))
const AdminVouchers = lazy(() => import('./pages/AdminVouchers'))

const AdminFallback = () => (
  <div className="page-container py-12 text-center text-caption">กำลังโหลด admin…</div>
)

export default function App() {
  const theme = useSettingsStore((s) => s.theme)
  const location = useLocation()

  // มี learner ภายในเสมอ (anonymous) เพื่อเก็บโปรไฟล์/ความก้าวหน้า
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)

  useEffect(() => { initPostHog() }, [])

  // เปิด listener สถานะล็อกอิน (LINE → Supabase Auth) ครั้งเดียวตอนแอปเริ่ม — จำเป็นสำหรับ
  // ระบบปลดล็อกบทเรียนที่ผูกสิทธิ์กับ learner_id ถาวร ไม่ใช่แค่ local id ที่สลับได้
  useEffect(() => initAuthListener(), [])

  useEffect(() => {
    if (learner?.id) identifyLearner({ learnerId: learner.id, lineUserId: learner.lineUserId, displayName: learner.name })
  }, [learner?.id, learner?.lineUserId, learner?.name])

  // Push offline-first progress up to Supabase (dashboards + cross-device) and,
  // for logged-in learners, pull progress from other devices back down.
  useEffect(() => {
    if (!learner?.id) return
    return startBackgroundSync(() => learner.id, {
      onPulled: (id) => useProgressStore.getState().refresh(id),
    })
  }, [learner?.id])

  // ยิง $pageview เข้า PostHog ทุกครั้งที่เปลี่ยนหน้า (init ตั้ง capture_pageview:false ไว้
  // เพราะเป็น SPA) — เพื่อให้ firstaid มีข้อมูล top-of-funnel วัด conversion ได้จริง
  useEffect(() => {
    phCapture('$pageview')
  }, [location.pathname])

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
  // เกมเป็นหน้า full-screen มีปุ่มกลับของตัวเอง — ซ่อนแท็บบาร์/แถบโฆษณาเหมือนกันกับฝั่ง admin
  const isGame = location.pathname === '/game'
  // Onboarding: ผู้ใช้ใหม่ (ยังไม่แอด LINE และยังไม่กดข้าม) เห็นหน้า landing เชิญชวนที่ "/"
  // แทนแดชบอร์ด Home — ไม่บังคับ redirect เข้าบทเรียนอีกแล้ว (คนคลิกจากแอดต้องเห็นก่อนว่า
  // คอร์สคืออะไร ฟรีไหม ได้อะไร แล้วค่อยกดเริ่มเอง) ส่วนคำชวนแอด LINE @jiacpr ยังอยู่ที่
  // ท้ายบทที่ 1 เหมือนเดิม (LineGateCard ใน LessonReader) — จบบท 1 แล้วแอด/ข้าม ถึงพ้นสถานะนี้
  const onboarding = !isAdmin && (!learner || (!learner.lineAdded && !learner.lineSkippedAt))
  // หน้า landing โชว์แท็บบาร์/แถบโฆษณาเหมือนหน้าปกติ — ผู้ใช้ใหม่ต้องเห็นทางเข้าทั้งระบบตั้งแต่แรก

  return (
    <div style={{ minHeight: '100vh' }}>
      <InAppBrowserNotice />
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={onboarding ? <Landing /> : <Home />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:lessonId" element={<LessonReader />} />
        <Route path="/pre-test" element={<ExamPage kind="pre" />} />
        <Route path="/post-test" element={<ExamPage kind="post" />} />

        <Route path="/algorithms" element={<AlgorithmIndex />} />
        <Route path="/algorithms/:topic" element={<AlgorithmDetail />} />

        <Route path="/simulation" element={<SimulationSelect />} />
        <Route path="/simulation/:scenarioId" element={<SimulationRun />} />
        <Route path="/game" element={
          <Suspense fallback={<div className="page-container py-12 text-center text-caption">กำลังโหลดเกม…</div>}>
            <FirstAidGame />
          </Suspense>
        } />

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
        <Route path="/admin/vouchers" element={
          <Suspense fallback={<AdminFallback />}><RequireAdmin><AdminVouchers /></RequireAdmin></Suspense>
        } />
      </Routes>
      {!isAdmin && !isGame && <HouseAdStrip />}
      {!isAdmin && !isGame && <BottomTabBar />}
      <Analytics />
      <MetaPixel />
    </div>
  )
}
