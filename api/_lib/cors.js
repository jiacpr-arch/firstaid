// Origin allowlist for the API. Defaults to the production site; override/extend
// with ALLOWED_ORIGINS (comma-separated) for preview/staging. We reflect the
// request origin only when it is on the list instead of a blanket `*`, so other
// sites can't invoke these endpoints from a visitor's browser.
const DEFAULT_ORIGINS = ['https://firstaid.morroo.com']

function allowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return fromEnv.length ? fromEnv : DEFAULT_ORIGINS
}

export function applyCors(req, res) {
  const origin = req.headers?.origin
  const list = allowedOrigins()
  if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
