import { useEffect } from 'react'
import { Phone, MessageCircle, Sparkles, Users, Award } from 'lucide-react'

const PHONE_NUMBER = '0909791212'
const PHONE_DISPLAY = '090-979-1212'
const LINE_URL = 'https://line.me/R/ti/p/@jiacpr'
const LINE_DISPLAY = '@jiacpr'
const ORG_NAME = 'Jia Training Center'

// ยิง event อย่างปลอดภัย — fbq อาจยังไม่โหลด/ถูก ad blocker ปิด ห้ามพังแอป
function fbqTrack(...args) {
  try {
    window.fbq?.(...args)
  } catch {
    /* tracking ห้ามพังแอป */
  }
}

// การ์ดชวนต่อยอด แสดงหลังผู้เรียนได้ใบประกาศแล้ว — ชวนไปอบรม CPR & AED
// ภาคปฏิบัติกับหุ่นจริงกับ Jia Training Center
export default function CertUpsellCard() {
  useEffect(() => {
    fbqTrack('trackCustom', 'CertificateUpsellView')
  }, [])

  const onCtaClick = (channel) => {
    fbqTrack('track', 'Lead', {
      content_name: 'cpr_aed_inperson_course',
      source: 'cert_upsell_card',
      channel,
    })
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #16A34A 0%, #059669 55%, #047857 100%)',
        border: 'none',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', top: -60, right: -48, width: 180, height: 180,
          borderRadius: '50%', opacity: 0.22,
          background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px',
              background: 'rgba(255,255,255,0.2)', borderRadius: 999,
            }}>
              ยินดีด้วย! คุณได้ใบเซอร์แล้ว
            </div>
            <div className="text-title" style={{ color: '#fff', marginTop: 6 }}>
              ต่อยอดด้วยการอบรม CPR &amp; AED
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              เรียนกับหุ่นจริง · ฝึกมือจริง · กับ {ORG_NAME}
            </div>
          </div>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
            <Users size={14} style={{ flexShrink: 0 }} />
            สอนสด กลุ่มเล็ก ครูดูแลใกล้ชิด ฝึกกับหุ่น CPR และเครื่อง AED
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
            <Award size={14} style={{ flexShrink: 0 }} />
            รับใบรับรองผ่านการอบรมภาคปฏิบัติ
          </li>
        </ul>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 14 }}>
          สนใจสอบถาม / จัดอบรมโดย {ORG_NAME}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <a
            href={`tel:${PHONE_NUMBER}`}
            onClick={() => onCtaClick('phone')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 12px', borderRadius: 10, background: '#fff', color: '#047857',
              fontWeight: 800, fontSize: 13, textDecoration: 'none',
            }}
          >
            <Phone size={15} /> โทร {PHONE_DISPLAY}
          </a>
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onCtaClick('line')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 12px', borderRadius: 10, background: '#06C755', color: '#fff',
              fontWeight: 800, fontSize: 13, textDecoration: 'none',
            }}
          >
            <MessageCircle size={15} /> LINE {LINE_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  )
}
