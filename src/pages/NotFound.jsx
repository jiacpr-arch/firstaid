import { Link } from 'react-router-dom'
import { SearchX, BookOpen, Home } from 'lucide-react'
import Seo from '../components/Seo'

// Soft-404: Vercel rewrite ตอบ 200 เสมอ จึงใช้ noindex บอก Google ให้ตัด URL นี้ทิ้ง
export default function NotFound() {
  return (
    <div className="page-container">
      <Seo title="ไม่พบหน้านี้ — FirstAid by Jia Training Center" noindex path="/404" />
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <SearchX size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
        <div className="text-title">ไม่พบหน้านี้</div>
        <div className="text-body text-text-muted" style={{ marginTop: 8 }}>
          ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
        </div>
      </div>
      <Link to="/" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 24 }}>
        <Home size={18} /> กลับหน้าแรก
      </Link>
      <Link to="/learn" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}>
        <BookOpen size={18} /> ดูบทเรียนทั้งหมด
      </Link>
    </div>
  )
}
