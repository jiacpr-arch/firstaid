import { Link } from 'react-router-dom'
import { Check, ArrowRight, Lock, Award } from 'lucide-react'

// การ์ดลำดับขั้นตอนการเรียน — โชว์ที่หน้าแรกเพื่อให้นักเรียนไม่งงว่าต้องทำอะไรก่อนหลัง
// ลำดับ: Pre-test → เรียน → ฝึก → Post-test → ใบประกาศ
// ขั้นถัดไปที่ยังไม่เสร็จ = ขั้น "ปัจจุบัน" (ไฮไลต์ + มีปุ่มพาไปทำต่อ)
export default function LearningPathCard({
  preTestDone,
  lessonsDone,
  lessonsTotal,
  allLessonsDone,
  practiceDone,
  practiceRemaining,
  postTestDone,
}) {
  const steps = [
    {
      to: '/pre-test',
      label: 'ทำ Pre-test',
      desc: 'แบบทดสอบก่อนเรียน เพื่อปลดล็อกบทเรียน',
      cta: 'เริ่ม Pre-test',
      done: preTestDone,
    },
    {
      to: '/learn',
      label: `เรียนบทเรียน ${lessonsTotal} บท`,
      desc: allLessonsDone ? 'เรียนครบแล้ว' : `เรียนไปแล้ว ${lessonsDone} / ${lessonsTotal} บท`,
      cta: lessonsDone > 0 ? 'เรียนต่อ' : 'เริ่มเรียน',
      done: allLessonsDone,
    },
    {
      to: '/simulation',
      label: 'ฝึกสถานการณ์จำลอง',
      desc: practiceDone
        ? 'ฝึกครบทุกบทแล้ว'
        : `ผ่านอย่างน้อย 1 ฉากในทุกบท (เหลืออีก ${practiceRemaining} บท)`,
      cta: 'ไปฝึก',
      done: practiceDone,
    },
    {
      to: '/post-test',
      label: 'ทำ Post-test',
      desc: 'แบบทดสอบหลังเรียน เพื่อรับใบประกาศภาคทฤษฎี',
      cta: 'เริ่ม Post-test',
      done: postTestDone,
    },
    {
      to: '/certificate',
      label: 'รับใบประกาศภาคทฤษฎี',
      desc: 'ดาวน์โหลดใบประกาศเมื่อสอบผ่าน',
      cta: 'ดูใบประกาศ',
      done: false,
      cert: true,
    },
  ]

  // ขั้นแรกที่ยังไม่เสร็จ = ขั้นปัจจุบัน
  const currentIdx = steps.findIndex((s) => !s.done)
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section className="card" style={{ marginBottom: 16, padding: '18px 18px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <h2 className="text-headline" style={{ margin: 0 }}>เส้นทางสู่ใบประกาศ</h2>
        <span className="text-caption">{doneCount} / {steps.length} ขั้น</span>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx
          const isLocked = currentIdx !== -1 && i > currentIdx && !s.done
          const isLast = i === steps.length - 1

          const badgeStyle = {
            width: 30, height: 30, borderRadius: 999, flexShrink: 0, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }
          const badge = s.done ? (
            <span style={{ ...badgeStyle, background: '#E3EDDF', color: '#347053' }}>
              <Check size={16} strokeWidth={2.4} aria-label="เสร็จแล้ว" />
            </span>
          ) : isCurrent ? (
            <span style={{ ...badgeStyle, background: '#23736A', color: '#fff' }}>{i + 1}</span>
          ) : (
            <span style={{
              ...badgeStyle, border: `1.5px solid ${s.cert ? '#C7B98A' : '#BCCABA'}`,
              color: s.cert ? '#546A50' : 'var(--color-text-muted)',
            }}>
              {s.cert ? <Award size={15} strokeWidth={1.8} aria-hidden="true" /> : i + 1}
            </span>
          )

          const row = (
            <>
              {badge}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, lineHeight: 1.45,
                  fontWeight: isCurrent ? 700 : 400,
                  color: isLocked ? 'var(--color-text-secondary)' : undefined,
                }}>
                  {s.label}
                </div>
                <div className="text-caption">{s.desc}</div>
              </div>
              {isCurrent && (
                <span className="btn btn-primary" style={{ flexShrink: 0, padding: '8px 12px', fontSize: 13 }}>
                  {s.cta} <ArrowRight size={14} strokeWidth={1.8} />
                </span>
              )}
              {isLocked && <Lock size={15} strokeWidth={1.6} color="var(--color-text-muted)" aria-label="ล็อกอยู่" />}
            </>
          )

          const baseStyle = {
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 0',
            borderBottom: isLast ? 'none' : '1px solid #EDF1EC',
            textDecoration: 'none',
          }

          // ขั้นที่ล็อกอยู่ = กดไม่ได้ (ยังทำขั้นก่อนหน้าไม่เสร็จ)
          return (
            <li key={s.to}>
              {isLocked ? (
                <div style={{ ...baseStyle, cursor: 'not-allowed' }} aria-disabled="true">{row}</div>
              ) : (
                <Link to={s.to} style={baseStyle}>{row}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
