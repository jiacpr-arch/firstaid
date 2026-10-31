import { Link } from 'react-router-dom'
import { QrCode, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { lessons } from '../courses/firstaid/lessons'
import { isPracticeDone, practiceChaptersRemaining, practiceLink } from '../utils/practice'

// แบนเนอร์คลาสบนหน้าหลักของนักเรียน (แบบ ACLS class banner + progress card): เห็นชื่อคลาส,
// ขั้นตอนถัดไป (Pre-test → บทเรียน → ฝึกสถานการณ์ → Post-test → วันอบรมภาคปฏิบัติ) และปุ่ม QR ของฉัน
export default function ClassBanner() {
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)

  if (!learner?.cohortCode) return null

  const lessonsDone = lessons.filter((l) => readLessonIds.has(l.id)).length
  const allLessons = lessons.length > 0 && lessonsDone === lessons.length
  const nextLesson = lessons.find((l) => !readLessonIds.has(l.id))
  // Post-test ปลดล็อกเมื่อเรียนครบ + ฝึกผ่านหมวดละ 1 ฉาก (ExamPage) — ต้องพาไปฝึกก่อน ไม่งั้นกดแล้วเจอหน้าล็อก
  const practiceDone = isPracticeDone(passedScenarioIds)
  const practiceRemaining = practiceChaptersRemaining(passedScenarioIds)

  let next
  if (!preTestDone) next = { to: '/pre-test', label: 'ทำ Pre-test' }
  else if (!allLessons && nextLesson) next = { to: `/learn/${nextLesson.id}`, label: `เรียนต่อ: ${nextLesson.title}` }
  else if (!practiceDone && !postTestDone) next = { to: practiceLink(passedScenarioIds), label: `ฝึกสถานการณ์ให้ผ่านหมวดละ 1 ฉาก (เหลืออีก ${practiceRemaining} หมวด)` }
  else if (!postTestDone) next = { to: '/post-test', label: 'ทำ Post-test' }
  else next = { to: '/my-qr', label: 'พร้อมแล้ว — เปิด QR ของฉันไปวันอบรมภาคปฏิบัติ' }

  const steps = [
    ['Pre-test', preTestDone],
    [`บทเรียน ${lessonsDone}/${lessons.length}`, allLessons],
    ['ฝึกสถานการณ์', practiceDone],
    ['Post-test', postTestDone],
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
      <Link to={next.to} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
        {next.label} <ArrowRight size={16} />
      </Link>
    </section>
  )
}
