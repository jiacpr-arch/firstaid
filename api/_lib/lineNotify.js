// One-way push alert to the admin's LINE via the Messaging API.
//
// LINE Notify (the old token-based push) was shut down in March 2025, so this
// uses an Official Account's push endpoint instead. Configure two env vars:
//   LINE_CHANNEL_ACCESS_TOKEN — long-lived channel access token (Messaging API)
//   LINE_ADMIN_USER_ID        — the recipient userId ("Your user ID" in console)
//
// When either is missing the call is a no-op, and any network/API error is
// swallowed: a failed notification must never break certificate issuance.
const PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export async function notifyAdminLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_ADMIN_USER_ID
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
