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
