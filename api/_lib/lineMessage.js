// Push a LINE message to a specific learner (by their LINE userId) via the
// Messaging API. Mirrors api/_lib/lineNotify.js (admin push) but takes the
// recipient as a parameter, so the nurture cron can reach each learner.
//
// Needs env LINE_CHANNEL_ACCESS_TOKEN (Messaging API channel). When the token
// or recipient is missing the call is a no-op; network/API errors are swallowed
// and reported via the return value so a failed send never breaks the cron run.
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export async function pushLineMessage(to, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !to) return { ok: false, skipped: true }

  try {
    const resp = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // LINE caps a text message at 5000 chars; stay well under.
      body: JSON.stringify({ to, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error('LINE push failed', resp.status, detail)
      return { ok: false, status: resp.status }
    }
    return { ok: true }
  } catch (err) {
    console.error('LINE push error', err)
    return { ok: false, error: String(err) }
  }
}

// Reply to a webhook event using a one-time replyToken (free, unlike push).
export async function replyLineMessage(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !replyToken) return { ok: false, skipped: true }
  try {
    const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error('LINE reply failed', resp.status, detail)
      return { ok: false, status: resp.status }
    }
    return { ok: true }
  } catch (err) {
    console.error('LINE reply error', err)
    return { ok: false, error: String(err) }
  }
}
