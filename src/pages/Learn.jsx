import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, ClipboardCheck, FileText, Lock } from 'lucide-react'
import { lessons, lessonsByChapter } from '../courses/firstaid/lessons'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import ProgressBar from '../components/ProgressBar'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { computeBadges } from '../utils/badges'
import { encourage } from '../utils/encouragement'

export default function Learn() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const readSet = useProgressStore((s) => s.readLessonIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)

  useEnsureProgress(learner?.id)

  const total = lessons.length
  const done = lessons.filter((l) => readSet.has(l.id)).length
  const lessonsLocked = !preTestDone
  const allLessonsDone = total > 0 && done === total
  const postLocked = !allLessonsDone
  const earnedBadges = computeBadges({ readLessonIds: readSet, postTestDone })

  // บทถัดไปที่ยังไม่ได้เรียน — ใช้ทำปุ่ม "เรียนต่อ" ให้กลับมาเรียนง่าย
  const nextUnread = !lessonsLocked && !allLessonsDone
    ? lessons.find((l) => !readSet.has(l.id))
    : null

  // ข้อความบอกขั้นตอนถัดไป — บังคับลำดับ Pre-test → เรียน → Post-test
  const flowHint = lessonsLocked
    ? 'ทำ Pre-test ก่อน เพื่อปลดล็อกบทเรียน'
    : postLocked
      ? `เรียนให้ครบทุกบท (เหลืออีก ${total - done} บท) เพื่อปลดล็อก Post-test`
      : 'เรียนครบแล้ว — พร้อมทำ Post-test เพื่อรับใบประกาศ'

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">หลักสูตร</div>
        <div className="text-title">บทเรียน</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="text-body-strong">ความก้าวหน้า</span>
          <span className="text-caption">{done} / {total} บท</span>
        </div>
        <ProgressBar value={done} max={total} />
        {!lessonsLocked && (
          <div className="text-caption" style={{ marginTop: 8, color: 'var(--color-brand-dark)', fontWeight: 600 }}>
            {encourage(done, total)}
          </div>
        )}
        {nextUnread && (
          <Link to={`/learn/${nextUnread.id}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <BookOpen size={16} /> {done > 0 ? 'เรียนต่อ' : 'เริ่มเรียน'}: บทที่ {nextUnread.order} {nextUnread.title}
            <ChevronRight size={16} />
          </Link>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link to="/pre-test" className="btn btn-secondary" style={{ flex: 1 }}>
            <ClipboardCheck size={16} /> Pre-test
            {preTestDone && <CheckCircle2 size={14} style={{ marginLeft: 4 }} />}
          </Link>
          {postLocked ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, opacity: 0.45, cursor: 'not-allowed' }}
              disabled
            >
              <Lock size={16} /> Post-test
            </button>
          ) : (
            <Link to="/post-test" className="btn btn-primary" style={{ flex: 1 }}>
              <FileText size={16} /> Post-test
            </Link>
          )}
        </div>
        <div className="text-caption" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {(lessonsLocked || postLocked) && <Lock size={13} />} {flowHint}
        </div>
        {earnedBadges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {earnedBadges.map((b) => (
              <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                {b.emoji} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {lessonsByChapter.map((ch) => {
        const chTotal = ch.lessons.length
        const chDone = ch.lessons.filter((l) => readSet.has(l.id)).length
        return (
          <div key={ch.id} style={{ marginTop: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 4px',
            }}>
              <div>
                <div className="text-caption" style={{ color: ch.color, fontWeight: 600 }}>
                  บทที่ {ch.id}
                </div>
                <div className="text-body-strong">{ch.title}</div>
              </div>
              <span className="text-caption">{chDone}/{chTotal}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ch.lessons.map((l) => {
                const isRead = readSet.has(l.id)
                const inner = (
                  <>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: lessonsLocked
                        ? 'var(--color-bg-tertiary)'
                        : isRead ? '#D1FAE5' : 'var(--color-bg-tertiary)',
                      color: lessonsLocked
                        ? 'var(--color-text-secondary)'
                        : isRead ? '#065F46' : 'var(--color-text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                    }}>
                      {lessonsLocked
                        ? <Lock size={18} />
                        : isRead ? <CheckCircle2 size={20} /> : <BookOpen size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="text-body-strong">{l.order}. {l.title}</div>
                      <div className="text-caption">{l.summary} • {l.minutes} นาที</div>
                    </div>
                    {!lessonsLocked && isRead && <span className="badge badge-success">เรียนแล้ว</span>}
                  </>
                )
                if (lessonsLocked) {
                  return (
                    <div
                      key={l.id}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.55, cursor: 'not-allowed' }}
                      aria-disabled="true"
                    >
                      {inner}
                    </div>
                  )
                }
                return (
                  <Link
                    key={l.id}
                    to={`/learn/${l.id}`}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    {inner}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: 24, padding: 12, fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        เนื้อหาดัดแปลงจาก: คู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป<br />
        โดย หมอเจี่ย (Jia1669.com)
      </div>

      <CallEmergencyButton />
    </div>
  )
}
