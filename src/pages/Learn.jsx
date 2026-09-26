import { Link } from 'react-router-dom'
import { BookOpen, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileText, Lock, Activity } from 'lucide-react'
import { lessons, lessonsByChapter } from '../courses/firstaid/lessons'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { isChapterUnlocked, CHAPTER_PRICES } from '../config/pricing'
import { isPracticeDone, practiceChaptersRemaining } from '../utils/practice'
import ProgressBar from '../components/ProgressBar'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { computeBadges } from '../utils/badges'
import { encourage } from '../utils/encouragement'
import Seo from '../components/Seo'
import AccountCard from '../components/AccountCard'
import { itemListJsonLd, breadcrumbJsonLd } from '../lib/seo'

export default function Learn() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const readSet = useProgressStore((s) => s.readLessonIds)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)

  useEnsureProgress(learner?.id)
  const unlockedChapters = useEntitlementStore((s) => s.chapters)
  useEnsureEntitlements()

  const total = lessons.length
  const done = lessons.filter((l) => readSet.has(l.id)).length
  const lessonsLocked = !preTestDone
  const allLessonsDone = total > 0 && done === total
  const practiceDone = isPracticeDone(passedScenarioIds)
  const practiceRemaining = practiceChaptersRemaining(passedScenarioIds)
  // Post-test ปลดล็อกเมื่อ "เรียนครบ" และ "ฝึกผ่านอย่างน้อย 1 ฉากทุกบท"
  const postLocked = !allLessonsDone || !practiceDone
  const earnedBadges = computeBadges({ readLessonIds: readSet, postTestDone })

  // บทถัดไปที่ยังไม่ได้เรียน — ใช้ทำปุ่ม "เรียนต่อ" ให้กลับมาเรียนง่าย
  const nextUnread = !lessonsLocked && !allLessonsDone
    ? lessons.find((l) => !readSet.has(l.id))
    : null

  // ข้อความบอกขั้นตอนถัดไป — บังคับลำดับ Pre-test → เรียน → ฝึก → Post-test
  const flowHint = lessonsLocked
    ? 'ขั้นที่ 1: ทำ Pre-test ก่อน เพื่อปลดล็อกบทเรียน'
    : !allLessonsDone
      ? `ขั้นที่ 2: เรียนให้ครบทุกบท (เหลืออีก ${total - done} บท)`
      : !practiceDone
        ? `ขั้นที่ 3: ฝึกสถานการณ์ให้ผ่านอย่างน้อย 1 ฉากทุกบท (เหลืออีก ${practiceRemaining} บท) เพื่อปลดล็อก Post-test`
        : 'ขั้นที่ 4: พร้อมทำ Post-test เพื่อรับใบประกาศ'

  return (
    <div className="page-container">
      <Seo
        title={`บทเรียนปฐมพยาบาล ${lessons.length} บท — เรียนฟรีออนไลน์ | Jia Training Center`}
        description={`รวมบทเรียนปฐมพยาบาลเบื้องต้น ${lessons.length} บท ครอบคลุม CPR, สำลัก, เลือดออก, แผลไฟไหม้ และเหตุฉุกเฉินอื่น ๆ — เรียนฟรี บทละ 5–10 นาที พร้อมสอบรับใบประกาศ`}
        path="/learn"
        jsonLd={[
          itemListJsonLd(lessons.map((l) => `/learn/${l.id}`)),
          breadcrumbJsonLd([
            { name: 'หน้าแรก', path: '/' },
            { name: 'บทเรียน', path: '/learn' },
          ]),
        ]}
      />
      <header style={{ marginTop: 8 }}>
        <div className="text-eyebrow">{total} lessons · {lessonsByChapter.length} chapters</div>
        <h1 className="text-display" style={{ margin: 0 }}>บทเรียน</h1>
      </header>

      <AccountCard style={{ marginTop: 12 }} />

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
        {/* เรียนครบแล้วแต่ยังฝึกไม่ครบ → ดันให้ไปฝึกก่อน (ขั้นก่อน Post-test) */}
        {allLessonsDone && !practiceDone && (
          <Link to="/simulation" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <Activity size={16} /> ไปฝึกสถานการณ์ (เหลืออีก {practiceRemaining} บท)
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
              <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F7EFDF', border: '1px solid #E9D9B7', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#7A5A1F' }}>
                {b.emoji} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {lessonsByChapter.map((ch) => {
        const chTotal = ch.lessons.length
        const chDone = ch.lessons.filter((l) => readSet.has(l.id)).length
        const chMinutes = ch.lessons.reduce((sum, l) => sum + l.minutes, 0)
        // ราคาปลดล็อกคิดต่อ "หมวด" ไม่ใช่ต่อบท — โชว์ครั้งเดียวที่หัวหมวด ไม่ติดซ้ำทุกบทข้างล่าง
        const chapterPaidLocked = !lessonsLocked && !isChapterUnlocked(ch.id, unlockedChapters)
        const chComplete = chTotal > 0 && chDone === chTotal
        return (
          <section key={ch.id} className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderBottom: '1px solid var(--color-border)',
              background: chComplete ? '#E5F0E5' : undefined,
            }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 26, lineHeight: 1, color: chComplete ? '#366749' : 'var(--color-brand)' }}>
                {ch.id}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="text-body-strong" style={{ margin: 0 }}>{ch.title}</h2>
                <div className="text-caption" style={{ fontSize: 12, color: chComplete ? '#366749' : undefined }}>
                  {chComplete ? `เรียนครบ ${chTotal} บทแล้ว` : `${chDone} / ${chTotal} บท · ${chMinutes} นาที`}
                </div>
              </div>
              {chapterPaidLocked && <span className="badge badge-brand">฿{CHAPTER_PRICES[ch.id]} ทั้งหมวด</span>}
            </div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ch.lessons.map((l, i) => {
                const isRead = readSet.has(l.id)
                // ปลดล็อกด้วยการซื้อ (แยกจาก lessonsLocked ที่ล็อกด้วยลำดับ Pre-test) — หมวด 1 ฟรีเสมอ
                const paidLocked = !lessonsLocked && !isChapterUnlocked(l.chapter, unlockedChapters)
                const locked = lessonsLocked || paidLocked
                const rowStyle = {
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid #EDF1EC',
                }
                const inner = (
                  <>
                    <span style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: isRead && !locked ? '#E2F0E3' : '#F0F1EB',
                      color: isRead && !locked ? '#407048' : '#5F6F5D',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                    }}>
                      {locked
                        ? <Lock size={15} strokeWidth={1.8} aria-label="ล็อกอยู่" />
                        : isRead ? <Check size={16} strokeWidth={2.4} aria-label="เรียนแล้ว" /> : String(l.order).padStart(2, '0')}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45 }}>{l.title}</span>
                      <span className="text-caption" style={{ fontSize: 12 }}>{l.summary} · {l.minutes} นาที</span>
                    </span>
                    {!locked && <ChevronRight size={18} strokeWidth={1.6} color="var(--color-brand)" style={{ flexShrink: 0 }} />}
                  </>
                )
                if (lessonsLocked) {
                  return (
                    <li key={l.id} style={{ ...rowStyle, color: 'var(--color-text-secondary)', cursor: 'not-allowed' }} aria-disabled="true">
                      {inner}
                    </li>
                  )
                }
                return (
                  <li key={l.id}>
                    <Link to={`/learn/${l.id}`} style={{ ...rowStyle, opacity: paidLocked ? 0.8 : 1 }}>
                      {inner}
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
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
