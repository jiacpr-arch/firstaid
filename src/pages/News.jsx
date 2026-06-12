import { Newspaper } from 'lucide-react'
import CallEmergencyButton from '../components/CallEmergencyButton'
import { JiaAedNewsCard } from '../components/JiaAedNewsFeed'
import { useJiaAedNews } from '../hooks/useJiaAedNews'

export default function News() {
  const items = useJiaAedNews(30)

  return (
    <div className="page-container">
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="text-caption">อัปเดตจาก JiaAED</div>
        <div className="text-display">ข่าวกู้ชีพ/AED</div>
        <div className="text-body text-text-muted" style={{ marginTop: 4 }}>
          ข่าวคัดสรรพร้อมมุมให้ความรู้ — แตะข่าวเพื่ออ่านต่อที่สำนักข่าวต้นฉบับ
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <Newspaper size={28} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
          <div className="text-body-strong">ยังโหลดข่าวไม่ได้</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือดูข่าวทั้งหมดที่{' '}
            <a href="https://jiaaed.com/news" target="_blank" rel="noopener noreferrer">
              jiaaed.com/news
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <JiaAedNewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, marginBottom: 24, textAlign: 'center' }}>
        <a
          href="https://jiaaed.com/news"
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ข่าวคัดสรรโดย JiaAED — ลิขสิทธิ์ข่าวต้นฉบับเป็นของสำนักข่าวที่อ้างอิง
        </a>
      </div>

      <CallEmergencyButton />
    </div>
  )
}
