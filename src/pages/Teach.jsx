import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, GraduationCap, KeyRound, Plus, RefreshCw } from 'lucide-react'
import { useClassStore } from '../stores/classStore'
import { classFetch, setInstructorCode as rememberSessionCode } from '../utils/instructorFetch'
import { summarizeReadiness } from '../../api/_lib/readiness.js'
import { lessons } from '../courses/firstaid/lessons'
import ClassGate from '../components/teach/ClassGate'
import ClassHome from '../components/teach/ClassHome'
import ClassOverview from '../components/teach/ClassOverview'
import ClassTheory from '../components/teach/ClassTheory'
import ClassPractice from '../components/teach/ClassPractice'
import Seo from '../components/Seo'

// หน้าผู้สอน (แบบ ACLS): ไม่ต้องมีบัญชี — สิทธิ์มาจากรหัสผู้สอนของคลาสที่เครื่องนี้ถืออยู่
const REFRESH_MS = 30_000
const TABS = [['class', 'คลาส/QR'], ['overview', 'ภาพรวม'], ['theory', 'ทฤษฎี'], ['practice', 'ปฏิบัติ']]

const readTab = () => { try { return sessionStorage.getItem('fa.teach.tab') || 'class' } catch { return 'class' } }

export default function Teach() {
  const { classId, sessionId, className, classCode, instructorCode, clearClass } = useClassStore()
  const [gate, setGate] = useState(null) // null | 'create' | 'connect'
  const [tab, setTabState] = useState(readTab)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null) // { status, message }
  const [loading, setLoading] = useState(false)

  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem('fa.teach.tab', t) } catch { /* ignore */ } }

  // ให้หน้า /scan/:sessionId รู้จักรหัสนี้ (เปิดสแกนได้ทันทีโดยไม่ต้องกรอกซ้ำ)
  useEffect(() => {
    if (sessionId && instructorCode) rememberSessionCode(sessionId, instructorCode)
  }, [sessionId, instructorCode])

  const fetchSummary = useCallback(async () => {
    const resp = await classFetch(instructorCode, `/api/cohorts/summary?cohortId=${encodeURIComponent(classId)}`)
    const body = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, body }
  }, [classId, instructorCode])

  const apply = useCallback(({ ok, status, body }) => {
    if (ok) { setError(null); setData(body); return }
    setError({
      status,
      message: status === 403 ? 'รหัสผู้สอนไม่ถูกต้องหรือถูกเปลี่ยนแล้ว — เชื่อมคลาสใหม่ด้วยรหัสล่าสุด'
        : status === 410 || body.error === 'Class closed' ? 'คลาสนี้ถูกปิดแล้ว'
          : (body.error || 'โหลดข้อมูลไม่สำเร็จ'),
    })
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    return fetchSummary().then(apply).catch(() => setError({ status: 0, message: 'โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ' })).finally(() => setLoading(false))
  }, [fetchSummary, apply])

  useEffect(() => {
    if (!classId || !instructorCode) return undefined
    let cancelled = false
    fetchSummary()
      .then((r) => { if (!cancelled) apply(r) })
      .catch(() => { if (!cancelled) setError({ status: 0, message: 'โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ' }) })
    const t = setInterval(() => { fetchSummary().then((r) => { if (!cancelled) apply(r) }).catch(() => {}) }, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [classId, instructorCode, fetchSummary, apply])

  const learners = useMemo(() => data?.learners || [], [data])
  const stats = useMemo(() => {
    const s = summarizeReadiness(learners, { totalLessons: lessons.length })
    return {
      students: learners.length,
      ready: s.ready,
      pre: learners.filter((l) => l.preTest).length,
      post: learners.filter((l) => l.postTest).length,
    }
  }, [learners])

  const header = (
    <Link to="/" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
      <ArrowLeft size={16} /> กลับหน้าหลัก
    </Link>
  )

  // ยังไม่มีคลาส: การ์ดแนะนำ 3 ขั้น (แบบ ACLS)
  if (!classId) {
    return (
      <div className="page-container">
        <Seo title="สำหรับผู้สอน | Jia Training Center" noindex path="/teach" />
        {header}
        <div className="text-caption">สำหรับผู้สอน</div>
        <div className="text-title">เปิดคลาสสอน CPR</div>
        <div className="card" style={{ marginTop: 12 }}>
          <ol className="text-body" style={{ margin: 0, paddingLeft: 22, lineHeight: 1.8, listStyle: 'decimal' }}>
            <li><b>สร้างคลาส</b> — ได้รหัสคลาส (แจกนักเรียน) และรหัสผู้สอน (เก็บเป็นความลับ)</li>
            <li><b>ให้นักเรียนเข้าร่วม</b> — สแกน QR หรือใส่รหัสคลาสจากมือถือของตัวเอง แล้วเรียนออนไลน์</li>
            <li><b>ติดตามผล</b> — ดูว่าใครพร้อมเข้าอบรมภาคปฏิบัติแล้ว วันอบรมสแกน QR เช็คชื่อและให้คะแนน</li>
          </ol>
          <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} onClick={() => setGate('create')}>
            <Plus size={16} /> สร้างคลาสใหม่
          </button>
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setGate('connect')}>
            <KeyRound size={14} /> มีรหัสผู้สอนอยู่แล้ว?
          </button>
        </div>
        {gate && <ClassGate mode={gate} onClose={() => setGate(null)} />}
      </div>
    )
  }

  return (
    <div className="page-container">
      <Seo title="สำหรับผู้สอน | Jia Training Center" noindex path="/teach" />
      {header}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption"><GraduationCap size={14} style={{ verticalAlign: 'middle' }} /> หน้าผู้สอน · รหัสคลาส {classCode}</div>
          <div className="text-title">{className}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={reload} aria-label="รีเฟรช" disabled={loading}><RefreshCw size={16} /></button>
      </div>

      {error && (
        <div className="callout callout-danger" style={{ marginTop: 10 }}>
          {error.message}
          {(error.status === 403 || error.status === 410) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setGate('connect')}>เชื่อมคลาสด้วยรหัสใหม่</button>
              <button type="button" className="btn btn-ghost" onClick={clearClass}>เลิกใช้คลาสนี้บนเครื่องนี้</button>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, textAlign: 'center' }}>
        {[['นักเรียน', stats.students], ['พร้อม', stats.ready], ['ทำ Pre', stats.pre], ['ทำ Post', stats.post]].map(([label, n]) => (
          <div key={label}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-brand)' }}>{n}</div>
            <div className="text-caption">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 12, position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-bg, #fff)', padding: '6px 0' }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, whiteSpace: 'nowrap', padding: '8px 2px', fontSize: 14 }} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'class' && <ClassHome onNewClass={() => setGate('create')} onConnect={() => setGate('connect')} />}
      {tab === 'overview' && <ClassOverview learners={learners} classCode={classCode} />}
      {tab === 'theory' && <ClassTheory learners={learners} classCode={classCode} />}
      {tab === 'practice' && <ClassPractice sessionId={sessionId} instructorCode={instructorCode} classCode={classCode} />}

      {gate && <ClassGate mode={gate} onClose={() => setGate(null)} />}
    </div>
  )
}
