import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { useSettingsStore } from './stores/settingsStore'
import { courseMeta } from './config/courseMode'
import OfflineIndicator from './components/OfflineIndicator'
import BottomTabBar from './components/BottomTabBar'
import RequireAdmin from './components/RequireAdmin'

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

const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminSessions = lazy(() => import('./pages/AdminSessions'))
const AdminSessionDetail = lazy(() => import('./pages/AdminSessionDetail'))
const AdminCohorts = lazy(() => import('./pages/AdminCohorts'))
const AdminCertificates = lazy(() => import('./pages/AdminCertificates'))
const AdminMedia = lazy(() => import('./pages/AdminMedia'))

const AdminFallback = () => (
  <div className="page-container py-12 text-center text-caption">กำลังโหลด admin…</div>
)

export default function App() {
  const theme = useSettingsStore((s) => s.theme)
  const location = useLocation()

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
      </Routes>
      {!isAdmin && <BottomTabBar />}
      <Analytics />
    </div>
  )
}
