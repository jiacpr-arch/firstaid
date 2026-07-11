import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Lock } from 'lucide-react'

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
      desc: allLessonsDone ? 'เรียนครบแล้ว' : `เรียนไปแล้ว ${lessonsDone}/${lessonsTotal} บท`,
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
    },
  ]

  // ขั้นแรกที่ยังไม่เสร็จ = ขั้นปัจจุบัน
  const currentIdx = steps.findIndex((s) => !s.done)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="text-headline" style={{ marginBottom: 2 }}>ขั้นตอนการเรียน</div>
      <div className="text-caption" style={{ marginBottom: 12 }}>
        ทำตามลำดับ 1 → 5 เพื่อรับใบประกาศ
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx
          const isLocked = currentIdx !== -1 && i > currentIdx && !s.done
          const badge = s.done ? (
            <CheckCircle2 size={20} color="#10B981" />
          ) : isLocked ? (
            <Lock size={16} color="var(--color-text-secondary)" />
          ) : (
            <span style={{ fontWeight: 700, color: isCurrent ? 'var(--color-brand-dark)' : 'var(--color-text-secondary)' }}>
              {i + 1}
            </span>
          )

          const row = (
            <>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? '#D1FAE5' : isCurrent ? 'var(--color-brand-soft)' : 'var(--color-bg-tertiary)',
              }}>
                {badge}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-body-strong" style={{ color: isLocked ? 'var(--color-text-secondary)' : undefined }}>
                  {s.label}
                </div>
                <div className="text-caption">{s.desc}</div>
              </div>
              {isCurrent && (
                <span className="btn btn-primary" style={{ flexShrink: 0, padding: '6px 12px', fontSize: 13 }}>
                  {s.cta} <ChevronRight size={14} />
                </span>
              )}
            </>
          )

          const baseStyle = {
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 10, borderRadius: 'var(--radius)',
            border: isCurrent ? '1.5px solid var(--color-brand)' : '1px solid transparent',
            background: isCurrent ? 'var(--color-brand-soft)' : 'transparent',
            opacity: isLocked ? 0.55 : 1,
          }

          // ขั้นที่ล็อกอยู่ = กดไม่ได้ (ยังทำขั้นก่อนหน้าไม่เสร็จ)
          if (isLocked) {
            return (
              <div key={s.to} style={{ ...baseStyle, cursor: 'not-allowed' }} aria-disabled="true">
                {row}
              </div>
            )
          }
          return (
            <Link key={s.to} to={s.to} style={{ ...baseStyle, textDecoration: 'none' }}>
              {row}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
