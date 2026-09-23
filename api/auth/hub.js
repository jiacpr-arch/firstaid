import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'

// Bridge: Hub SSO (class.jiacpr.com, PKCE authorization code) -> a real Supabase Auth session,
// linked to the same learner_id firstaid already knows this person by (or a fresh one on first
// login). Unlike api/auth/line.js, this calls the Hub's public.jia_sso RPC directly rather than
// going through the sso-auth Edge Function: firstaid runs on the SAME Supabase project as the Hub
// (this app is registered there as a kind='supabase' SSO client — client_id + redirect_uri only,
// no secret), so firstaid's own service role can already do everything sso-auth would otherwise do
// on its behalf (consume the code, mint the magiclink) — and that also gets us `userId` directly,
// which sso-auth's own HTTP response never returns (see jia-learning-hub,
// supabase/functions/sso-auth/index.ts).
//
// We never ship the service-role key to the client, and the authorization `code` is redeemed only
// here (single use, ~60s, enforced entirely by the Hub itself via public.jia_sso).
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const { code, redirectUri, codeVerifier, learnerId } = req.body || {}
  if (!code || !redirectUri || !codeVerifier || !learnerId) {
    res.status(400).json({ error: 'Missing code/redirectUri/codeVerifier/learnerId' })
    return
  }

  try {
    const { data: consumed, error: consumeErr } = await admin.rpc('jia_sso', {
      action: 'consume',
      payload: { code, clientId: 'firstaid', redirectUri, codeVerifier },
    })
    if (consumeErr || !consumed?.userId || consumed.kind !== 'supabase') {
      console.error('jia_sso consume failed', consumeErr, consumed)
      res.status(401).json({ error: 'Hub login failed', code: 'consume_failed' })
      return
    }

    const profile = consumed.profile || {}
    const email = profile.email
    if (!email) { res.status(500).json({ error: 'Hub account has no email on file', code: 'no_email' }); return }

    // Resolve the canonical learner_id for this Hub account BEFORE minting a session — never trust
    // this device's own learnerId blindly. jia_firstaid_hub_adopt refuses an ambiguous/already-
    // claimed-by-someone-else id, and reuses this account's own existing learner_id (rather than
    // the one this device sent) whenever this Hub account already adopted one before.
    const { data: adopted, error: adoptErr } = await admin.rpc('jia_firstaid_hub_adopt', {
      payload: { userId: consumed.userId, learnerId },
    })
    if (adoptErr || !adopted?.ok) {
      console.error('jia_firstaid_hub_adopt failed', adoptErr, adopted)
      res.status(409).json({ error: 'บัญชีนี้ผูกกับผู้เรียนคนอื่นอยู่แล้ว', code: adopted?.reason || 'adopt_failed' })
      return
    }

    // Mint a single-use magiclink token_hash the client redeems via verifyOtp() — same mechanism
    // api/auth/line.js already uses for the LINE bridge.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkErr || !tokenHash) {
      console.error('generateLink failed', linkErr)
      res.status(500).json({ error: 'Session mint failed', code: 'session_mint_failed' })
      return
    }

    res.status(200).json({
      tokenHash,
      learnerId: adopted.learnerId,
      displayName: profile.nameTh || profile.nameEn || '',
      email,
    })
  } catch (err) {
    console.error('Hub auth bridge error', err)
    res.status(500).json({ error: 'Hub login failed', code: 'server_error' })
  }
}
