# FirstAid paid-purchase measurement

## Current state and limits

This change implements consented Meta Purchase and GA4 purchase measurement. It does not change prices, payment methods, checkout creation, entitlements, Stripe webhook subscriptions, or clinical/learner data storage. `/buy` remains outside the advertising boundary. Its old direct Meta Purchase and PostHog purchase fanout are removed.

Receipt issuance is **disabled by default** until the dedicated production-only server secret described below exists. The verified Training GA4 path is enabled by `GOOGLE_PURCHASE_ENABLED = true`, with fresh Google consent and all receipt/privacy gates still required. The constant remains an emergency kill switch. The existing Google Ads contact action is never used as a sale. No Google Ads Purchase action/label has been verified. No CAPI integration is introduced.

The authenticated confirm endpoint already retrieves Stripe's session, checks its learner ownership, validates paid fulfillment, and upserts the entitlement. Only after those steps does it optionally issue a measurement receipt. Receipt issuance also requires a live-mode, completed, one-time, paid THB session with an integer positive actual amount. Unpaid asynchronous PromptPay sessions, missing payment fields and test-mode sessions issue no receipt. The existing signed webhook continues fulfilling completed/async-success payments without requiring a browser return.

This measures only customers who return, receive a valid receipt, consent and use a supported browser. It does not measure every paid webhook, guarantee ad attribution, prove vendor ingestion, or replace financial reconciliation.

## Receipt and document boundary

- A server receipt carries only an opaque SHA-256 event ID derived from the high-entropy checkout session ID, actual amount, currency, expiry, audience and environment. It has no raw Stripe ID, learner/account/chapter identifier, contact/health information, click IDs or matching fields.
- A separate random **server-only sensitive** `FIRSTAID_PURCHASE_RECEIPT_SECRET` must be configured for the Vercel `firstaid` project's **production target only**. It must not be configured in preview or development, exposed as `VITE_*`, committed, logged or returned by an API. Use at least 32 cryptographically random bytes. This change does not create or configure it, and never falls back to Stripe/webhook/Supabase credentials.
- HKDF derives a purpose-specific MAC key; signed content is bound to the production audience and environment. Issuance and verification both reject non-production runtimes. Receipts expire in 15 minutes. Rotating or removing this dedicated secret invalidates outstanding receipts without affecting payment or fulfillment.
- `/buy` temporarily stores the signed minimal receipt in sessionStorage, applies `no-referrer`, then replaces the entire document with the fixed `/api/checkout/receipt-page` URL. No receipt or session ID is placed in that URL. A failed handoff retains the normal paid-success/learning flow.
- The API-prefixed standalone page bypasses older service workers' SPA navigation fallback. It contains no React learner application, auth client, PostHog, forms or private route content. The page uses no-store, no-referrer, noindex and a restrictive CSP.
- Before any vendor SDK, the page removes and verifies removal of the temporary token, verifies it with the same-origin API using `credentials: omit` and `referrerPolicy: no-referrer`, and retains only the minimal public event fields. An unsafe URL/referrer, invalid/expired receipt or storage failure leaves tracking off.

## Consent and event routing

Fresh explicit consent is required separately for Meta and Google in every receipt document. Landing-page grants and previous receipt grants never auto-load an SDK. Declining, failed storage, withdrawal, cross-tab denial, pagehide and cached-page restoration fail closed or discard the document. Learning remains accessible.

Meta is intended to send `Purchase` to verified dataset `1277103750989853`, with actual `value`, `currency` and stable `eventID`. Auto configuration is disabled, no PageView is queued and no advanced-matching fields are provided.

The Google implementation targets only GA4 stream `G-H10PHV2XNG` with `purchase` and the same opaque `transaction_id`. It uses fixed public page metadata, empty referrer, no `user_data`, disabled Signals/personalization/linker options, a separate cookie prefix, analytics storage granted only after consent, and advertising storage/user data/personalization denied. It does not configure the Ads account tag or send the existing LINE conversion label.

A read-only account check on 8 November 2026 verified `G-H10PHV2XNG` as Training property `553435687`, stream `15748026893`, linked to Ads account `461-594-5872`. The enabled secondary Ads action `MorRoo (web) purchase`, ID `7627026878`, is a `GOOGLE_ANALYTICS_4_PURCHASE` import explicitly naming the separate MorRoo source property. It does not establish an import of Training purchases. Do not send a second direct Ads conversion, use the LINE label, or change action primacy as part of this implementation. The existing shared GTM container is not installed: it has other Google/Meta destinations and broad firing rules, so adding it would violate exclusive event ownership and the isolated document boundary.

