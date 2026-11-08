# Dedicated FirstAid receipt GTM migration (local candidate)

## Status and scope

This patch is prepared locally only. It has not been pushed, deployed or merged.
Production continues using its verified direct Meta + GA4 implementation from
PR #192, commit `22efda8f2e896df35c5132607e3f851ed368e980`.
The local base is `714fc261d6042247ed6668c648d0035e5b2e5581`; its tree
`08aa3dc195ef65f6e572ec68e535c619cd80751c` is identical to that production tree.

The candidate replaces only the standalone receipt's Google loader/config/event
ownership. It uses the dedicated FirstAid container `GTM-54LV8DZ5` (account
`6400936525`, container `285784917`, workspace `2`). The container is an
reviewed version 2, published while unreferenced solely for blocked-network SDK
validation. This code must not deploy until its separate release gates below are complete. Never use shared `GTM-5CSJ74R4`.

Meta remains direct and unchanged. Receipt issuance/verification, checkout,
prices, entitlements, page structure/buttons, and CSP are unchanged. Only the
Google consent paragraph now names Tag Manager and accurately limits its matching
claim to the app not sending name/email/phone. Existing IP/browser/cookie disclosure
is preserved. The
existing production-only receipt secret is not read, changed or duplicated.
Landing-page Google configuration is outside this migration and is unchanged.

## Exact event contract

The only application custom event is this flat, typed object:

```js
{
  event: 'firstaid_receipt_purchase',
  fa_receipt_transaction_id: receipt.eventId, // opaque fa_purchase_ + 64 hex characters
  fa_receipt_value: receipt.value,           // positive finite number, actual paid THB
  fa_receipt_false: false,                   // boolean, never the string "false"
  fa_receipt_true: true,                     // boolean, never the string "true"
  fa_receipt_null: null,                     // null, never the string "null"
  fa_receipt_empty: '',                      // empty string
  fa_receipt_linker: {
    domains: [],
    accept_incoming: false,
    decorate_forms: false,
  },
}
```

All seven DLVs are native Version 1 variables with no defaults or format
conversions. Names agreed with the container preparation worker:

| Native variable name | Data-layer key |
| --- | --- |
| DLV - FA Receipt Transaction ID | fa_receipt_transaction_id |
| DLV - FA Receipt Value | fa_receipt_value |
| DLV - FA Receipt False | fa_receipt_false |
| DLV - FA Receipt True | fa_receipt_true |
| DLV - FA Receipt Null | fa_receipt_null |
| DLV - FA Receipt Empty | fa_receipt_empty |
| DLV - FA Receipt Linker | fa_receipt_linker |

The native configuration owns fixed currency `THB`, canonical page location
`https://firstaid.morroo.com/api/checkout/receipt-page`, title
`Purchase | JiaCPR Training`, and only destination `G-H10PHV2XNG`.
It must require the exact custom event, canonical hostname/path/URL, and
`analytics_storage` consent. The native Google setup tag has no independent
trigger and runs only as purchase setup. No all-pages, initialization, DOM-ready,
Meta, Ads, CAPI, transport, custom HTML/JavaScript or other destination is allowed.
The actual saved container export and published SDK, not this document, are the
source of truth for native configuration review.

## Runtime sequence and preserved boundaries

1. The existing server-authenticated paid/ownership/live-mode THB receipt is
   consumed and validated in the clean canonical standalone receipt document.
   Its temporary signed token is deleted before any vendor script loads.
2. Fresh explicit Google consent is saved and verified. Existing landing or
   receipt grants never auto-load GTM. Meta-only/no/denied consent never loads it.
3. The existing `firstaid_purchase_attempt_v1:google:<opaque eventId>` Web Lock
   and durable marker are claimed before loading. There is no `gtm` namespace.
   Existing direct-Google attempts therefore remain ineligible after migration.
4. Before requesting GTM, the data layer receives all four default-denied consent
   values, `ads_data_redaction: true`, `url_passthrough: false`, `user_data: null`,
   empty disabled linker, canonical page metadata, explicit
   `firstaid.morroo.com` cookie domain, `firstaid_purchase` cookie prefix, and
   false Signals, personalization, enhanced-conversions and `send_page_view`.
   Then only `analytics_storage` is granted; all advertising categories stay denied.
