// LINE push helper — shared by real-time notifications (new learner finished)
// and the daily ad report cron. Reads LINE_CHANNEL_ACCESS_TOKEN + LINE_USER_ID
// from env (same vars the ad report already uses, so no extra setup needed).

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export function isLineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID)
}

// Low-level push that throws on HTTP error — use when the caller wants to
// surface the failure (e.g. the cron endpoint reports it in its response).
export async function pushLineOrThrow(text, {
  channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN,
  userId = process.env.LINE_USER_ID,
} = {}) {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channelToken}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  })
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`)
}

// Fire-and-forget push: no-ops when LINE isn't configured and swallows errors
// so a failed notification never breaks the request that triggered it.
export async function notifyLine(text) {
  if (!isLineConfigured()) return { ok: false, skipped: true }
  try {
    await pushLineOrThrow(text)
    return { ok: true }
  } catch (err) {
    console.error('LINE notify failed:', err?.message || err)
    return { ok: false, error: String(err?.message || err) }
  }
}
