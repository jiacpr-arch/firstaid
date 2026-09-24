// Rules for the public certificate check (GET /api/certificates/verify).
//
// FA- codes (certCode.js) are 8 random characters from a 32-letter alphabet, so the code alone is
// enough: nobody can guess one. Anything else in public.certificates — the staff-issued B-CPR
// certificates are numbered BCPR-YYYY-NNNN in sequence — can be walked one number at a time, so for
// those the caller must also give the name printed on the certificate, and a wrong name answers
// exactly like a missing code. Otherwise the endpoint would list every B-CPR holder's name.

export const RANDOM_CODE_RE = /^FA-[23456789A-HJ-NP-Z]{8}$/
const MAX_CODE = 40
const MAX_NAME = 80

// Same normalisation as the JIA Hub's legacy lookup (jia-learning-hub lib/legacy-certificate.mjs):
// drop one leading honorific (a Thai title attaches to the name; a Latin one needs "." or a space
// after it), then case, spaces and dots.
const TITLES = ['เด็กหญิง', 'เด็กชาย', 'นางสาว', 'ทพญ.', 'น.ส.', 'ด.ญ.', 'ด.ช.', 'นพ.', 'พญ.', 'ทพ.', 'ภก.', 'ภญ.', 'ดร.', 'นาย', 'นาง',
  'miss', 'mrs.', 'mrs', 'mr.', 'mr', 'ms.', 'ms', 'dr.', 'dr']
const THAI = /[฀-๿]/

export function normalizeName(value) {
  let s = String(value ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  for (const t of TITLES) {
    if (!s.startsWith(t)) continue
    const rest = s.slice(t.length)
    if (THAI.test(t) || t.endsWith('.') || rest.startsWith(' ')) { s = rest.trim(); break }
  }
  return s.replace(/[\s.]/g, '')
}

export function namesMatch(a, b) {
  const x = normalizeName(a)
  return x.length >= 2 && x === normalizeName(b)
}

// Cleans the query. { error } for a malformed request; otherwise { code, name, needsName }.
export function parseVerifyQuery(query = {}) {
  const code = String(query.code ?? '').trim().toUpperCase()
  const name = String(query.name ?? '').trim()
  if (!code || code.length > MAX_CODE) return { error: 'Missing code' }
  if (name.length > MAX_NAME) return { error: 'Name too long' }
  return { code, name, needsName: !RANDOM_CODE_RE.test(code) }
}

// The row to return, or null (answered as "Not found") when a guessable code comes without its name.
export function visibleCertificate(row, { needsName, name }) {
  if (!row) return null
  if (needsName && !namesMatch(name, row.learner_name)) return null
  return row
}
