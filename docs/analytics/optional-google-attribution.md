# Optional FirstAid Google advertising measurement

Status: local candidate, not released. Native GTM and network-contained real-SDK review remain mandatory release gates.

## Visitor choices and isolation

- New `firstaid_jia_training_google_consent_v2` grant explicitly separates analytics-only from advertising measurement. Legacy grants are ignored.
- Analytics-only landing uses `firstaid_analytics`; analytics-only receipt uses `firstaid_purchase`. These identities are not joined.
- Advertising measurement uses the new `firstaid_attribution_v2` prefix on both public landing and clean receipt, only after a current landing ads grant and a fresh receipt ads choice. New grant deletes older cookie namespaces rather than adopting legacy identities.
- All four Google consent purposes start denied. Analytics-only grants analytics storage. Ads measurement additionally grants ad storage and ad user data; ad personalization remains denied. Google Signals, enhanced conversions/contact matching, URL passthrough and cross-domain linker remain disabled.
- The combined other-vendor grant does not choose a Google purpose. Deny-all still denies all vendors. Meta behavior is unchanged.

## Retention and document boundaries

The grant has an absolute 24-hour deadline from visitor choice, never renewed on navigation, reload or receipt. The checkout code does not set an expiry override; Stripe documents a default24-hour Checkout Session lifetime at https://docs.stripe.com/api/checkout/sessions/create#checkout_session_create-expires_at; this is a maximum attribution window, not a promise that delayed payments will be attributed. SDK cookie expiry is remaining time minus a two-second rounding margin; cookie_update is false. Supported cookie_flags explicitly set Secure, SameSite=Lax and the immutable absolute Expires date, so delayed script initialization cannot extend retention. No cookie API interception is used. Native runtime tests must prove actual cookie expiration for GA and Ads suffixes, including closed-browser persistence.

Ordinary document retirement synchronously blocks SDK commands and discards the document before private UI or entitlement requests. It preserves only the valid, new-purpose attribution namespace with its original deadline. Explicit withdrawal, cross-tab grant replacement, storage failure and expiry stop collection and clear relevant cookies. A storage-only guard also cleans up on private pages without loading an SDK. A same-tab consent event arms the timer after a first grant.

No client/click identifiers are inserted into learner state, Stripe metadata, entitlement records, the signed receipt or any server record. Receipt still contains only opaque stable transaction ID, actual THB amount and short expiry. No purchase attempt is replayed when changing analytics to ads: both modes use the existing Google Web Lock and attempt marker.

## Native contract under review

Source selects exactly one custom event under the same Google attempt lock: existing firstaid_receipt_purchase for analytics, new firstaid_receipt_ads_purchase for advertising. Existing native analytics tags stay unchanged; new native ads tags are dormant until the new event appears. Payload fields:

- `fa_receipt_cookie_prefix`: `firstaid_attribution_v2` for qualified ads; otherwise `firstaid_purchase`.
- `fa_receipt_cookie_flags`: exact secure attributes plus absolute Expires UTC, derived only from validated grant expiry.
- `fa_receipt_cookie_expires`: integer remaining seconds, 1–86400, recomputed immediately before custom event delivery.
- `fa_receipt_ads_measurement`: `granted` only for current dual consent; otherwise `denied`.
- Existing typed false maps cookie_update=false. All existing receipt amount/transaction/privacy fields remain.

Existing native analytics setup pins firstaid_purchase. New ads setup pins firstaid_attribution_v2, uses bounded TTL and absolute flags, and the new purchase tag sets firstaid_ads_measurement=granted. The source must not deploy before that separate dormant ads event/tag pair is reviewed and tested. No parallel AW purchase conversion is added.

Any GA4-derived Ads import event must AND-match purchase, exact canonical receipt page_location, and firstaid_ads_measurement=granted. Analytics-only purchases must not enter that derived event. Import remains secondary; no campaign/default-goal/bid changes.

## Verification limits

Unit and mock-browser tests prove application consent, document teardown and attempt semantics, not vendor delivery. Real cached SDK testing intercepts all network traffic and uses synthetic data only. It must verify client/session continuity, natural session expiration, cookie domain/expiry, allowed click capture, all automatic fields and attempted destinations. Receipt connect-src additionally permits only the exact primary GA collector https://analytics.google.com/g/collect (query strings allowed), because the native ads-consented runtime selects this bare host. Adjacent paths, other bare-host paths and Ads bridges remain blocked; img-src and script-src are unchanged. The landing has no existing CSP and requires separate actual destination auditing.

No live payment, ad click or production purchase test is performed. A naturally occurring consented purchase is required before claiming Ads server-side attribution.

## Early actual SDK evidence (not final release certification)

Cached official GA and AW scripts, with every network request locally intercepted, capture validated click IDs into owned cookies, but a bare canonical page_location omits those IDs from GA collection. Actual suffixes include aw/dc/gs/gb/ag/au and GA identity/session cookies. Immediate and 30-second-delayed GA/AW loads respect absolute Expires. Existing broad-domain same-prefix click adoption was reproduced and eliminated by deleting only app-owned .morroo.com cookies before loading; exact-host identity remains intact.

Landing requests can include Google Ads/DoubleClick recipients, including audience endpoints despite denied personalization. These are not blocked by a landing CSP (none currently exists). No contact fields or private fixture values were observed; a globally blocked test does not prove provider delivery or provider-side retention. Receipt CSP still excludes Ads bridge recipients. FirstAid's24-hour bound governs its first-party browser attribution reuse, not provider-held data or third-party cookies.


For explicit advertising-measurement consent only, the public landing now builds GA page_location from the fixed canonical URL and validated, case-preserved gclid/gbraid/wbraid values. It never includes UTMs, fbclid, arbitrary query data, hashes or referrers. Analytics-only landing and every receipt retain their bare canonical URLs. Route, referrer, entitlement and current grant are checked again immediately before configuration; contact uses the same bounded metadata. Google documents click IDs in the document-location field as part of campaign processing (https://support.google.com/analytics/answer/11242841 and https://support.google.com/analytics/answer/2938246). This bounded URL construction is an engineering implementation of that requirement, not a guarantee of backend attribution. Receipt Ads bridges remain CSP-blocked. Naturally occurring consented purchases and provider processing are still required to verify attribution; braid reporting can be modeled.
