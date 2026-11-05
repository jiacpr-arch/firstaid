# FirstAid public landing measurement

## Destinations and meaning

The owner confirmed that JIA training GA4 stream `G-H10PHV2XNG`, already used by `class.jiacpr.com`, should also measure the FirstAid and CPR public course introductions. FirstAid uses that stream and Google Ads account tag `AW-873507669`.

The application sends one manual GA4 `page_view` per eligible document. A click on the public practical-course LINE link sends GA4 `contact` and Google Ads contact action `AW-873507669/nOwLCPvsjdgYENXWwqAD`. These measure contact intent, not enrollment, a completed form, revenue, or a purchase. Emergency telephone 1669 has no advertising event handler.

## Consent and isolation

Google has its own new consent key, `firstaid_jia_training_google_consent_v1`. A Meta or legacy grant cannot authorize Google. No Google script, queue, preload, or consent request is created before an explicit Google grant. The two vendors share a scrollable control container but retain independent choices.

Only the anonymous public landing at `https://firstaid.morroo.com/` can load either vendor. Auth resolution and learning progress must already be resolved; any identity, learning progress, private route, unsafe query, or unsafe referrer prevents loading. A document that has displayed private UI can never become an advertising document through SPA navigation.

Before Google loads, the application installs a navigation boundary. Unsafe internal links are intercepted before React or later SDK click handlers. SPA history changes that leave the current public URL become full document navigations without first mutating the SDK-bearing document's URL. The application also refuses to render private content in an SDK-bearing document. Withdrawal, cross-tab withdrawal, and page restoration discard the SDK-bearing document; removing a script is not treated as unloading it. Storage failures fail closed and failed grants are rolled back to denial.

All explicit Google payloads use a fixed public page URL, title, and empty referrer. No identity, answers, learning results, matching data, revenue, or transaction identifiers are supplied. Both Google destinations use `cookie_domain: firstaid.morroo.com` and the separate `firstaid_training` cookie prefix. Linker domains are empty, incoming linker acceptance and form decoration are disabled, and URL passthrough is disabled. Consent for `ad_user_data` and `ad_personalization` remains denied. Google Signals, advertising personalization signals, and enhanced conversions are disabled in the relevant configuration. An explicit empty `user_data: null` override is applied globally, on both destination configurations, and on every manual event to suppress user-provided-data collection. This does not claim to disable the SDK's DOM detector itself.

`VITE_ENABLE_TRAINING_GOOGLE_TAGS=false` is an emergency build-time kill switch. The source is otherwise enabled, subject to eligibility and fresh Google consent. It cannot accept an arbitrary replacement destination ID through environment configuration.

## Verification and limits

Unit tests cover independent vendor grants, clean event payloads, URL isolation, withdrawal, failed storage, cross-tab withdrawal, and cached documents. The browser suite stubs both SDKs, blocks every other network request and WebSocket, observes history before React effects, watches for private URLs and inserted forms, and verifies that private navigation creates a clean document. It must run in CI; local Chromium execution is unavailable in the current environment. A local SPA build is not a substitute for the full prerender build or browser suite.

The tests never contact Google or Meta and cannot prove account-side event ingestion. A read-only inspection of the public Google tag configuration on 5 November 2026 found automatic user-data detection and Enhanced Measurement enabled. This change does not alter Google Admin, destination links, key-event definitions, or those account-side settings. `send_page_view: false` disables the tag's automatic configuration pageview, not every account-side Enhanced Measurement feature. Privacy protection comes from keeping the entire SDK document limited to a public, anonymous page and discarding it before private navigation. No new cross-domain or identity-based reporting is enabled.

## Official configuration references

- Cookie domains and prefixes: https://developers.google.com/tag-platform/security/guides/customize-cookies
- Cross-domain linker options: https://developers.google.com/tag-platform/devguides/cross-domain
- Consent mode: https://developers.google.com/tag-platform/security/guides/consent
- Google advertising privacy options: https://developers.google.com/tag-platform/security/guides/privacy
- GA4 configuration parameters: https://developers.google.com/analytics/devguides/collection/ga4/reference/config
- Enhanced Measurement: https://support.google.com/analytics/answer/9216061

- Empty user-data opt-out: https://support.google.com/google-ads/answer/13262500?hl=en
