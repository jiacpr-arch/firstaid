import { chapterArtwork } from '../config/courseArtwork'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileText, HeartPulse, Lock, Activity } from 'lucide-react'
import { lessons, lessonsByChapter } from '../courses/firstaid/lessons'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { isChapterUnlocked, CHAPTER_PRICES, CPR_CHAPTER, CPR_CHAPTER_TITLE } from '../config/pricing'
import { CPR_MODULES } from '../courses/cpr/modules'
import { useClassCpr } from '../hooks/useClassCpr'
import { isPracticeDone, practiceChaptersRemaining, practiceChapterStatus, practiceLink, practiceGateChapter } from '../utils/practice'
import ProgressBar from '../components/ProgressBar'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { computeBadges } from '../utils/badges'
import { encourage } from '../utils/encouragement'
import Seo from '../components/Seo'
import AccountCard from '../components/AccountCard'
import RealNameCard from '../components/RealNameCard'
import { needsRealName } from '../../api/_lib/realName.js'
import { useAuthSession } from '../hooks/useAuthSession'
import { itemListJsonLd, breadcrumbJsonLd } from '../lib/seo'
import CprTopBar from '../components/CprTopBar'

export default function Learn() {
  const { hash } = useLocation()
  useEffect(() => {
    if (/^#chapter-[1-5]$/.test(hash)) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const { session } = useAuthSession()
  const readSet = useProgressStore((s) => s.readLessonIds)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)

  useEnsureProgress(learner?.id)
  const unlockedChapters = useEntitlementStore((s) => s.chapters)
  useEnsureEntitlements()
  const classCpr = useClassCpr()

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

  // บทถัดไปติดด่านฝึกท้ายหมวดหรือไม่ (null = เรียนต่อได้)
  const nextGate = nextUnread ? practiceGateChapter(nextUnread, readSet, passedScenarioIds) : null

  // ข้อความบอกขั้นตอนถัดไป — บังคับลำดับ Pre-test → เรียน → ฝึก → Post-test
  const flowHint = lessonsLocked
    ? 'ขั้นที่ 1: ทำ Pre-test ก่อน เพื่อปลดล็อกบทเรียน'
    : !allLessonsDone
      ? `ขั้นที่ 2: เรียนให้ครบทุกบท (เหลืออีก ${total - done} บท)`
      : !practiceDone
        ? `ขั้นที่ 3: ฝึกสถานการณ์ให้ผ่านหมวดละ 1 ฉาก (เหลืออีก ${practiceRemaining} หมวด) เพื่อปลดล็อก Post-test`
        : 'ขั้นที่ 4: พร้อมทำ Post-test เพื่อรับใบประกาศ'

  return (
    <div className="page-container course-learn">
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
      <header className="course-learn-header" style={{ marginTop: 8 }}>
        <div className="text-eyebrow">{total + CPR_MODULES.length} lessons · {lessonsByChapter.length + 1} chapters</div>
        <h1 className="text-display" style={{ margin: 0 }}>บทเรียน</h1>
      </header>

      <CprTopBar source="learn_top" style={{ marginTop: 12 }} />
      <AccountCard style={{ marginTop: 12 }} />
      {session && needsRealName(learner) && <RealNameCard source="learn_page" style={{ marginTop: 12 }} />}

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
        {nextUnread && nextGate && (
          <Link to={practiceLink(passedScenarioIds, nextGate)} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <Activity size={16} /> ฝึกสถานการณ์หมวด {nextGate} ให้ผ่าน เพื่อเรียนหมวดถัดไป
            <ChevronRight size={16} />
          </Link>
        )}
        {nextUnread && !nextGate && (
          <Link to={`/learn/${nextUnread.id}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <BookOpen size={16} /> {done > 0 ? 'เรียนต่อ' : 'เริ่มเรียน'}: บทที่ {nextUnread.order} {nextUnread.title}
            <ChevronRight size={16} />
          </Link>
        )}
        {/* เรียนครบแล้วแต่ยังฝึกไม่ครบ → ดันให้ไปฝึกก่อน (ขั้นก่อน Post-test) */}
        {/* สถานะฝึกรายหมวด — หมวดที่เรียนจบแล้วแต่ยังไม่ผ่านฉากฝึก มีปุ่มพาไปหมวดนั้นตรง ๆ
            (รองรับคนที่เรียนจบไปก่อนมีด่านฝึกท้ายหมวดด้วย) */}
        {!lessonsLocked && done > 0 && !practiceDone && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="text-caption">ฝึกสถานการณ์ท้ายหมวด (ผ่านหมวดละ 1 ฉาก)</div>
            {practiceChapterStatus(passedScenarioIds).map((c) => {
              const chapterRead = lessons.filter((l) => l.chapter === c.chapter).every((l) => readSet.has(l.id))
              return (
                <div key={c.chapter} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.done
                    ? <CheckCircle2 size={16} color="#347053" style={{ flexShrink: 0 }} />
                    : <Activity size={16} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />}
                  <span className="text-body" style={{ flex: 1 }}>หมวด {c.chapter} {c.title}</span>
                  {!c.done && chapterRead && (
                    <Link to={practiceLink(passedScenarioIds, c.chapter)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }}>
                      ฝึก
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {allLessonsDone && !practiceDone && (
          <Link to={practiceLink(passedScenarioIds)} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <Activity size={16} /> ไปฝึกสถานการณ์ (เหลืออีก {practiceRemaining} หมวด)
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
              <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F7EFDF', border: '1px solid #E9D9B7', borderRadius: 20, padding: '3px 10px', fontSize: 14, fontWeight: 600, color: '#7A5A1F' }}>
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
          <section key={ch.id} id={`chapter-${ch.id}`} className="card course-chapter-list" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
            <div className="course-chapter-list-cover">
              <img src={chapterArtwork[ch.id].src} alt={chapterArtwork[ch.id].alt} loading="lazy" width="600" height="400" />
              <span>หมวดที่ {ch.id}</span>
            </div>
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
                <div className="text-caption" style={{ fontSize: 14, color: chComplete ? '#366749' : undefined }}>
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
                // ด่านฝึกท้ายหมวด: บทใหม่ในหมวดถัดไปล็อกจนกว่าจะฝึกหมวดก่อนหน้าผ่าน
                const gate = !lessonsLocked && !paidLocked ? practiceGateChapter(l, readSet, passedScenarioIds) : null
                const locked = lessonsLocked || paidLocked || !!gate
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
                      <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.45 }}>{l.title}</span>
                      <span className="text-caption" style={{ fontSize: 14 }}>
                        {gate ? `ฝึกสถานการณ์หมวด ${gate} ให้ผ่านก่อน` : `${l.summary} · ${l.minutes} นาที`}
                      </span>
                    </span>
                    {isRead && !locked && (
                      <span className="badge badge-success" style={{ flexShrink: 0 }}>เสร็จสิ้น</span>
                    )}
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
                    <Link to={gate ? practiceLink(passedScenarioIds, gate) : `/learn/${l.id}`} style={{ ...rowStyle, opacity: paidLocked || gate ? 0.8 : 1 }}>
                      {inner}
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      <CprChapter learner={learner} classCpr={classCpr} unlockedChapters={unlockedChapters} />

      <div style={{ marginTop: 24, padding: 12, fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        เนื้อหาดัดแปลงจาก: คู่มือการปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป<br />
        โดย หมอเจี่ย (Jia1669.com)
      </div>

      <CallEmergencyButton />
    </div>
  )
}

// หมวด 5: CPR & AED (7 บท อยู่ที่หน้า /cpr — src/pages/CprCourse.jsx) — ทุกคนเห็นในหน้าเรียน
// คลาสรวม CPR เรียนฟรี (หลัง Post-test ปฐมพยาบาล), คนทั่วไปปลดล็อกแบบหมวดอื่น (฿99 หรือทั้งคอร์ส)
function CprChapter({ learner, classCpr, unlockedChapters }) {
  const inClass = !!learner?.cohortCode && classCpr.status !== 'none'
  const scopeKey = inClass ? learner.cohortCode : 'paid'
  const local = learner?.cprScoresCode === scopeKey ? learner?.cprScores || {} : {}
  const passed = new Set([...Object.keys(local), ...Object.keys((inClass && classCpr.cpr?.scores) || {})].map(Number))
  if (inClass && classCpr.status === 'done') CPR_MODULES.forEach((m) => passed.add(m.id))
  const paidLocked = !inClass && !isChapterUnlocked(CPR_CHAPTER, unlockedChapters)
  const chDone = CPR_MODULES.filter((m) => passed.has(m.id)).length
  const chComplete = chDone === CPR_MODULES.length
  const minutes = CPR_MODULES.reduce((sum, m) => sum + Math.ceil((m.dur || 300) / 60), 0)
  return (
    <section id={`chapter-${CPR_CHAPTER}`} className="card course-chapter-list" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }} data-testid="cpr-chapter">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderBottom: '1px solid var(--color-border)',
        background: chComplete ? '#E5F0E5' : '#FFF7F7',
      }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 26, lineHeight: 1, color: chComplete ? '#366749' : '#B91C1C' }}>
          {CPR_CHAPTER}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="text-body-strong" style={{ margin: 0 }}>
            <HeartPulse size={16} color="#B91C1C" style={{ verticalAlign: 'middle', marginRight: 4 }} />{CPR_CHAPTER_TITLE}
          </h2>
          <div className="text-caption" style={{ fontSize: 14, color: chComplete ? '#366749' : undefined }}>
            {chComplete ? `เรียนครบ ${CPR_MODULES.length} บทแล้ว` : `${chDone} / ${CPR_MODULES.length} บท · ~${minutes} นาที · มีใบประกาศ CPR`}
            {inClass && !chComplete ? ' · คลาสของคุณเรียนฟรี' : ''}
          </div>
        </div>
        {paidLocked && <span className="badge badge-brand">฿{CHAPTER_PRICES[CPR_CHAPTER]} ทั้งหมวด</span>}
      </div>
      <Link to="/cpr/guide" className="text-caption" style={{ display: 'block', padding: '10px 18px', borderBottom: '1px solid #EDF1EC', fontWeight: 700, color: '#B91C1C' }}
        data-testid="cpr-chapter-guide">
        ▶ ดูวิดีโอวิธีเรียนและรับใบประกาศ CPR (2 นาที)
      </Link>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {CPR_MODULES.map((m, i) => {
          const isDone = passed.has(m.id)
          return (
            <li key={m.id}>
              <Link to={paidLocked ? '/cpr' : `/cpr/${m.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderTop: i === 0 ? 'none' : '1px solid #EDF1EC', opacity: paidLocked ? 0.8 : 1,
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: isDone ? '#E2F0E3' : '#F0F1EB', color: isDone ? '#407048' : '#5F6F5D',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                }}>
                  {paidLocked ? <Lock size={15} strokeWidth={1.8} aria-label="ล็อกอยู่" />
                    : isDone ? <Check size={16} strokeWidth={2.4} aria-label="เรียนแล้ว" /> : String(m.id).padStart(2, '0')}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.45 }}>{m.title}</span>
                  <span className="text-caption" style={{ fontSize: 14 }}>{m.desc}</span>
                </span>
                <ChevronRight size={18} strokeWidth={1.6} color="var(--color-brand)" style={{ flexShrink: 0 }} />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
