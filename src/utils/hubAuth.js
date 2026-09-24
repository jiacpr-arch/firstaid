// Hub SSO login (class.jiacpr.com) — client helpers.
//
// Secondary to LINE (LINE stays the primary, mandatory path in LineLoginGate): this is for a
// learner who has no LINE account at all. Full-window redirect through the Hub's own /sso page
// (PKCE, S256) rather than reimplementing an email/OTP login screen here — the Hub already has
// one, and it's the single place that collects/verifies a learner's real name for the shared
// student card (see jia-learning-hub, docs/unified-identity.md). This app is a `kind='supabase'`
// SSO client, so it authenticates by CORS origin only (like the LINE bridge) — no client secret.
//
// state + code_verifier live in sessionStorage AND a cookie, same reasoning as lineAuth.js: LINE/FB
// in-app browsers sometimes create a fresh browsing context on the redirect back, which drops
// sessionStorage but not a same-domain cookie.

const HUB_SSO_URL = 'https://class.jiacpr.com/sso'
const CLIENT_ID = 'firstaid'
const SS_KEY = 'firstaid.hubAuth'
const COOKIE_MAX_AGE = 600 // 10 minutes — matches the Hub's own sso_codes lifetime being short-lived

function setCookie(name, value, maxAgeSec) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax${secure}`
}
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
function deleteCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function base64url(bytes) {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function randomToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
// 32 random bytes -> 43-char base64url string, inside PKCE's required 43-128 char range and using
// only characters RFC 7636's code_verifier charset allows (unreserved = ALPHA / DIGIT / "-" / "_").
function randomCodeVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return base64url(arr)
}
async function codeChallengeFor(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64url(new Uint8Array(hash))
}

export const hubCallbackUri = () => `${window.location.origin}/auth/hub/callback`

// Kick off the Hub login redirect.
export async function startHubLogin(learnerId) {
  const state = randomToken()
  const codeVerifier = randomCodeVerifier()
  const codeChallenge = await codeChallengeFor(codeVerifier)
  const redirectUri = hubCallbackUri()
  const payload = JSON.stringify({ state, codeVerifier, learnerId, redirectUri })
  sessionStorage.setItem(SS_KEY, payload)
  setCookie(SS_KEY, payload, COOKIE_MAX_AGE)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  window.location.assign(`${HUB_SSO_URL}?${params.toString()}`)
}

export function readHubAuthState() {
  try {
    return JSON.parse(getCookie(SS_KEY) || sessionStorage.getItem(SS_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearHubAuthState() {
  sessionStorage.removeItem(SS_KEY)
  deleteCookie(SS_KEY)
}
