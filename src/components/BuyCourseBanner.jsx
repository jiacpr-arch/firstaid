import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard } from 'lucide-react'
import { COURSE_BUNDLE_PRICE } from '../config/pricing'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { track } from '../utils/analytics'

// แถบ "ซื้อทั้งคอร์ส" พาไปหน้า /buy — ซ่อนเมื่อปลดล็อกครบแล้ว (ทั้งคอร์ส + CPR)
// หรือยังโหลดสิทธิ์ไม่เสร็จ (กันกระพริบโชว์ให้คนที่ซื้อแล้ว)
export default function BuyCourseBanner({ source, style }) {
  useEnsureEntitlements()
  const status = useEntitlementStore((s) => s.status)
  const chapters = useEntitlementStore((s) => s.chapters)
  const cpr = useEntitlementStore((s) => s.cpr)
  if (status !== 'ok') return null
  if (chapters.has(0) && cpr) return null
  // อยู่คลาสที่เปิดทุกหมวดแล้ว (chapter 0 แต่ไม่มี CPR) — ไม่ต้องขายทั้งคอร์สซ้ำ
  if (chapters.has(0)) return null

  return (
    <Link
      to="/buy"
      onClick={() => track('cta_click', { source })}
      className="card card-hover"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        border: '2px solid var(--color-brand)', background: 'var(--color-brand-soft)', ...style,
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'var(--color-brand)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CreditCard size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="text-body-strong" style={{ display: 'block' }}>ปลดล็อกทั้งคอร์ส ฿{COURSE_BUNDLE_PRICE}</span>
        <span className="text-caption" style={{ display: 'block' }}>ทุกหมวด + CPR & AED · จ่ายบัตร/PromptPay เรียนได้ทันที</span>
      </span>
      <span className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}>
        ซื้อเลย <ArrowRight size={14} />
      </span>
    </Link>
  )
}
