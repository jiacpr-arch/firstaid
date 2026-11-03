import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Gamepad2, LayoutGrid, Lock } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { scenarios } from '../courses/firstaid/scenarios'
import { chapters, lessons } from '../courses/firstaid/lessons'
import { chapterPracticeLock, nextLearningStep } from '../utils/practice'
import CallEmergencyButton from '../components/CallEmergencyButton'
import Seo from '../components/Seo'
import { itemListJsonLd, breadcrumbJsonLd } from '../lib/seo'

// จัดกลุ่มสถานการณ์ตามบท (chapter) เพื่อให้ "ฝึก" เรียงตรงกับ "บทเรียน"
const grouped = chapters.map((c) => ({
  ...c,
  scenarios: scenarios.filter((s) => s.chapter === c.id),
}))
// ฉากที่ไม่ได้ระบุบท (ถ้ามี) เก็บไว้ท้ายสุด
const ungrouped = scenarios.filter((s) => !chapters.some((c) => c.id === s.chapter))

function ScenarioCard({ s, passed = false }) {
  return (
    <Link
      to={`/simulation/${s.id}`}
      className="card card-hover"
      style={{ display: 'flex', alignItems: 'center', gap: 14 }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${s.color}14`, color: s.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Activity size={20} strokeWidth={1.6} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {s.title}
        {passed && <CheckCircle2 size={16} color="#347053" aria-label="ผ่านแล้ว" style={{ flexShrink: 0 }} />}
        {s.bonus && (
          <span
            className="text-caption"
            style={{
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            ฉากเสริม
          </span>
        )}
      </div>
      <div className="text-caption">{s.summary}</div>
      <div className="text-caption" style={{ fontSize: 12 }}>{s.minutes} นาที · {s.steps.length} ข้อตัดสินใจ</div>
      </span>
      <ChevronRight size={18} strokeWidth={1.6} color="var(--color-brand)" style={{ flexShrink: 0 }} />
    </Link>
  )
}

function LockedChapter({ lock }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-secondary)' }}>
      <Lock size={20} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="text-body-strong">เรียนหมวดนี้ให้จบก่อน</div>
        <div className="text-caption">
          {lock.reason === 'pretest' ? 'ทำ Pre-test แล้วเริ่มเรียนบทที่ 1 ก่อน' : `เหลือบทที่ ${lock.lesson.order} ${lock.lesson.title}`}
        </div>
      </div>
      <Link to={lock.reason === 'pretest' ? '/pre-test' : `/learn/${lock.lesson.id}`} className="btn btn-primary" style={{ fontSize: 13, flexShrink: 0 }}>
        {lock.reason === 'pretest' ? 'ทำ Pre-test' : 'ไปเรียน'}
      </Link>
    </div>
  )
}

export default function SimulationSelect() {
  const learner = useLearnerStore((st) => st.learner)
  const passedScenarioIds = useProgressStore((st) => st.passedScenarioIds)
  const readLessonIds = useProgressStore((st) => st.readLessonIds)
  const preTestDone = useProgressStore((st) => st.preTestDone)
  const progressLoaded = useProgressStore((st) => st.loaded)
  useEnsureProgress(learner?.id)
  // นักเรียนในคลาส: ล็อกหมวดที่ยังเรียนไม่ครบ + บอกขั้นถัดไป (รอโหลดความก้าวหน้าก่อนตัดสิน)
  const inClass = !!learner?.cohortCode && progressLoaded
  const lockOf = (chapterId) => chapterPracticeLock(chapterId, { inClass, preTestDone, readLessonIds, allLessons: lessons })
  const step = inClass && preTestDone ? nextLearningStep(lessons, readLessonIds, passedScenarioIds) : null
  // ?chapter=N — มาจากปุ่ม "ฝึกท้ายหมวด" / "ไปฝึกสถานการณ์" → เลื่อนไปหมวดนั้นเลย ไม่ต้องไล่จากหมวด 1
  const [searchParams] = useSearchParams()
  // ฝึกท้ายหมวด: แสดงเฉพาะฉากของหมวดนั้น (เดิมโชว์ทุกหมวดแล้วเลื่อนไป — ผู้เรียนกดหมวดอื่นแล้วสับสน)
  // เข้าจากเมนู "ฝึก" ตรง ๆ (ไม่มี ?chapter) ยังเห็นครบทุกหมวดเหมือนเดิม
  const focusChapter = Number(searchParams.get('chapter')) || null
  const focus = focusChapter ? grouped.find((c) => c.id === focusChapter && c.scenarios.length > 0) : null
  const shownChapters = focus ? [focus] : grouped
  useEffect(() => { if (focus) window.scrollTo(0, 0) }, [focus])

  return (
    <div className="page-container">
      <Seo
        title={`สถานการณ์จำลองปฐมพยาบาล ${scenarios.length} ฉาก — ฝึกตัดสินใจฟรี | Jia Training Center`}
        description={`ฝึกตัดสินใจช่วยชีวิตกับสถานการณ์จำลอง ${scenarios.length} ฉาก ครอบคลุมทุกบทเรียนปฐมพยาบาล — ลองผิดลองถูกได้ ก่อนเจอเหตุการณ์จริง`}
        path="/simulation"
        jsonLd={[
          itemListJsonLd(scenarios.map((s) => `/simulation/${s.id}`)),
          breadcrumbJsonLd([
            { name: 'หน้าแรก', path: '/' },
            { name: 'สถานการณ์จำลอง', path: '/simulation' },
          ]),
        ]}
      />
      {focus ? (
        <header style={{ marginTop: 8 }}>
          <Link to="/learn" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
            <ArrowLeft size={16} /> กลับไปบทเรียน
          </Link>
          <div className="text-eyebrow">ฝึกท้ายหมวด {focus.id} · {focus.scenarios.length} ฉาก</div>
          <h1 className="text-display" style={{ margin: 0 }}>{focus.title}</h1>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
            เลือกฉากไหนก็ได้ในหมวดนี้ 1 ฉาก แล้วทำให้ผ่าน (ตอบถูก 70% ขึ้นไป) เพื่อเรียนหมวดถัดไป
          </div>
        </header>
      ) : (
        <header style={{ marginTop: 8 }}>
          <div className="text-eyebrow">Practice · {scenarios.length} ฉาก</div>
          <h1 className="text-display" style={{ margin: 0 }}>สถานการณ์จำลอง</h1>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
            ฝึกตัดสินใจก่อนเจอเหตุจริง — ครอบคลุมครบทุกบทเรียน
          </div>
        </header>
      )}

      {inClass && !preTestDone && (
        <div className="callout" style={{ marginTop: 16 }} data-testid="sim-next-step">
          <div className="text-body-strong">ตอนนี้ต้องทำ Pre-test ก่อน</div>
          <div className="text-caption" style={{ marginTop: 2 }}>ลำดับคลาส: Pre-test → เรียนทีละหมวด → ฝึกท้ายหมวด → Post-test</div>
          <Link to="/pre-test" className="btn btn-primary btn-block" style={{ marginTop: 8 }}>ทำ Pre-test</Link>
        </div>
      )}
      {step?.kind === 'lesson' && (!focus || lockOf(focus.id)) && (
        <div className="callout" style={{ marginTop: 16 }} data-testid="sim-next-step">
          <div className="text-body-strong">ตอนนี้ต้องเรียนบทที่ {step.lesson.order}: {step.lesson.title}</div>
          <div className="text-caption" style={{ marginTop: 2 }}>ฝึกสถานการณ์ได้เมื่อเรียนหมวดนั้นครบทุกบทแล้ว</div>
          <Link to={step.to} className="btn btn-primary btn-block" style={{ marginTop: 8 }}>
            <BookOpen size={16} /> ไปเรียนบทที่ {step.lesson.order}
          </Link>
        </div>
      )}

      {shownChapters.map((c) => (
        c.scenarios.length > 0 && (
          <div key={c.id} id={`chapter-${c.id}`} style={{ marginTop: 20, scrollMarginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              {!focus && <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: 'var(--color-brand)' }}>{c.id}</span>}
              {focus ? <span style={{ flex: 1 }} /> : <h2 className="text-body-strong" style={{ margin: 0, flex: 1 }}>{c.title}</h2>}
              {c.scenarios.some((s) => passedScenarioIds.has(s.id)) && (
                <span className="text-caption" style={{ color: '#347053', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={14} /> หมวดนี้ผ่านแล้ว
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {lockOf(c.id)
                ? <LockedChapter lock={lockOf(c.id)} />
                : c.scenarios.map((s) => <ScenarioCard key={s.id} s={s} passed={passedScenarioIds.has(s.id)} />)}
            </div>
          </div>
        )
      ))}

      {focus && (
        <Link to="/simulation" className="btn btn-ghost btn-block" style={{ marginTop: 20 }}>
          <LayoutGrid size={16} /> ดูสถานการณ์ทุกหมวด
        </Link>
      )}

      {!focus && <Link
        to="/game"
        className="card"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 24,
          background: '#163D3A',
          border: '1px solid #163D3A',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#30544D', color: '#BFDDB3',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Gamepad2 size={22} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-body-strong" style={{ color: '#F8FBF8' }}>โหมดเกม — FIRST AID HERO</div>
          <div className="text-caption" style={{ color: '#C9DCD4' }}>
            ฝึกแบบเกม: จับเวลา เก็บคอมโบ ปลดล็อกเหรียญ (ของแถมสนุกๆ ไม่มีผลต่อใบเซอร์)
          </div>
        </div>
      </Link>}

      {!focus && ungrouped.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="text-body-strong" style={{ marginBottom: 10 }}>อื่นๆ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ungrouped.map((s) => <ScenarioCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      <CallEmergencyButton />
    </div>
  )
}