`send_page_view: false` does not disable every account-side Enhanced Measurement feature. The Thai disclosure therefore covers confirmation-page visits/engagement as well as the purchase and acknowledges IP/browser metadata and cookie identifiers. The defensible claim is that the application supplies no identity, health details or learning records, not that tracking is anonymous or purchase-only. Signed-in account review verified tag `G-H10PHV2XNG` / `GT-PHXQZG7F` has exactly one destination, the Training GA4 stream above, and no Ads destination. Enhanced Measurement is off. Shared automatic detectors and user-provided-data detection for email/phone/name/address remain on, with no custom CSS/JavaScript selectors. The isolated receipt contains none of those fields; these settings are not represented as disabled. No shared GA Admin setting is changed.

## Deduplication and product analytics

Per-vendor Web Locks plus durable localStorage attempt markers claim each opaque transaction before SDK startup. Concurrent tabs, repeated returns and reloads do not create another attempt while the markers remain. Missing locks or failed storage stop tracking. An uncertain attempt is not retried. Meta eventID and GA4 transaction_id provide stable vendor identifiers as well.

This is an at-most-once browser attempt policy, not a delivery receipt or universal exactly-once guarantee. Cleared storage, different browser/device and vendor behavior remain limitations. Attempt markers contain only vendor and opaque event ID, never the raw checkout session.

PostHog initialization, identification and capture are blocked for payment/receipt URLs or payment referrers. The send filter also rejects delayed URL properties containing the payment return URL. Session recording and performance/network-timing capture are explicitly disabled, and all `$snapshot` events are rejected because replay can otherwise buffer private content and emit it after navigation. Ordinary public product analytics events remain unchanged.

## Landing ownership integration

The latest main branch's pricing, purchase CTA, account controls and ownership lookup remain intact. An anonymous local learner can have class entitlements even without a signed-in account, so advertising waits for the current learner/auth entitlement key to resolve successfully with an empty result. Loading, stale keys, errors, malformed responses and ownership do not authorize SDK startup. Ownership/error documents remain private.

Before every entitlement network attempt, including retries and same-key refreshes, an SDK-bearing document is revoked and replaced; that attempt stops before fetch. Synchronous readiness and in-flight counts held in module WeakMaps block stale SDK handlers and wait for older overlapping requests to settle. No identifier or token is retained in these maps. The replacement document performs the normal lookup before any marketing startup. The browser uses a canonical read-only POST `/api/entitlements`, with its local identifier in JSON rather than the URL, to prevent identifier-bearing Resource Timing entries. Existing GET compatibility, authentication, ownership resolution and results are preserved. Resource Timings are additionally cleared and verified immediately before measurement; unavailable or failing cleanup keeps marketing off. No authentication rule, payment behavior or purchase UI is changed. These controls are not an origin sandbox: same-origin third-party code retains browser capabilities, including potential access to local storage. The guarantee concerns application payloads, resource URLs, concurrent lookup and displayed private content, not a claim that malicious SDK code is technically unable to inspect all same-origin state.

## Verification

- `npm test`: includes paid/live/amount/ownership ordering, expiry, tamper/audience/environment checks, dedicated-key fail-closed behavior, minimal payload, storage, canonical document and per-vendor dedup tests.
- `npm run lint` and full `npm run build` with synthetic build configuration.
- `scripts/test-ad-boundary.mjs`: existing landing/privacy regression remains intact, using a synthetic empty entitlement result.
- `scripts/test-entitlement-boundary.mjs`: real Chromium runs the actual App and stores from a temporary test-only Vite build, with every network request blocked or mocked. Covers pending/error/ownership states, stale and rapid identity changes, same-key refresh and retries, document replacement, cleanup failures and zero learner-ID Resource Timing entries. Test controls are not present in the shipping build.
- `scripts/test-purchase-receipt.mjs`: real Playwright Chromium, synthetic receipts, mock vendor scripts, production CSP/security headers and every other request/WebSocket blocked. Covers fresh consent, actual handoff/referrer cleanup, minimal payload, repeated/concurrent tabs, reload/back, failed storage, pending-lock withdrawal, late SDK execution and cross-tab denial. The shipped Google-enabled path is exercised unchanged; one test-only source toggle covers the emergency disabled state.

These checks never create a checkout, perform a payment, send a live purchase, replay a live Stripe event, inspect customer records or prove account-side ingestion. Production activation requires dedicated-key setup approval, exact-head review/CI/preview and deployment approval. Vendor delivery should be validated only from a subsequently authorized genuine purchase or a properly isolated approved test setup, not by injecting fake live events.
