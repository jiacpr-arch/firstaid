// Lightweight rate limiting + input hygiene for the public (unauthenticated)
// endpoints that fan out to the admin's LINE. Combined with the CORS origin
// allowlist this blunts flood/abuse from a single source.
//
// NOTE: the store is in-memory, so it is per-serverless-instance and resets on
// cold start — best-effort, not a hard guarantee across a scaled deployment. A
// durable limiter (Supabase counter / Upstash) is the follow-up if abuse persists.

const buckets = new Map()

export function clientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

// Sliding-window counter. Returns true and writes a 429 when the caller is over
// the limit; returns false (and records the hit) otherwise.
export function rateLimited(req, res, { key = 'default', limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const id = `${key}:${clientIp(req)}`
  const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    res.status(429).json({ error: 'Too many requests, please try again later' })
    return true
  }
  hits.push(now)
  buckets.set(id, hits)
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return false
}

// Cap length and collapse whitespace/control chars before interpolating
// user-supplied text into a LINE message, so a caller can't inject extra lines
// or blow up the message size.
export function sanitizeLine(value, max = 80) {
  return String(value ?? '')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
