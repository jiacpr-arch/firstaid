import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, HeartPulse, Lock, PlayCircle, QrCode, RefreshCw } from 'lucide-react'
import { CPR_MODULES, CPR_FINAL_ID, cprDrawCount, cprModule } from '../courses/cpr/modules'
import { useEnsureLearner } from '../hooks/useLearner'
import { useEnsureProgress } from '../hooks/useProgress'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useClassCpr } from '../hooks/useClassCpr'
import { useAuthSession } from '../hooks/useAuthSession'
import { authHeader } from '../utils/authHeader'
import { fetchHubCourseCert, claimHubCourseCertificate, saveCardName, HUB_CPR_COURSE_ID } from '../utils/hubCertificate'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { useEntitlementStore, entitlementKey } from '../stores/entitlementStore'
import { isChapterUnlocked, CPR_CHAPTER } from '../config/pricing'
import ChapterUnlockCard from '../components/ChapterUnlockCard'
import YouTubeLessonPlayer from '../components/YouTubeLessonPlayer'
import LineLoginGate from '../components/LineLoginGate'
import HubCertificateCard from '../components/HubCertificateCard'
import { phCapture } from '../lib/posthog'
import Seo from '../components/Seo'

// คอร์ส CPR & AED ออนไลน์ 7 บท = หมวดที่ 5 ของคอร์สปฐมพยาบาล (เดิมแยกอยู่ cpr.morroo.com — นักเรียนงงที่ต้องข้ามเว็บ)
// - คลาสรวม CPR + ปฐมพยาบาล: ฟรี เรียนหลังจบปฐมพยาบาล (Post-test ผ่าน) ผลผูกกับเบอร์ในคลาสให้ครูเห็น
// - คนทั่วไป: เห็นทุกบท แต่ต้องปลดล็อกหมวด 5 (฿149) หรือทั้งคอร์สก่อน (ChapterUnlockCard แบบหมวดอื่น)
// บท 1–6 ดูวิดีโอ + แบบทดสอบ 5 ข้อ ผ่าน 80% → ข้อสอบปลายภาค 10 ข้อ
// ตรวจคำตอบที่ api/cpr/grade.js → grade-quiz (เฉลยอยู่ที่ server) แล้วบันทึกลง online_students
// ผ่านปลายภาค (ต้องล็อกอิน) → ระบบกลาง JIA ออกใบประกาศ CPR ให้ (รับได้ในหน้านี้เลย)

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// สุ่มคำถาม + สลับตัวเลือก จำ index ต้นฉบับไว้แปลงคำตอบกลับก่อนส่งตรวจ (แบบเดียวกับ cpr.morroo.com)
function drawQuiz(mod) {
  return shuffled(mod.quiz.map((q, i) => ({ ...q, i })))
    .slice(0, Math.min(cprDrawCount(mod), mod.quiz.length))
    .map((q) => {
      const order = shuffled(q.c.map((_, i) => i))
      return { q: q.q, c: order.map((i) => q.c[i]), i: q.i, order }
    })
}

// คะแนนจาก server (คลาส: รวมที่เคยเรียนบน cpr.morroo.com) + ที่เพิ่งผ่านในเครื่อง (server อาจยังไม่ทันอัปเดต)
function usePassed(ctx, learner) {
  return useMemo(() => {
    const s = new Set()
    for (const k of Object.keys(ctx.scores || {})) s.add(Number(k))
    const local = learner?.cprScoresCode === ctx.scopeKey ? learner?.cprScores || {} : {}
    for (const k of Object.keys(local)) s.add(Number(k))
    if (ctx.completed) s.add(CPR_FINAL_ID)
    return s
  }, [ctx.scores, ctx.completed, ctx.scopeKey, learner?.cprScores, learner?.cprScoresCode])
}

