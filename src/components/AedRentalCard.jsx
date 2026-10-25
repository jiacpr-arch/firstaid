import { track } from '../utils/analytics'

// Owner, 25 ต.ค. 2026: a learner who finishes is already interested, and many come
// from a workplace — point them at the group's AED rental on jiaaed.com.
const AED_RENTAL_URL =
  'https://jiaaed.com/aed/rental?utm_source=firstaid.morroo.com&utm_medium=certificate&utm_campaign=aed_rental'

export default function AedRentalCard({ source }) {
  return (
    <a
      className="card"
      href={AED_RENTAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('aed_rental_click', { source })}
      style={{ display: 'block', marginTop: 16, textDecoration: 'none', color: 'inherit', borderLeft: '4px solid #D97706' }}
    >
      <div className="text-caption">เรียนแล้ว พร้อมช่วยแล้ว — ที่ทำงานของคุณมีเครื่อง AED หรือยัง?</div>
      <div className="text-body-strong" style={{ marginTop: 4 }}>เช่า AED พร้อมทีมดูแล เริ่ม ฿1,830/เดือน</div>
      <div className="text-caption" style={{ marginTop: 6, lineHeight: 1.6 }}>
        เครื่อง Yuwell GPS · เปลี่ยนแบต/แผ่นให้ตลอดสัญญา · เช่ารายวันสำหรับงานอีเวนต์ก็มี
      </div>
      <div style={{ marginTop: 10, fontWeight: 700, color: '#B45309' }}>ดูแผนเช่า AED →</div>
    </a>
  )
}
