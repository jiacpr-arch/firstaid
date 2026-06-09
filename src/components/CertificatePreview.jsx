import { CERT_KINDS } from '../courses/firstaid/cert'

export default function CertificatePreview({ kind, learnerName, dateStr, code, instructorName, location }) {
  const tmpl = CERT_KINDS[kind]
  if (!tmpl) return null
  return (
    <div
      className="card"
      style={{
        border: `2px solid ${tmpl.accent}`,
        textAlign: 'center',
        padding: 28,
      }}
    >
      <div className="text-caption" style={{ color: tmpl.accent, letterSpacing: 4 }}>
        {tmpl.title}
      </div>
      <div className="text-title" style={{ marginTop: 4 }}>{tmpl.subtitle}</div>

      <div className="text-body" style={{ marginTop: 24 }}>มอบให้แก่</div>
      <div className="text-display" style={{ color: tmpl.accent, marginTop: 8, marginBottom: 8 }}>
        {learnerName || '—'}
      </div>
      <div className="text-body" style={{ marginTop: 8, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
        {tmpl.description}
      </div>

      {kind === 'practical' && (
        <div className="text-caption" style={{ marginTop: 16 }}>
          {instructorName && <div>ครูผู้สอน: {instructorName}</div>}
          {location && <div>สถานที่: {location}</div>}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px dashed var(--color-border-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        <span>ออกเมื่อ {dateStr}</span>
        <span>รหัส {code}</span>
      </div>
    </div>
  )
}
