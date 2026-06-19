import { jsPDF } from 'jspdf'
import { CERT_KINDS } from '../courses/firstaid/cert'

// Renders a landscape A4 certificate with the embedded Sarabun font so Thai text
// (learner name, dates, body copy) shows correctly instead of garbled glyphs.
// The font module is imported lazily so its ~235KB of base64 stays out of the
// main bundle and only ships when someone actually downloads a PDF.
export async function makeCertPdf({ kind, learnerName, dateStr, code, instructorName, location }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const { registerSarabunFont } = await import('./sarabunFont.js')
  registerSarabunFont(doc)
  doc.setFont('Sarabun', 'normal')

  const pageW = doc.internal.pageSize.getWidth()
  const tmpl = CERT_KINDS[kind] || CERT_KINDS.theory
  const accent = tmpl.accent

  doc.setDrawColor(accent)
  doc.setLineWidth(2)
  doc.rect(10, 10, pageW - 20, 200)

  doc.setFont('Sarabun', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(accent)
  doc.text(tmpl.title, pageW / 2, 40, { align: 'center' })

  doc.setFont('Sarabun', 'normal')
  doc.setFontSize(14)
  doc.setTextColor('#0F1A2E')
  doc.text(tmpl.subtitle, pageW / 2, 55, { align: 'center' })
  doc.text('TH-FirstAid-Layperson-2026', pageW / 2, 65, { align: 'center' })

  doc.setFontSize(16)
  doc.text('มอบให้แก่', pageW / 2, 90, { align: 'center' })

  doc.setFont('Sarabun', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(accent)
  doc.text(learnerName || '—', pageW / 2, 110, { align: 'center' })

  doc.setFont('Sarabun', 'normal')
  doc.setFontSize(13)
  doc.setTextColor('#0F1A2E')
  doc.text(tmpl.description, pageW / 2, 130, { align: 'center', maxWidth: 240 })

  if (kind === 'practical') {
    if (instructorName) doc.text(`ครูผู้สอน: ${instructorName}`, pageW / 2, 145, { align: 'center' })
    if (location) doc.text(`สถานที่: ${location}`, pageW / 2, 155, { align: 'center' })
  }

  doc.setFontSize(12)
  doc.text(`ออกเมื่อ ${dateStr}`, 30, 195)
  doc.text(`รหัส ${code}`, pageW - 30, 195, { align: 'right' })

  return doc
}

export async function downloadCertPdf(args) {
  const doc = await makeCertPdf(args)
  doc.save(`firstaid-${args.kind}-${args.code}.pdf`)
}
