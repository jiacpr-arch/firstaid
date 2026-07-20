import { useState } from 'react'
import { recordVisitToday } from '../services/streakService'

// แถบสตรีคเข้าเรียนต่อเนื่องบนหน้าแรก — แสดงเมื่อเข้าเรียนตั้งแต่ 2 วันติดขึ้นไป
export default function StreakBadge() {
  // lazy initializer: บันทึกการเข้าวันนี้ครั้งเดียวตอน mount — idempotent
  // (เรียกซ้ำวันเดียวกันคืนค่าเดิม) จึงปลอดภัยแม้ StrictMode render สองรอบ
  const [streak] = useState(() => recordVisitToday())

  if (!streak || streak.count < 2) return null

  const isMilestone = streak.count % 7 === 0

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        background: isMilestone ? '#FFF7ED' : '#FFFBEB',
        border: '1.5px solid #FDE68A',
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 12, background: '#D9770620',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}
        aria-hidden="true"
      >
        🔥
      </div>
      <div style={{ flex: 1 }}>
        <div className="text-caption" style={{ color: '#92400E' }}>
          เข้าเรียนต่อเนื่อง
          {streak.best > streak.count && <span style={{ opacity: 0.7 }}> (สถิติ {streak.best} วัน)</span>}
        </div>
        <div className="text-headline" style={{ color: '#B45309' }}>
          {streak.count} วันติด{isMilestone ? ' · 🎉 ครบสัปดาห์!' : ''}
        </div>
      </div>
    </div>
  )
}
