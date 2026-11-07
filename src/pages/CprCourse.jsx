import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, HeartPulse, Lock, PlayCircle, QrCode, RefreshCw } from 'lucide-react'
import { CPR_MODULES, CPR_FINAL_ID, cprDrawCount, cprModule } from '../courses/cpr/modules'
import { useEnsureLearner } from '../hooks/useLearner'
import { useEnsureProgress } from '../hooks/useProgress'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useClassCpr, CPR_PUBLIC_URL } from '../hooks/useClassCpr'
import { useAuthSession } from '../hooks/useAuthSession'
import { authHeader } from '../utils/authHeader'
import { fetchHubCourseCert, claimHubCourseCertificate, HUB_CPR_COURSE_ID } from '../utils/hubCertificate'
import YouTubeLessonPlayer from '../components/YouTubeLessonPlayer'
import LineLoginGate from '../components/LineLoginGate'
import HubCertificateCard from '../components/HubCertificateCard'
import { phCapture } from '../lib/posthog'
import Seo from '../components/Seo'

// คอร์ส CPR & AED ออนไลน์ 7 บท ในเว็บนี้ — สำหรับนักเรียน "คลาสรวม CPR + ปฐมพยาบาล"
// (เดิมต้องข้ามไปเรียนที่ cpr.morroo.com กรอกชื่อ/เบอร์/โค้ดคลาสใหม่ แล้วกลับมาเอา QR ที่นี่ — นักเรียนงง)
// ลำดับ: ปฐมพยาบาล (Post-test ผ่าน) → CPR บท 1–6 (ดูวิดีโอ + แบบทดสอบ 5 ข้อ ผ่าน 80%) → ข้อสอบปลายภาค 10 ข้อ
// ตรวจคำตอบที่ api/cpr/grade.js → grade-quiz (เฉลยอยู่ที่ server) บันทึกลง online_students ให้ครูเห็นเหมือนเดิม
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

// คะแนนรวมจาก server (รวมที่เคยเรียนบน cpr.morroo.com) + ที่เพิ่งผ่านในเครื่อง (server อาจยังไม่ทันอัปเดต)
function usePassed(cpr, learner) {
  return useMemo(() => {
    const s = new Set()
    for (const k of Object.keys(cpr.cpr?.scores || {})) s.add(Number(k))
    const local = learner?.cprScoresCode === learner?.cohortCode ? learner?.cprScores || {} : {}
    for (const k of Object.keys(local)) s.add(Number(k))
    if (cpr.status === 'done') s.add(CPR_FINAL_ID)
    return s
  }, [cpr.cpr?.scores, cpr.status, learner?.cprScores, learner?.cprScoresCode, learner?.cohortCode])
}

const isUnlocked = (id, passed) => {
  if (id === 1) return true
  if (id === CPR_FINAL_ID) return [1, 2, 3, 4, 5, 6].every((x) => passed.has(x))
  return passed.has(id - 1)
}

export default function CprCourse() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  useEnsureProgress(learner?.id)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const progressLoaded = useProgressStore((s) => s.loaded)
  const cpr = useClassCpr()
  const passed = usePassed(cpr, learner)
  const { moduleId } = useParams()
  const mod = moduleId ? cprModule(moduleId) : null

  if (!learner?.cohortCode || cpr.status === 'none') return <NotInClass />
  if (cpr.status === 'loading' || !progressLoaded) {
    return <div className="page-container"><div className="card text-caption" style={{ textAlign: 'center' }}>กำลังโหลดคอร์ส CPR…</div></div>
  }
  if (!postTestDone) return <FirstAidFirst />
  if (mod && isUnlocked(mod.id, passed)) return <CprModule key={mod.id} mod={mod} passed={passed} cpr={cpr} />
  return <CprOverview passed={passed} cpr={cpr} />
}

function Header({ title, back = '/' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Link to={back} className="btn btn-ghost" aria-label="ย้อนกลับ" style={{ padding: 6 }}><ArrowLeft size={20} /></Link>
      <div className="text-title" style={{ flex: 1 }}>{title}</div>
    </div>
  )
}

