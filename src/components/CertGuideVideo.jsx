import { useState } from 'react'
import { Play } from 'lucide-react'
import { track } from '../utils/analytics'

// วิดีโอแนวตั้งสั้น ๆ สอนขั้นตอนรับใบประกาศภาคทฤษฎี + เปิด/พิมพ์/ตรวจสอบที่ JIA Learning Hub
// ไฟล์อยู่ใน Supabase Storage (public bucket lesson-media/cert-guide/) — ข้ามโดเมน จึงต้อง
// crossOrigin="anonymous" ไม่งั้นไฟล์ซับ .vtt ไม่โหลด
// service worker (src/sw.js) ไม่ดัก request ข้ามโดเมน — mp4 แบบ range request วิ่งตรงไป network
export const CERT_GUIDE_BASE = 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/cert-guide/'

const VIDEO = CERT_GUIDE_BASE + 'firstaid-9x16.mp4'
const CAPTIONS = CERT_GUIDE_BASE + 'firstaid.vtt'
const POSTER = CERT_GUIDE_BASE + 'firstaid-poster.jpg'
const TITLE = 'ดูวิดีโอ: ขั้นตอนรับใบประกาศ (1 นาที)'

export default function CertGuideVideo({ style }) {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [posterOk, setPosterOk] = useState(true)

  const start = () => {
    setPlaying(true)
    track('cert_guide_video_play', { source: 'cert_page' })
  }

  return (
    <div className="card" data-testid="cert-guide-video" style={{ marginTop: 16, ...style }}>
      <div className="text-body-strong">{TITLE}</div>
      <div className="text-caption" style={{ marginTop: 2 }}>
        สอบผ่านแล้วรับใบยังไง เปิด / พิมพ์ / ตรวจสอบใบที่ class.jiacpr.com — สรุปครบในคลิปเดียว
      </div>

      <div style={{ maxWidth: 340, margin: '12px auto 0' }}>
        {failed ? (
          <div className="callout callout-info" data-testid="cert-guide-video-error">
            <div className="text-caption">
              ตอนนี้เปิดวิดีโอไม่ได้ ลองใหม่อีกครั้งภายหลัง — หรือทำตามขั้นตอนในการ์ดใบประกาศด้านบนได้เลย
            </div>
          </div>
        ) : playing ? (
          <video
            controls
            playsInline
            autoPlay
            preload="none"
            crossOrigin="anonymous"
            poster={POSTER}
            onError={() => setFailed(true)}
            style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', borderRadius: 12, background: '#000' }}
          >
            <source src={VIDEO} type="video/mp4" onError={() => setFailed(true)} />
            <track kind="captions" src={CAPTIONS} srcLang="th" label="ไทย" default />
          </video>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={TITLE}
            style={{
              position: 'relative', display: 'block', width: '100%', aspectRatio: '9 / 16',
              padding: 0, border: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
              background: '#163D3A',
            }}
          >
            {posterOk && (
              <img src={POSTER} alt="" loading="lazy" onError={() => setPosterOk(false)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            <span style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.18)',
            }}>
              <span style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', color: '#23736A',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              }}>
                <Play size={28} strokeWidth={2} fill="currentColor" style={{ marginLeft: 4 }} />
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
