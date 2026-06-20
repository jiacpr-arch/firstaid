// LINE Login (web OAuth 2.1) — client helpers.
//
// We do a full-window redirect (not a popup) because popups/window.opener are
// unreliable inside the LINE in-app browser and in standalone PWA display mode.
// state + nonce are stored in sessionStorage and checked on return; learnerId is
// carried so the callback can link the anonymous learner to the new account.

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const SS_KEY = 'firstaid.lineAuth'

export const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || ''
export const isLineLoginConfigured = !!LINE_CHANNEL_ID

export const lineCallbackUri = () => `${window.location.origin}/auth/line/callback`

function randomToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Kick off the LINE login redirect. bot_prompt=aggressive + the OA @jiacpr linked to
// the Login channel makes LINE show the "add friend" step, so login auto-adds the OA.
export function startLineLogin(learnerId) {
  const state = randomToken()
  const nonce = randomToken()
  const redirectUri = lineCallbackUri()
  sessionStorage.setItem(SS_KEY, JSON.stringify({ state, nonce, learnerId, redirectUri }))

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    nonce,
    // `email` requires LINE review — ship with profile+openid and add email later.
    scope: 'profile openid',
    bot_prompt: 'aggressive',
  })
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
}

export function readLineAuthState() {
  try {
    return JSON.parse(sessionStorage.getItem(SS_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearLineAuthState() {
  sessionStorage.removeItem(SS_KEY)
}
