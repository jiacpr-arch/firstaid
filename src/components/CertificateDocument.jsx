import { CERT_KINDS, CERT_LOGO_SRC, CERT_ORG_NAME } from '../courses/firstaid/cert'

// Fixed-size, print-grade certificate used as the SINGLE source of truth for both
// the PNG and PDF exports (see ../utils/certImage.js). It is rendered off-screen at
// exactly A4-landscape proportions (1123×794 px ≈ 96dpi), captured once to a PNG, and
// that same bitmap is reused for the PDF — so the two downloads are pixel-identical.
//
// Inline styles only (no Tailwind utility classes) so html-to-image inlines everything
// cleanly. Colours are the literal brand-token hex values from index.css.
export const CERT_DOC_WIDTH = 1123
export const CERT_DOC_HEIGHT = 794

const INK = '#0F1A2E'
const MUTED = '#7A8699'

export default function CertificateDocument({
  kind,
  learnerName,
  dateStr,
  code,
  instructorName,
  location,
  logoSrc = CERT_LOGO_SRC,
}) {
  const tmpl = CERT_KINDS[kind] || CERT_KINDS.theory
  const accent = tmpl.accent

  return (
    <div
      style={{
        width: CERT_DOC_WIDTH,
        height: CERT_DOC_HEIGHT,
        background: '#FFFFFF',
        position: 'relative',
        fontFamily: "'Noto Sans Thai', -apple-system, system-ui, sans-serif",
        color: INK,
        overflow: 'hidden',
      }}
    >
      {/* Accent frame */}
      <div
        style={{
          position: 'absolute',
          inset: 18,
          border: `4px solid ${accent}`,
          borderRadius: 10,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 28,
          border: `1px solid ${accent}55`,
          borderRadius: 6,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 28,
          padding: '44px 72px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <img src={logoSrc} alt={CERT_ORG_NAME} style={{ height: 132, objectFit: 'contain' }} />

        <div
          style={{
            marginTop: 14,
            fontSize: 30,
            fontWeight: 800,
            color: accent,
            letterSpacing: '0.02em',
          }}
        >
          {tmpl.title}
        </div>
        <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: INK }}>
          {tmpl.subtitle}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: MUTED, letterSpacing: '0.18em' }}>
          TH-FirstAid-Layperson-2026
        </div>

        <div style={{ marginTop: 24, fontSize: 16, color: INK }}>มอบให้แก่</div>
        <div style={{ marginTop: 6, fontSize: 44, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
          {learnerName || '—'}
        </div>

        <div style={{ marginTop: 14, fontSize: 16, color: INK, maxWidth: 640, lineHeight: 1.55 }}>
          {tmpl.description}
        </div>

        {kind === 'practical' && (instructorName || location) && (
          <div style={{ marginTop: 12, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
            {instructorName && <div>ครูผู้สอน: {instructorName}</div>}
            {location && <div>สถานที่: {location}</div>}
          </div>
        )}
      </div>

      {/* Footer: signature (left) + issue date / verification code (right) */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          bottom: 64,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 220, borderTop: `1.5px solid ${INK}` }} />
          <div style={{ marginTop: 6, fontSize: 13, color: INK }}>
            {kind === 'practical' && instructorName ? instructorName : CERT_ORG_NAME}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>ผู้ออกใบประกาศ</div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
          <div>ออกเมื่อ {dateStr}</div>
          <div>
            รหัสตรวจสอบ <span style={{ color: INK, fontWeight: 700 }}>{code}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