// ความคืบหน้าของคนที่ซื้อหมวด CPR เอง (api/cpr/progress.js) — ข้ามเครื่องได้
function usePaidProgress(enabled, learnerId) {
  const [state, setState] = useState({ scores: {}, completed: false, loaded: false })
  const [checking, setChecking] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !learnerId) return undefined
    let cancelled = false
    ;(async () => {
      setChecking(true)
      try {
        const r = await fetch('/api/cpr/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ learnerId }),
        })
        const body = await r.json().catch(() => ({}))
        if (!cancelled) setState({ scores: body.scores || {}, completed: !!body.completed, loaded: true })
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loaded: true }))
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => { cancelled = true }
  }, [enabled, learnerId, tick])
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, checking, refresh }
}

// ข้อความชมหลังสอบผ่านแต่ละบท (แบบเดียวกับ cpr.morroo.com ให้กำลังใจเรียนต่อ)
const ENCOURAGE = {
  1: 'เยี่ยมมาก! รู้เรื่อง CPR ผู้ใหญ่แล้ว ไปบทต่อไปเลย',
  2: 'ดีมาก! CPR ทารกก็ไม่ยากเลย',
  3: 'เก่งมาก! ช่วยผู้ใหญ่สำลักได้แล้ว — เรียนมาครึ่งทางแล้ว',
  4: 'สุดยอด! ช่วยทารกสำลักได้แล้ว',
  5: 'ใกล้จบแล้ว! ใช้ AED กับผู้ใหญ่เป็นแล้ว อีกบทเดียว',
  6: 'ผ่านครบทุกบทแล้ว! พร้อมสอบข้อสอบปลายภาคได้เลย',
}

const isUnlocked = (id, passed) => {
  if (id === 1) return true
  if (id === CPR_FINAL_ID) return [1, 2, 3, 4, 5, 6].every((x) => passed.has(x))
  return passed.has(id - 1)
}

export default function CprCourse() {
  useEnsureLearner()
  useEnsureEntitlements()
  const learner = useLearnerStore((s) => s.learner)
  useEnsureProgress(learner?.id)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const progressLoaded = useProgressStore((s) => s.loaded)
  const { session } = useAuthSession()
  const unlockedChapters = useEntitlementStore((s) => s.chapters)
  const entitlementStatus = useEntitlementStore((s) => s.status)
  const entitlementResultKey = useEntitlementStore((s) => s.key)
  const cpr = useClassCpr()
  const inClass = !!learner?.cohortCode && cpr.status !== 'none'
  const paid = !inClass && isChapterUnlocked(CPR_CHAPTER, unlockedChapters)
  const paidProgress = usePaidProgress(paid, learner?.id)
  const ctx = inClass
    ? { mode: 'class', code: learner.cohortCode, scopeKey: learner.cohortCode, scores: cpr.cpr?.scores, completed: cpr.status === 'done', refresh: cpr.refresh, checking: cpr.checking }
    : { mode: paid ? 'paid' : 'locked', code: null, scopeKey: 'paid', scores: paidProgress.scores, completed: paidProgress.completed, refresh: paidProgress.refresh, checking: paidProgress.checking }
  const passed = usePassed(ctx, learner)
  // จำคะแนนจาก server ไว้ในเครื่องด้วย — หน้าเรียน (Learn หมวด 5) จะแสดงบทที่ผ่านแล้วตรงกันโดยไม่ต้องโหลดใหม่
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const serverScores = ctx.scores
  useEffect(() => {
    const keys = Object.keys(serverScores || {})
    if (!keys.length || !learner) return
    const local = learner.cprScoresCode === ctx.scopeKey ? learner.cprScores || {} : {}
    if (keys.every((k) => k in local)) return
    updateLearner({ cprScores: { ...serverScores, ...local }, cprScoresCode: ctx.scopeKey })
  }, [serverScores, ctx.scopeKey, learner, updateLearner])
  const { moduleId } = useParams()
  const mod = moduleId ? cprModule(moduleId) : null
  const loading = <div className="page-container"><div className="card text-caption" style={{ textAlign: 'center' }}>กำลังโหลดคอร์ส CPR…</div></div>

  if (inClass) {
    if (cpr.status === 'loading' || !progressLoaded) return loading
    if (!postTestDone) return <FirstAidFirst />
  } else {
    const fresh = entitlementStatus === 'ok' && entitlementResultKey === entitlementKey(session, learner?.id)
    if (!paid && !fresh && entitlementStatus !== 'error') return loading
    if (paid && !paidProgress.loaded) return loading
  }
  if (ctx.mode !== 'locked' && mod && isUnlocked(mod.id, passed)) return <CprModule key={mod.id} mod={mod} passed={passed} ctx={ctx} />
  return <CprOverview passed={passed} ctx={ctx} />
}

