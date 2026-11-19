// Keep the saved choice scoped to this service, including on sibling domains.
window.JIA_CONSENT = {
  color: '#c8212d', onColor: '#ffffff', simple: true, compact: true, fab: true,
  policyUrl: 'https://jiacpr.com/terms',
  storageKey: 'jia_consent_' + location.hostname.replace(/[^a-z0-9]/gi, '_'),
  historyKey: 'jia_consent_history_' + location.hostname,
};
window.dataLayer = window.dataLayer || [];
window.gtag = function(command, action, settings) {
  if (command === 'consent' && settings) settings.ad_personalization = 'denied';
  window.dataLayer.push(arguments);
};
