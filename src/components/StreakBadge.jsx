import { useState } from 'react'
import { Flame } from 'lucide-react'
import { recordVisitToday } from '../services/streakService'

// ชิปสตรีคเข้าเรียนต่อเนื่อง — แสดงเมื่อเข้าเรียนตั้งแต่ 2 วันติดขึ้นไป
// วางไว้ที่หัวหน้า Home (ข้างชื่อคอร์ส) แทนการ์ดเต็มแถว
export default function StreakBadge() {
  // lazy initializer: บันทึกการเข้าวันนี้ครั้งเดียวตอน mount — idempotent
  // (เรียกซ้ำวันเดียวกันคืนค่าเดิม) จึงปลอดภัยแม้ StrictMode render สองรอบ
  const [streak] = useState(() => recordVisitToday())

  if (!streak || streak.count < 2) return null

  const isMilestone = streak.count % 7 === 0
  const title = streak.best > streak.count ? `สถิติสูงสุด ${streak.best} วัน` : undefined

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
        height: 32, padding: '0 12px', borderRadius: 999,
        background: isMilestone ? '#F4EAD3' : '#F7EFDF', color: '#7A5A1F',
        fontSize: 13, fontWeight: 700,
      }}
    >
      <Flame size={15} strokeWidth={1.8} aria-hidden="true" />
      เรียนต่อเนื่อง {streak.count} วัน{isMilestone ? ' · ครบสัปดาห์' : ''}
    </span>
  )
}
