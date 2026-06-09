import { jsPDF } from 'jspdf'

// Note: jsPDF cannot embed Thai fonts without adding TTF + vfs. For v1 we render
// landscape A4 with Helvetica + transliterated labels — the cert template can be
// upgraded later by registering a Sarabun TTF. The PDF is still printable and
// matches the on-screen preview for now.

export function makeCertPdf({ kind, learnerName, dateStr, code, instructorName, location }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  const accent = kind === 'theory' ? '#16A34A' : '#2563EB'
  doc.setDrawColor(accent)
  doc.setLineWidth(2)
  doc.rect(10, 10, pageW - 20, 200)

  doc.setFontSize(28)
  doc.setTextColor(accent)
  doc.text(kind === 'theory' ? 'Certificate of Completion (Theory)' : 'Certificate of Completion (Practical)',
    pageW / 2, 40, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor('#0F1A2E')
  doc.text('Basic First Aid for Laypersons', pageW / 2, 55, { align: 'center' })
  doc.text('TH-FirstAid-Layperson-2026', pageW / 2, 65, { align: 'center' })

  doc.setFontSize(16)
  doc.text('This is to certify that', pageW / 2, 90, { align: 'center' })

  doc.setFontSize(26)
  doc.setTextColor(accent)
  doc.text(learnerName || '(name)', pageW / 2, 110, { align: 'center' })

  doc.setFontSize(13)
  doc.setTextColor('#0F1A2E')
  const bodyText = kind === 'theory'
    ? 'has successfully completed the online theory training and passed the post-test (>= 80%).'
    : 'has successfully completed the practical hands-on training under supervision.'
  doc.text(bodyText, pageW / 2, 130, { align: 'center', maxWidth: 240 })

  if (kind === 'practical') {
    if (instructorName) doc.text(`Instructor: ${instructorName}`, pageW / 2, 145, { align: 'center' })
    if (location) doc.text(`Location: ${location}`, pageW / 2, 155, { align: 'center' })
  }

  doc.setFontSize(12)
  doc.text(`Issued: ${dateStr}`, 30, 195)
  doc.text(`Code: ${code}`, pageW - 30, 195, { align: 'right' })

  return doc
}

export function downloadCertPdf(args) {
  const doc = makeCertPdf(args)
  doc.save(`firstaid-${args.kind}-${args.code}.pdf`)
}
