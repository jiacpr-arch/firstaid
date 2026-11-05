// Query rules for the admin certificate list (GET /api/certificates/list).
//
// The search text goes into a PostgREST or=(...) filter, where , ( ) are syntax and * % _ are
// wildcards, so those are stripped rather than escaped. Digits typed with dashes or spaces
// ("081-234 5678") also match the phone column by their digits alone.

export const PAGE_SIZE = 50
const MAX_Q = 60
const KINDS = ['theory', 'practical']

export function parseListQuery(query = {}) {
  const q = String(query.q ?? '').replace(/[,()*%_\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_Q)
  const kind = KINDS.includes(query.kind) ? query.kind : null
  const page = Math.max(0, Math.min(1000, Number.parseInt(query.page, 10) || 0))
  return { q, kind, page }
}

// The or=(...) filter for q, or null when q is empty.
export function searchFilter(q) {
  if (!q) return null
  const parts = [
    `learner_name.ilike.*${q}*`,
    `learner_email.ilike.*${q}*`,
    `code.ilike.*${q}*`,
    `learner_phone.ilike.*${q}*`,
  ]
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3 && digits !== q) parts.push(`learner_phone.ilike.*${digits}*`)
  return parts.join(',')
}

// Row as the admin page shows it.
export function listRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    code: r.code,
    issuedAt: r.issued_at,
    revokedAt: r.revoked_at || null,
    name: r.learner_name || '',
    phone: r.learner_phone || '',
    email: r.learner_email || '',
    location: r.location || '',
    cohortName: r.cohorts?.name || '',
  }
}

// CSV export (format=csv): every row matching the same q/kind, fetched in chunks because PostgREST
// caps a single response. EXPORT_MAX bounds one download.
export const EXPORT_CHUNK = 1000
export const EXPORT_MAX = 20000

const CSV_COLUMNS = [
  ['code', 'เลขใบ'],
  ['kindLabel', 'ประเภท'],
  ['name', 'ชื่อ'],
  ['phone', 'เบอร์โทร'],
  ['email', 'อีเมล'],
  ['issuedDate', 'วันที่ออก'],
  ['cohortName', 'คลาส'],
  ['location', 'สถานที่'],
  ['status', 'สถานะ'],
]
const KIND_LABEL = { theory: 'ภาคทฤษฎี', practical: 'ภาคปฏิบัติ' }

// A cell starting with = + - @ (or tab/CR) runs as a formula in Excel/Sheets, so it is prefixed
// with ' — except a phone number like +66 81 234 5678, which is only digits and separators.
function csvCell(value) {
  let s = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s-]+$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Date in Thai time (YYYY-MM-DD) — the day staff see on the certificate, not the UTC day.
function thaiDate(iso) {
  if (!iso) return ''
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

// rows are listRow() objects. Starts with a BOM so Excel reads the Thai text as UTF-8.
export function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(([, h]) => h).join(',')]
  for (const r of rows) {
    const v = {
      ...r,
      kindLabel: KIND_LABEL[r.kind] || r.kind,
      issuedDate: thaiDate(r.issuedAt),
      status: r.revokedAt ? `เพิกถอน ${thaiDate(r.revokedAt)}` : 'ใช้ได้',
    }
    // Excel drops a phone's leading 0 when it reads the cell as a number; ="081…" keeps it as text
    lines.push(CSV_COLUMNS.map(([k]) => (k === 'phone' && /^0\d+$/.test(v.phone) ? `="${v.phone}"` : csvCell(v[k]))).join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