function Header({ title, back = '/' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Link to={back} className="btn btn-ghost" aria-label="ย้อนกลับ" style={{ padding: 6 }}><ArrowLeft size={20} /></Link>
      <div className="text-title" style={{ flex: 1 }}>{title}</div>
    </div>
  )
}

function FirstAidFirst() {
  return (
    <div className="page-container">
      <Seo title="CPR & AED ออนไลน์" path="/cpr" noindex />
      <Header title="CPR & AED ออนไลน์" />
      <div className="card" data-testid="cpr-locked">
        <div className="text-body-strong"><Lock size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />เรียนปฐมพยาบาลให้จบก่อน</div>
        <div className="text-caption" style={{ marginTop: 6 }}>
          ลำดับของคลาส: ปฐมพยาบาล (ทำ Post-test ให้ผ่าน) → CPR & AED ในหน้านี้ → วันอบรมภาคปฏิบัติ ทุกอย่างอยู่ในเว็บนี้เว็บเดียว
        </div>
        <Link to="/" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>ไปเรียนปฐมพยาบาลต่อ</Link>
      </div>
    </div>
  )
}

function CprOverview({ passed, ctx }) {
  const locked = ctx.mode === 'locked'
  const isClass = ctx.mode === 'class'
  const doneCount = CPR_MODULES.filter((m) => passed.has(m.id)).length
  const complete = passed.has(CPR_FINAL_ID)
  const next = CPR_MODULES.find((m) => !passed.has(m.id) && isUnlocked(m.id, passed))
  return (
    <div className="page-container">
      <Seo title="CPR & AED ออนไลน์" path="/cpr" noindex />
      <Header title="CPR & AED ออนไลน์" />
      <div className="card" style={{ borderColor: '#F3C4C4', background: '#FFF7F7' }}>
        <div className="text-body-strong" style={{ color: '#B91C1C' }}>
          <HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {locked ? 'หมวด 5: CPR & AED — ช่วยชีวิตคนหัวใจหยุดเต้น'
            : complete ? 'เรียน CPR & AED จบแล้ว 🎉'
              : `${isClass ? 'ขั้นสุดท้ายของคลาส — ' : ''}เรียนไปแล้ว ${doneCount}/7 บท`}
        </div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          {locked
            ? 'CPR ผู้ใหญ่/ทารก, สำลัก, การใช้เครื่อง AED — วิดีโอสั้น 6 บท + ข้อสอบปลายภาค ผ่านแล้วได้ใบประกาศ CPR & AED ออนไลน์ของ JIA (มี QR ตรวจสอบได้)'
            : complete
              ? (isClass ? 'ครูเห็นแล้วว่าคุณพร้อม — เปิด QR ของฉันไปวันอบรมภาคปฏิบัติได้เลย' : 'รับใบประกาศ CPR & AED ด้านล่างได้เลย')
              : 'ดูวิดีโอแต่ละบทแล้วทำแบบทดสอบ 5 ข้อให้ได้ 80% ขึ้นไป ครบ 6 บทแล้วสอบปลายภาค 10 ข้อ'}
        </div>
        {locked ? null : complete ? (isClass && (
          <Link to="/my-qr" className="btn btn-primary btn-block" style={{ marginTop: 12 }}><QrCode size={16} /> เปิด QR ของฉัน</Link>
        )) : next && (
          <Link to={`/cpr/${next.id}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}
            onClick={() => phCapture('cpr_module_open', { module_id: next.id, source: 'overview_next' })}>
            {doneCount === 0 ? 'เริ่มบทที่ 1' : `เรียนต่อ: ${next.short}`}
          </Link>
        )}
      </div>

      {locked && (
        <>
          <ChapterUnlockCard chapter={CPR_CHAPTER} />
          <div className="text-caption" style={{ marginTop: 8, textAlign: 'center' }}>
            อยู่ในคลาสรวม CPR + ปฐมพยาบาล? <Link to="/join">เข้าคลาสด้วยรหัสคลาส</Link> แล้วเรียนฟรี
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {CPR_MODULES.map((m) => {
          const ok = !locked && isUnlocked(m.id, passed)
          const dn = passed.has(m.id)
          const inner = (
            <>
              {dn ? <CheckCircle2 size={20} color="#347053" /> : ok ? <PlayCircle size={20} color="#B91C1C" /> : <Lock size={20} color="#999" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-body-strong">{m.title}</div>
                <div className="text-caption">{m.vid ? `${m.desc} · ${Math.ceil(m.dur / 60)} นาที` : m.desc}</div>
              </div>
            </>
          )
          const style = { display: 'flex', alignItems: 'center', gap: 10, padding: 12, textDecoration: 'none', color: 'inherit', opacity: ok ? 1 : 0.6 }
          return ok
            ? <Link key={m.id} to={`/cpr/${m.id}`} className="card" style={style} data-testid={`cpr-module-${m.id}`}>{inner}</Link>
            : <div key={m.id} className="card" style={style} data-testid={`cpr-module-${m.id}`}>{inner}</div>
        })}
      </div>

      {complete && <CprCertificate />}

      <Link to="/cpr/guide" className="btn btn-ghost btn-block" style={{ marginTop: 12, fontSize: 13 }} data-testid="cpr-guide-link">
        ▶ วิดีโอ + คู่มือ: วิธีเรียนและรับใบประกาศ CPR
      </Link>
      {!locked && (
        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 4, fontSize: 13 }} onClick={ctx.refresh} disabled={ctx.checking}>
          <RefreshCw size={13} /> {ctx.checking ? 'กำลังเช็ค…' : 'เช็คความคืบหน้าอีกครั้ง'}
        </button>
      )}
    </div>
  )
}

function CprModule({ mod, passed, ctx }) {
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const { session } = useAuthSession()
  const isFinal = !mod.vid
  const alreadyDone = passed.has(mod.id)
  const [watched, setWatched] = useState(alreadyDone || isFinal)
  const [quiz, setQuiz] = useState(null)
  const [ans, setAns] = useState({})
  const [result, setResult] = useState(null)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')
  // สอบไม่ผ่าน → ต้องดูวิดีโอใหม่ก่อนสอบอีกครั้ง (เหมือน cpr.morroo.com) — เปลี่ยน key ให้ player เริ่มนับใหม่
  const [videoKey, setVideoKey] = useState(0)
  const topRef = useRef(null)
  const rewatch = () => {
    setQuiz(null); setResult(null); setAns({}); setWatched(false); setVideoKey((k) => k + 1)
    phCapture('cpr_rewatch', { module_id: mod.id })
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const begin = useCallback(() => {
    setQuiz(drawQuiz(mod)); setAns({}); setResult(null); setError('')
    phCapture('cpr_quiz_start', { module_id: mod.id })
  }, [mod])

  const nextMod = CPR_MODULES.find((m) => m.id === mod.id + 1)

  const submit = async () => {
    if (!quiz || Object.keys(ans).length < quiz.length) return
    setGrading(true); setError('')
    try {
      const resp = await fetch('/api/cpr/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          code: ctx.code,
          name: learner.name || '',
          phone: learner.phone || '',
          learnerId: learner.id,
          moduleId: mod.id,
          questions: quiz.map((q) => q.i),
          answers: quiz.map((q, i) => q.order[ans[i]]),
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setError(body.error || 'ตรวจคำตอบไม่สำเร็จ กรุณาลองใหม่'); return }
      const corrects = Array.isArray(body.corrects) ? quiz.map((q, i) => q.order.indexOf(body.corrects[i])) : null
      setResult({ ...body, corrects })
      phCapture('cpr_quiz_result', { module_id: mod.id, score: body.score, passed: body.passed, is_final: isFinal })
      if (body.passed) {
        const prev = learner.cprScoresCode === ctx.scopeKey ? learner.cprScores || {} : {}
        updateLearner({ cprScores: { ...prev, [mod.id]: Math.max(prev[mod.id] || 0, body.score) }, cprScoresCode: ctx.scopeKey })
        if (isFinal) phCapture('cpr_course_complete', { score: body.score })
        ctx.refresh()
      }
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setError('ตรวจคำตอบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    } finally {
      setGrading(false)
    }
  }

  // ข้อสอบปลายภาคต้องล็อกอิน (ผลเข้าระบบกลาง JIA → ใบประกาศ CPR) — ยังไม่ล็อกอินให้ล็อกอินก่อน
  if (isFinal && !session) {
    return (
      <div className="page-container">
        <Header title={mod.title} back="/cpr" />
        <LineLoginGate inline title="เข้าสู่ระบบก่อนสอบปลายภาค CPR" source="cpr_final" returnTo={`/cpr/${mod.id}`} />
      </div>
    )
  }

  return (
    <div className="page-container" ref={topRef}>
      <Seo title={mod.title} path={`/cpr/${mod.id}`} noindex />
      <Header title={mod.title} back="/cpr" />

      {result && (
        <div className="card" data-testid="cpr-quiz-result"
          style={{ marginBottom: 12, borderColor: result.passed ? '#9BC7A9' : '#E8B4AC', background: result.passed ? '#F1F8F3' : '#FDF3F1' }}>
          <div className="text-title">{result.passed ? 'ผ่านแล้ว 🎉' : 'ยังไม่ผ่าน'} — {result.score}%</div>
          <div className="text-caption">ตอบถูก {result.correct}/{result.total} ข้อ (ต้องได้ 80% ขึ้นไป)</div>
          {result.passed && ENCOURAGE[mod.id] && (
            <div className="text-body-strong" style={{ marginTop: 8, color: '#347053' }} data-testid="cpr-encourage">{ENCOURAGE[mod.id]}</div>
          )}
          {!result.passed && (
            <div className="text-caption" style={{ marginTop: 6 }}>
              {isFinal ? 'ไม่เป็นไร ทบทวนบทเรียนแล้วลองใหม่ได้ (สอบได้วันละ 5 ครั้ง)' : 'ไม่เป็นไร ทบทวนวิดีโออีกครั้ง แล้วสอบใหม่ได้เลย'}
            </div>
          )}
          {result.passed ? (
            isFinal ? (
              <Link to="/cpr" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>รับใบประกาศ CPR & ดูขั้นต่อไป</Link>
            ) : (
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }}
                onClick={() => navigate(nextMod ? `/cpr/${nextMod.id}` : '/cpr')}>
                {nextMod ? `ไปต่อ: ${nextMod.title}` : 'กลับหน้าคอร์ส'}
              </button>
            )
          ) : (
            isFinal ? (
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={begin}>ทำข้อสอบใหม่</button>
            ) : (
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={rewatch} data-testid="cpr-rewatch">
                ← กลับดูวิดีโอใหม่แล้วสอบอีกครั้ง
              </button>
            )
          )}
        </div>
      )}

      {mod.vid && !quiz && (
        <>
          <YouTubeLessonPlayer videoId={mod.vid} orientation="landscape" resetKey={videoKey} onWatched={() => setWatched(true)} />
          <div className="text-caption" style={{ marginTop: 8 }}>{mod.desc}</div>
        </>
      )}

      {!quiz && (
        <div className="card" style={{ marginTop: 12 }}>
          {isFinal
            ? <div className="text-caption">ข้อสอบปลายภาค 10 ข้อ สุ่มจากทุกบท ต้องได้ 80% ขึ้นไป (สอบได้วันละ 5 ครั้ง) — ผ่านแล้วได้ใบประกาศ CPR & AED ออนไลน์ของ JIA</div>
            : <div className="text-caption">{watched ? 'ดูวิดีโอแล้ว ทำแบบทดสอบ 5 ข้อได้เลย' : 'ดูวิดีโอให้จบก่อน แล้วปุ่มทำแบบทดสอบจะเปิดให้'}</div>}
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={!watched} onClick={begin}
            data-testid="cpr-quiz-start">
            {isFinal ? 'เริ่มสอบปลายภาค' : alreadyDone ? 'ทำแบบทดสอบอีกครั้ง' : 'ทำแบบทดสอบ'}
          </button>
        </div>
      )}

      {quiz && !result?.passed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: result ? 0 : 4 }}>
          {quiz.map((q, qi) => (
            <div key={`${q.i}`} className="card">
              <div className="text-headline" style={{ marginBottom: 10 }}>{qi + 1}. {q.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.c.map((choice, ci) => {
                  const selected = ans[qi] === ci
                  const right = result?.corrects && result.corrects[qi] === ci
                  const wrong = result && selected && result.corrects && result.corrects[qi] !== ci
                  let bg = 'var(--color-bg-secondary)'
                  let border = 'var(--color-border)'
                  if (right) { bg = '#E4F2E8'; border = '#347053' }
                  else if (wrong) { bg = '#FBEBE8'; border = '#A0392F' }
                  else if (selected) { bg = 'var(--color-brand-soft)'; border = 'var(--color-brand)' }
                  return (
                    <button key={ci} type="button" disabled={!!result}
                      onClick={() => setAns((a) => ({ ...a, [qi]: ci }))}
                      style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius)', border: `1.5px solid ${border}`, background: bg, color: 'inherit', font: 'inherit', cursor: result ? 'default' : 'pointer' }}>
                      {choice}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {!result && (
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={submit}
              disabled={grading || Object.keys(ans).length < quiz.length} data-testid="cpr-quiz-submit">
              {grading ? 'กำลังตรวจ…' : `ส่งคำตอบ (${Object.keys(ans).length}/${quiz.length})`}
            </button>
          )}
          {error && <div className="callout" style={{ color: '#A0392F' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}

// ใบประกาศ CPR ของระบบกลาง JIA — มีสิทธิ์แล้ว (ผ่านปลายภาคขณะล็อกอิน) ขอรับให้อัตโนมัติครั้งเดียว
// ขอรับไม่สำเร็จ (ส่วนใหญ่เพราะบัตรนักเรียน JIA ยังไม่มีชื่อ) → ให้กรอกชื่อ–นามสกุลลงบัตร แล้วขอรับใหม่
// (แบบเดียวกับหน้าใบประกาศของ cpr.morroo.com) — ไม่ล็อกอิน → ปุ่มล็อกอินแล้วกลับมาหน้านี้
function CprCertificate() {
  const learner = useLearnerStore((s) => s.learner)
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)

  const load = useCallback(async ({ autoClaim }) => {
    let s = await fetchHubCourseCert(HUB_CPR_COURSE_ID)
    if (autoClaim && s?.claimable && !s.cert && !tried.current) {
      tried.current = true
      try {
        await claimHubCourseCertificate(HUB_CPR_COURSE_ID)
        phCapture('hub_cert_claimed', { course: HUB_CPR_COURSE_ID, auto: true })
        s = await fetchHubCourseCert(HUB_CPR_COURSE_ID)
      } catch (e) {
        setError(e.message || 'ขอรับใบประกาศไม่สำเร็จ')
      }
    }
    setState(s || { unavailable: true })
    return s
  }, [])

  const fallbackName = learner?.name || ''
  useEffect(() => {
    // เริ่มแบบ async (ไม่ setState ตรง ๆ ใน effect) — ชื่อตั้งต้นจากบัตรนักเรียน JIA หรือชื่อในเครื่อง
    const t = setTimeout(() => {
      load({ autoClaim: true }).then((s) => setName((s?.profile?.nameTh || fallbackName).trim()))
    }, 0)
    return () => clearTimeout(t)
  }, [load, fallbackName])

  const submit = async (e) => {
    e.preventDefault()
    const n = name.trim()
    if (n.length < 2) { setError('กรุณากรอกชื่อ–นามสกุล'); return }
    setBusy(true); setError('')
    try {
      if (state?.profile) await saveCardName(state.profile, { name: n, phone: state.profile.phone || learner?.phone || '' })
      await claimHubCourseCertificate(HUB_CPR_COURSE_ID)
      phCapture('hub_cert_claimed', { course: HUB_CPR_COURSE_ID, auto: false })
      await load({ autoClaim: false })
    } catch (err) {
      setError(err.message || 'ขอรับใบประกาศไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <div className="card text-caption" style={{ marginTop: 12 }}>กำลังตรวจใบประกาศ CPR ที่ระบบกลาง JIA…</div>
  if (state.cert) return <HubCertificateCard cert={state.cert} courseLabel="CPR & AED" />
  if (state.signedIn === false) {
    return (
      <div style={{ marginTop: 12 }} data-testid="cpr-cert-login">
        <LineLoginGate inline title="เข้าสู่ระบบเพื่อรับใบประกาศ CPR" source="cpr_cert" returnTo="/cpr" />
      </div>
    )
  }
  if (state.claimable) {
    return (
      <form className="card" style={{ marginTop: 12, borderColor: '#9BC7A9', background: '#F1F8F3' }} onSubmit={submit} data-testid="cpr-cert-claim">
        <div className="text-body-strong">ผ่านข้อสอบปลายภาคแล้ว — รับใบประกาศ CPR & AED</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          {state.profile?.nameLocked
            ? 'ชื่อบนใบประกาศใช้ชื่อบนบัตรนักเรียน JIA ที่ยืนยันแล้ว'
            : 'กรอกชื่อ–นามสกุลจริง ชื่อนี้จะอยู่บนบัตรนักเรียน JIA และใบประกาศของคุณ (ตรวจสอบได้ด้วย QR)'}
        </div>
        {!state.profile?.nameLocked && (
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ–นามสกุล"
            autoComplete="name" style={{ width: '100%', marginTop: 10 }} data-testid="cpr-cert-name" />
        )}
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy}>
          {busy ? 'กำลังขอรับ…' : 'รับใบประกาศ CPR'}
        </button>
        {error && <div className="text-caption" style={{ marginTop: 6, color: '#A0392F' }}>{error}</div>}
      </form>
    )
  }
  return (
    <div className="card text-caption" style={{ marginTop: 12 }} data-testid="cpr-cert-pending">
      {state.unavailable
        ? 'ตรวจใบประกาศที่ระบบกลาง JIA ไม่สำเร็จ — ลองเปิดหน้านี้ใหม่ภายหลัง หรือดูที่ class.jiacpr.com'
        : 'ยังไม่มีผลสอบปลายภาค CPR ในบัญชีนี้ — ใบประกาศออกจากข้อสอบปลายภาคที่สอบขณะเข้าสู่ระบบ (บัญชีเดียวกับที่สอบ)'}
    </div>
  )
}
