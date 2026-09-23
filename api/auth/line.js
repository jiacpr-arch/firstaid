import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { checkHubIdentityLinked } from '../_lib/hubIdentity.js'

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

// Bridge: LINE Login (web OAuth 2.1) → a real Supabase Auth session.
//
// Supabase has no native LINE provider, so we verify the LINE id_token here with
// the channel secret, map the LINE userId to a Supabase auth user (creating one on
// first login), and hand the SPA a magiclink token_hash it can redeem client-side
// with supabase.auth.verifyOtp() to establish a normal, auto-refreshing session.
//
// We never ship the service-role key or channel secret to the client, and the LINE
// `code` is redeemed only here. Identity mapping lives in the `line_identities` table.
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const channelId = process.env.VITE_LINE_LOGIN_CHANNEL_ID
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET
  if (!channelId || !channelSecret) {
    res.status(500).json({ error: 'LINE login not configured', code: 'not_configured' })
    return
  }

  const { code, redirectUri, nonce, learnerId } = req.body || {}
  if (!code || !redirectUri) { res.status(400).json({ error: 'Missing code/redirectUri' }); return }

  try {
    // 1) Exchange the authorization code for tokens (server-side, holds the secret).
    const tokenResp = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })
    const tokenJson = await tokenResp.json().catch(() => ({}))
    if (!tokenResp.ok || !tokenJson.id_token) {
      console.error('LINE token exchange failed', tokenResp.status, tokenJson)
      res.status(401).json({ error: 'LINE token exchange failed', code: 'token_exchange_failed' })
      return
    }

    // 2) Let LINE verify the id_token (signature/aud/iss/exp) and decode the claims.
    const verifyResp = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: tokenJson.id_token, client_id: channelId }),
    })
    const claims = await verifyResp.json().catch(() => ({}))
    if (!verifyResp.ok || !claims.sub) {
      console.error('LINE id_token verify failed', verifyResp.status, claims)
      res.status(401).json({ error: 'LINE verify failed', code: 'verify_failed' })
      return
    }
    // Replay protection: the nonce echoed in the id_token must match the one we sent.
    if (nonce && claims.nonce && claims.nonce !== nonce) {
      res.status(401).json({ error: 'Nonce mismatch', code: 'nonce_mismatch' })
      return
    }

    const lineUserId = claims.sub
    const displayName = claims.name || null
    const pictureUrl = claims.picture || null
    const lineEmail = claims.email || null

    // 3) Map LINE identity → Supabase auth user. `line_identities` is the source of
    // truth so repeat logins reuse the same user and the original learner_id.
    const { data: existingMap } = await admin
      .from('line_identities')
      .select('*')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    let authEmail
    let canonicalLearnerId
    let hubAccountLinked = false
    if (existingMap) {
      authEmail = existingMap.email
      canonicalLearnerId = existingMap.learner_id
    } else {
      // See api/_lib/hubIdentity.js — read-only dupe-detection, does not change what happens below.
      hubAccountLinked = await checkHubIdentityLinked(admin, lineUserId)
      // Synthesize a stable email when LINE doesn't share one (email scope needs review).
      authEmail = lineEmail || `line_${lineUserId}@line.firstaid.local`
      canonicalLearnerId = learnerId || randomUUID()
      const { error: createErr } = await admin.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        user_metadata: { line_user_id: lineUserId, display_name: displayName, picture_url: pictureUrl },
      })
      // A pre-existing user (e.g. mapping row was cleared) is fine — generateLink below
      // still works for it. Any other error is fatal.
      if (createErr && !/already|exist|registered/i.test(createErr.message || '')) {
        console.error('createUser failed', createErr)
        res.status(500).json({ error: 'Account creation failed', code: 'account_create_failed' })
        return
      }
    }

    // 4) Mint a single-use magiclink token_hash the client redeems via verifyOtp().
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkErr || !tokenHash) {
      console.error('generateLink failed', linkErr)
      res.status(500).json({ error: 'Session mint failed', code: 'session_mint_failed' })
      return
    }

    // 5) Persist the mapping on first login.
    if (!existingMap) {
      await admin.from('line_identities').insert({
        line_user_id: lineUserId,
        auth_user_id: linkData.user?.id,
        learner_id: canonicalLearnerId,
        email: authEmail,
        display_name: displayName,
        picture_url: pictureUrl,
      })
    }

    res.status(200).json({
      tokenHash,
      lineUserId,
      displayName,
      pictureUrl,
      lineEmail,
      learnerId: canonicalLearnerId,
      hubAccountLinked, // telemetry only for now (Phase 6) — see comment above; not acted on by the client yet
    })
  } catch (err) {
    console.error('LINE auth bridge error', err)
    res.status(500).json({ error: 'LINE login failed', code: 'server_error' })
  }
}
