// Keep the saved choice scoped to this service, including on sibling domains.
window.JIA_CONSENT = {
  color: '#c8212d', onColor: '#ffffff', simple: true, compact: true, fab: true,
  policyUrl: 'https://jiacpr.com/terms',
  storageKey: 'jia_consent_' + location.hostname.replace(/[^a-z0-9]/gi, '_'),
  historyKey: 'jia_consent_history_' + location.hostname,
};
// The course asks separately for each Google purpose. Keep the shared bar's
// Google signals out of the isolated training tag's queue.
if (!window.gtag && !window.dataLayer) {
  window.jiaConsentOnlyGtag = function () {};
  window.gtag = window.jiaConsentOnlyGtag;
  window.jiaConsentEmptyLayer = window.dataLayer = [];
}
