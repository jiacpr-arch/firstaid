import { Link } from 'react-router-dom'
import { BookOpen, Map, Activity, Phone, Award, UserCheck, MessageCircle, ChevronRight } from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import JiaAedNewsFeed from '../components/JiaAedNewsFeed'
import LearningPathCard from '../components/LearningPathCard'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { isPracticeDone, practiceChaptersRemaining } from '../utils/practice'
import { lessons } from '../courses/firstaid/lessons'
import { lineInterestUrl, LINE_OA_ID as LINE_ID } from '../utils/lineLinks'

// กดแล้วเปิดแชตพร้อมข้อความ "สนใจเรียน + มาจากหน้าแรกแอป" พิมพ์ไว้ให้ ลูกค้าแค่กดส่ง
const LINE_URL = lineInterestUrl('กดจากหน้าแรกแอป')

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

const QUICK = [
  { to: '/learn', label: 'เริ่มเรียน', desc: '10 บทเรียนสั้น ๆ ประมาณ 1 ชั่วโมง', icon: BookOpen, color: '#16A34A' },
  { to: '/algorithms', label: 'เปิดดูตามอาการ', desc: 'Flowchart ฉุกเฉิน 11 หัวข้อ', icon: Map, color: '#2563EB' },
  { to: '/simulation', label: 'ฝึกสถานการณ์', desc: 'ฝึกตัดสินใจกับเหตุการณ์จำลอง', icon: Activity, color: '#7C3AED' },
  { to: '/certificate', label: 'ใบประกาศของฉัน', desc: 'ดู/ดาวน์โหลดใบประกาศภาคทฤษฎีและปฏิบัติ', icon: Award, color: '#D97706' },
  { to: '/checkin', label: 'เช็คชื่อภาคปฏิบัติ', desc: 'สแกน QR หรือกรอกรหัสจากครูผู้สอน', icon: UserCheck, color: '#0EA5E9' },
]

export default function Home() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const passedScenarioIds = useProgressStore((s) => s.passedScenarioIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  useEnsureProgress(learner?.id)

  const lessonsDone = lessons.filter((l) => readLessonIds.has(l.id)).length
  const allLessonsDone = lessons.length > 0 && lessonsDone === lessons.length
  const practiceDone = isPracticeDone(passedScenarioIds)
  const practiceRemaining = practiceChaptersRemaining(passedScenarioIds)

  const nextLesson = preTestDone ? lessons.find((l) => !readLessonIds.has(l.id)) : null
  const studiedToday = localStorage.getItem('lastStudyDate') === new Date().toISOString().slice(0, 10)

  return (
    <div className="page-container">
      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div className="text-caption">หลักสูตร</div>
        <div className="text-display">ปฐมพยาบาลเบื้องต้น</div>
        <div className="text-body text-text-muted" style={{ marginTop: 4 }}>
          สำหรับประชาชนทั่วไป — เรียนทฤษฎีออนไลน์ ฝึกปฏิบัติกับครูผู้สอน
        </div>
      </div>

      <a
        href="tel:1669"
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#FEF2F2',
          border: '1.5px solid #FCA5A5',
          marginBottom: 16,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: '#DC2626',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Phone size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-headline" style={{ color: '#991B1B' }}>เหตุฉุกเฉิน — โทร 1669</div>
          <div className="text-caption" style={{ color: '#7F1D1D' }}>กดเพื่อโทรทันที</div>
        </div>
      </a>

      <LearningPathCard
        preTestDone={preTestDone}
        lessonsDone={lessonsDone}
        lessonsTotal={lessons.length}
        allLessonsDone={allLessonsDone}
        practiceDone={practiceDone}
        practiceRemaining={practiceRemaining}
        postTestDone={postTestDone}
      />

      {nextLesson && (
        <Link
          to={`/learn/${nextLesson.id}`}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, background: '#EFF6FF', border: '1.5px solid #BFDBFE', textDecoration: 'none' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563EB20', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="text-headline" style={{ color: '#1D4ED8' }}>
              เรียนต่อ — บทที่ {nextLesson.order}
            </div>
            <div className="text-caption">
              {nextLesson.title}{studiedToday ? ' · 🔥 เรียนวันนี้แล้ว' : ''}
            </div>
          </div>
          <ChevronRight size={18} color="#2563EB" />
        </Link>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {QUICK.map(({ to, label, desc, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${color}15`,
              color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="text-headline">{label}</div>
              <div className="text-caption">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fbqTrack('track', 'Lead', {
          content_name: 'cpr_aed_inperson_course',
          source: 'home_line_button',
          channel: 'line',
        })}
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 10,
          background: '#F0FDF4',
          border: '1.5px solid #BBF7D0',
          textDecoration: 'none',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#06C755',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageCircle size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-headline">แอด LINE {LINE_ID} — สนใจเรียน</div>
          <div className="text-caption">กดแล้วส่งข้อความที่พิมพ์ไว้ให้ ทีมงานติดต่อกลับ</div>
        </div>
      </a>

      <JiaAedNewsFeed />

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
        {learner?.name ? `กำลังเรียนในชื่อ ${learner.name}` : 'ยังไม่ได้ตั้งชื่อ — แตะ "ใบประกาศของฉัน" เพื่อกรอกชื่อ'}
      </div>

      <CallEmergencyButton />
    </div>
  )
}