5. The isolated loader requests `/gtm.js?id=GTM-54LV8DZ5` with no referrer.
   Immediately before loading, it queues one standard `gtm.start`/`gtm.js`
   bootstrap after privacy commands and fresh analytics consent. The actual
   shared Google runtime needs this for initialization. No dedicated-container
   tag fires on bootstrap; setup and purchase still require the exact custom
   event. No site-wide snippet or noscript iframe is installed. There is no direct
   receipt `gtag('js'/'config'/'event')` path or parallel direct Google SDK request.
6. A guarded one-shot script-load callback rechecks fresh receipt validity and
   current consent before pushing the custom event. Repeated callbacks do not
   resend. Loader errors, expiry and uncertain attempts are never retried.
7. Existing withdrawal/navigation/pagehide/cross-tab handling clears queued
   events, sends all-four denial, sets `ga-disable-G-H10PHV2XNG`, and discards the
   document where appropriate. A callback arriving after retirement cannot emit.

The payload includes no learner, chapter, health/contact information, raw Stripe
ID or click IDs. The shared Google tag's automatic user-data detection remains
on, without custom selectors. The receipt document has no input fields or
personal/learner content for those detectors. This is not a same-origin security
sandbox or a promise of zero automatic vendor events. The defensible guarantees
are the tested application payload, consent gates, request routing and clean
document; vendor-generated behavior requires the separate real-SDK checks.

## Required release order

1. Independently review the exact saved native container configuration/export,
   DLV types, sole destination, event/host/path/URL trigger, consent requirements,
   setup sequencing, privacy settings and absence of broad/extra tags.
2. Obtain authorization for publishing that reviewed, currently unreferenced
   container. Publishing is separate from this local code task. Confirm the exact
   container/version and keep production's direct Google code untouched.
3. Fetch that published container's actual generated SDK and any required Google
   runtime for local, network-blocked validation. Cache only public SDK assets;
   block every analytics/advertising collection request and all unapproved
   network traffic. Use synthetic receipts, never inject a fake live Purchase.
   Verify type preservation through native variables/tags, setup ordering,
   consent-gated bootstrap and custom-event processing, unchanged CSP,
   exact destination and collected fields, and withdrawal/late-loader behavior.
   Mock tests do not prove these native/runtime properties.
4. Review the frozen code against the then-current production branch without
   dropping intervening changes. Run exact-head CI and a preview with no production
   receipt secret. Keep no-receipt tracking fail-closed; test receipt flows only
   with blocked-network synthetic fixtures.
5. After the gates pass, atomically deploy the direct-to-GTM replacement.
   Never enable both delivery paths. Preserve the Google attempt namespace so
   rollback/rollforward cannot replay existing attempts. Validate actual ingestion
   only through an approved genuine purchase or separately approved isolated test.

If any gate fails, keep production direct Google working. Do not weaken CSP,
remove consent checks, add a second destination or publish a partial migration.

## Actual SDK observations (blocked network)

The initial candidate without `gtm.js` bootstrap preserved native DLV types and
loaded the Google runtime but produced no purchase. The actual runtime's `__gct`
initialization rule depends on `gtm.js`. A minimal, receipt-only bootstrap after
consent restored one GA4 purchase with numeric amount, THB, opaque transaction ID,
canonical metadata and the expected cookie prefix, with no PageView observed.

The actual runtime also attempts automatic vendor diagnostics. GTM may request
`/a`, `/td` or `/gtm.js?is_td=1` with container/runtime diagnostics and the clean
receipt page. These are telemetry, not static SDK dependencies to fetch. The
harness records them and serves a local empty response. During a synthetic
`pagehide` that deliberately keeps the old document alive, diagnostics may still
be attempted after retirement even though no GA4 or Ads-bridge Purchase is
attempted. Actual withdrawal, learning navigation and cross-tab denial replace
the document; the tested delayed-runtime cases then produce no late diagnostics.

Both the existing direct-Google baseline and the GTM variant attempt a linked
Google Ads measurement bridge at `pagead2.googlesyndication.com` (fetch and image
fallback). The unchanged receipt CSP blocks these attempts before transport.
No CSP expansion is permitted. This is not evidence of a new direct Ads action,
Training purchase import, ad attribution or account-side ingestion. It also
means a claim of no automatic Ads-side attempt would be inaccurate.

All runtime results concern synthetic data and locally intercepted requests.
No vendor collection request, live purchase or real transaction was sent.
Exact SDK hashes, per-case evidence and release status are kept separately in
the local review artifacts; these public SDK caches are not shipping source.
