// Unified identity, Phase 6 (read-only): before api/auth/line.js mints a brand-new synthetic-email
// account for a first-time LINE login, this checks whether class.jiacpr.com (the Hub — the same
// Supabase project firstaid runs on) already has an account for that exact LINE user, via
// public.jia_line_hub('identity'), which only ever reports an existing, already-linked account —
// it never creates one. Calling the RPC with the service role (p_secret is ignored in that case)
// needs no shared secret configured on this side.
//
// This does not change account creation at all yet — it's detection/telemetry so a real duplicate
// rate can be measured before a later phase actually reuses the Hub account instead of minting
// this one. Always best-effort: any failure here must never block a LINE login.
export async function checkHubIdentityLinked(admin, lineUserId) {
  try {
    const { data } = await admin.rpc('jia_line_hub', { p_secret: '', action: 'identity', payload: { lineUserId } })
    const linked = Boolean(data?.linked)
    if (linked) {
      console.warn('firstaid LINE login: this LINE user already has a Hub (class.jiacpr.com) account', { lineUserId, hubUserId: data.userId })
    }
    return linked
  } catch (err) {
    console.error('jia_line_hub identity check failed (non-fatal)', err)
    return false
  }
}
