import { Link } from 'react-router-dom'
import { QrCode, ArrowRight, CheckCircle2, Circle, ExternalLink, AlertTriangle } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { lessons } from '../courses/firstaid/lessons'
import { isPracticeDone, practiceChaptersRemaining, practiceLink, nextLearningStep } from '../utils/practice'
import { useClassCpr, cprCourseUrl } from '../hooks/useClassCpr'

// แบนเนอร์คลาสบนหน้าหลักของนักเรียน (แบบ ACLS class banner + progress card): เห็นชื่อคลาส,
// ขั้นตอนถัดไป (Pre-test → บทเรียน → ฝึกสถานการณ์ → [CPR & AED ออนไลน์] → Post-test → วันอบรมภาคปฏิบัติ)
// และปุ่ม QR ของฉัน — คลาสรวม CPR: เรียน CPR ที่ cpr.morroo.com หลัง Post-test ได้ (ไม่บล็อกแล้ว) ปุ่มด้านบนอยู่ที่ CprTopBar
export default function ClassBanner() {
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  const cpr = useClassCpr()

  if (!learner?.cohortCode) return null

  const lessonsDone = lessons.filter((l) => readLessonIds.has(l.id)).length
  const allLessons = lessons.length > 0 && lessonsDone === lessons.length
  const nextLesson = lessons.find((l) => !readLessonIds.has(l.id))
  const step = nextLearningStep(lessons, readLessonIds, passedScenarioIds)
  // Post-test ปลดล็อกเมื่อเรียนครบ + ฝึกผ่านหมวดละ 1 ฉาก (ExamPage) — ต้องพาไปฝึกก่อน ไม่งั้นกดแล้วเจอหน้าล็อก
  const practiceDone = isPracticeDone(passedScenarioIds)
  const practiceRemaining = practiceChaptersRemaining(passedScenarioIds)

  // คลาสรวม CPR: ต้องเรียน CPR & AED ออนไลน์ให้จบด้วย (เช็คไม่ได้ = ไม่ล็อก แต่ยังเตือน)
  const cprClass = cpr.status !== 'none'
  const cprDone = cpr.status === 'done'
  const cprUrl = cprCourseUrl(cpr.promoCode || learner.cprPromoCode)

  let next
  if (!preTestDone) next = { to: '/pre-test', label: 'ทำ Pre-test' }
  else if (!allLessons && step?.kind === 'practice') next = { to: step.to, label: `ฝึกท้ายหมวด ${step.chapter} ให้ผ่านก่อนเรียนต่อ` }
  else if (!allLessons && nextLesson) next = { to: `/learn/${nextLesson.id}`, label: `เรียนต่อ: ${nextLesson.title}` }
  else if (!practiceDone && !postTestDone) next = { to: practiceLink(passedScenarioIds), label: `ฝึกสถานการณ์ให้ผ่านหมวดละ 1 ฉาก (เหลืออีก ${practiceRemaining} หมวด)` }
  else if (!postTestDone) next = { to: '/post-test', label: 'ทำ Post-test' }
  else if (cpr.status === 'todo') next = { href: cprUrl, label: 'ขั้นสุดท้าย: ไปเรียน CPR & AED ออนไลน์' }
  else next = { to: '/my-qr', label: 'พร้อมแล้ว — เปิด QR ของฉันไปวันอบรมภาคปฏิบัติ' }

  // เหลือแค่ Post-test (คลาสรวม CPR: CPR จบแล้ว หรือเช็คไม่ได้)
  const onlyPostTestLeft = preTestDone && allLessons && practiceDone && !postTestDone
  const trainingDay = cpr.startsOn
    ? new Date(`${cpr.startsOn}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })
    : null

  const steps = [
    ['Pre-test', preTestDone],
    [`บทเรียน ${lessonsDone}/${lessons.length}`, allLessons],
    ['ฝึกสถานการณ์', practiceDone],
    ['Post-test', postTestDone],
    ...(cprClass ? [['CPR & AED ออนไลน์', cprDone]] : []),
  ]

  return (
    <section className="card" style={{ marginBottom: 16, padding: 16, borderColor: '#C4D8C4', background: '#F4F9F4' }} aria-label="คลาสของฉัน">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">คลาสของฉัน</div>
          <div className="text-body-strong">{learner.cohortName || `รหัส ${learner.cohortCode}`}</div>
        </div>
        <Link to="/my-qr" className="btn btn-secondary" style={{ fontSize: 13 }}>
          <QrCode size={14} /> QR ของฉัน
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        {steps.map(([label, done]) => (
          <span key={label} className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: done ? '#347053' : undefined }}>
            {done ? <CheckCircle2 size={14} /> : <Circle size={14} />} {label}
          </span>
        ))}
      </div>
      {/* เรียน+ฝึก+CPR ครบแล้ว เหลือแค่ Post-test — เตือนให้เด่น กันนักเรียนหยุดก่อนขั้นสุดท้าย */}
      {onlyPostTestLeft && (
        <div className="callout" style={{ marginTop: 12, borderColor: '#E3C27A', background: '#FBF3DF' }} data-testid="post-test-reminder">
          <div className="text-body-strong" style={{ color: '#7A5A1F' }}>
            <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {cprClass && !cprDone ? 'ขั้นถัดไป — ทำ Post-test ปฐมพยาบาล' : 'เหลืออีกขั้นเดียว — ทำ Post-test ปฐมพยาบาล'}
          </div>
          <div className="text-caption" style={{ marginTop: 4, color: '#7A5A1F' }}>
            
            ต้องทำ Post-test ให้ผ่าน{trainingDay ? <>ก่อนวันอบรม <b>{trainingDay}</b></> : 'ก่อนวันอบรม'} จึงจะได้ใบประกาศภาคทฤษฎีและพร้อมเข้าอบรมภาคปฏิบัติ
          </div>
        </div>
      )}
      {next.href ? (
        <a href={next.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          {next.label} <ExternalLink size={16} />
        </a>
      ) : (
        <Link to={next.to} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          {next.label} <ArrowRight size={16} />
        </Link>
      )}
    </section>
  )
}