function NotInClass() {
  return (
    <div className="page-container">
      <Seo title="CPR & AED ออนไลน์" path="/cpr" noindex />
      <Header title="CPR & AED ออนไลน์" />
      <div className="card">
        <div className="text-body-strong"><HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />คอร์สนี้สำหรับนักเรียนคลาสรวม CPR + ปฐมพยาบาล</div>
        <div className="text-caption" style={{ marginTop: 6 }}>
          ถ้าคุณอยู่ในคลาส ให้เข้าคลาสด้วยรหัสคลาสก่อน (เมนู “เข้าคลาส”) — ถ้าอยากเรียน CPR & AED ออนไลน์ด้วยตัวเอง เรียนได้ที่ cpr.morroo.com
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link to="/join" className="btn btn-primary">เข้าคลาส</Link>
          <a href={CPR_PUBLIC_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"
            onClick={() => phCapture('cpr_online_click', { source: 'cpr_page_public', promo: false })}>
            <ExternalLink size={14} /> cpr.morroo.com
          </a>
        </div>
      </div>
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

function CprOverview({ passed, cpr }) {
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
          {complete ? 'เรียน CPR & AED จบแล้ว 🎉' : `ขั้นสุดท้ายของคลาส — เรียนไปแล้ว ${doneCount}/7 บท`}
        </div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          {complete
            ? 'ครูเห็นแล้วว่าคุณพร้อม — เปิด QR ของฉันไปวันอบรมภาคปฏิบัติได้เลย'
            : 'ดูวิดีโอแต่ละบทแล้วทำแบบทดสอบ 5 ข้อให้ได้ 80% ขึ้นไป ครบ 6 บทแล้วสอบปลายภาค 10 ข้อ — เรียนที่นี่ได้เลย ไม่ต้องไปเว็บอื่น'}
        </div>
        {complete ? (
          <Link to="/my-qr" className="btn btn-primary btn-block" style={{ marginTop: 12 }}><QrCode size={16} /> เปิด QR ของฉัน</Link>
        ) : next && (
          <Link to={`/cpr/${next.id}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}
            onClick={() => phCapture('cpr_module_open', { module_id: next.id, source: 'overview_next' })}>
            {doneCount === 0 ? 'เริ่มบทที่ 1' : `เรียนต่อ: ${next.short}`}
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {CPR_MODULES.map((m) => {
          const ok = isUnlocked(m.id, passed)
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

      <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 12, fontSize: 13 }} onClick={cpr.refresh} disabled={cpr.checking}>
        <RefreshCw size={13} /> {cpr.checking ? 'กำลังเช็ค…' : 'เช็คความคืบหน้าอีกครั้ง'}
      </button>
    </div>
  )
}

function CprModule({ mod, passed, cpr }) {
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
  const topRef = useRef(null)

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
          code: learner.cohortCode,
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
        const prev = learner.cprScoresCode === learner.cohortCode ? learner.cprScores || {} : {}
        updateLearner({ cprScores: { ...prev, [mod.id]: Math.max(prev[mod.id] || 0, body.score) }, cprScoresCode: learner.cohortCode })
        if (isFinal) phCapture('cpr_course_complete', { score: body.score })
        cpr.refresh()
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
        <LineLoginGate inline title="เข้าสู่ระบบก่อนสอบปลายภาค CPR" source="cpr_final" />
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
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={begin}>ทำแบบทดสอบใหม่</button>
              {!isFinal && (
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setQuiz(null); setResult(null) }}>ดูวิดีโอทบทวน</button>
              )}
            </div>
          )}
        </div>
      )}

      {mod.vid && !quiz && (
        <>
          <YouTubeLessonPlayer videoId={mod.vid} orientation="landscape" onWatched={() => setWatched(true)} />
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
function CprCertificate() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const tried = useRef(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let s = await fetchHubCourseCert(HUB_CPR_COURSE_ID)
      if (s?.claimable && !s.cert && !tried.current) {
        tried.current = true
        try {
          await claimHubCourseCertificate(HUB_CPR_COURSE_ID)
          phCapture('hub_cert_claimed', { course: HUB_CPR_COURSE_ID, auto: true })
          s = await fetchHubCourseCert(HUB_CPR_COURSE_ID)
        } catch (e) {
          if (!cancelled) setError(e.message || 'ขอรับใบประกาศไม่สำเร็จ')
        }
      }
      if (!cancelled) setState(s || { unavailable: true })
    })()
    return () => { cancelled = true }
  }, [])

  if (!state) return <div className="card text-caption" style={{ marginTop: 12 }}>กำลังตรวจใบประกาศ CPR ที่ระบบกลาง JIA…</div>
  if (state.cert) return <HubCertificateCard cert={state.cert} courseLabel="CPR & AED" />
  return (
    <div className="card text-caption" style={{ marginTop: 12 }} data-testid="cpr-cert-pending">
      {state.signedIn === false
        ? 'เข้าสู่ระบบด้วยบัญชีเดียวกับที่สอบ เพื่อดูใบประกาศ CPR & AED'
        : error || 'ใบประกาศ CPR & AED จะออกจากระบบกลาง JIA หลังผ่านข้อสอบปลายภาค (ขณะเข้าสู่ระบบ) — ถ้ายังไม่ขึ้น ลองเปิดหน้านี้ใหม่ภายหลัง หรือดูที่ class.jiacpr.com'}
    </div>
  )
}
