// Synthetic classic-script SDK fixtures only. No network calls or real SDK code.
// Each script owns its lexical scope, just as independently loaded vendors do.
// The Node regression test executes both orders in one realm to catch collisions.
export const GOOGLE_SDK_STUB = `
(() => {
  window.__stubGoogleLoaded = true;
  const observe = (reason, insertedPrivateNodes = false) => window.__recordAdBoundary('googleObservation', {
    documentId: window.__documentId, reason, url: location.href,
    forms: document.querySelectorAll('#root form, #root input, #root textarea').length,
    privateNodes: document.querySelectorAll('#root .page-container').length, insertedPrivateNodes,
    canonical: document.querySelector('link[data-seo][rel=canonical]')?.href || null,
  });
  const record = args => {
    observe('command');
    window.__recordAdBoundary('google', { documentId: window.__documentId, args: Array.from(args) });
  };
  const queued = window.dataLayer.splice(0);
  window.dataLayer.push = (...rows) => { rows.forEach(record); return 0; };
  queued.forEach(record);
  // Model a later SDK observing the argument before our guard, as well as
  // actual location after delegation. Argument concealment is not guaranteed.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      window.__recordAdBoundary('googleHistoryArgument', {
        documentId: window.__documentId, method, target: typeof args[2] === 'string' ? args[2] : null,
      });
      const result = original.apply(this, args);
      observe(method);
      return result;
    };
  }
  new MutationObserver(records => {
    const privateSelector = '.page-container, form, input, textarea';
    const insertedPrivateNodes = records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches(privateSelector) || node.querySelector(privateSelector))));
    observe('dom', insertedPrivateNodes);
  }).observe(document.getElementById('root'), { childList: true, subtree: true });
  new MutationObserver(() => observe('head')).observe(document.head, { childList: true, subtree: true, attributes: true });
  for (const event of ['popstate', 'hashchange', 'pagehide']) window.addEventListener(event, () => observe(event));
})();
`

export const META_SDK_STUB = `
(() => {
  window.__stubSdkLoaded = true;
  const record = args => window.__recordAdBoundary('call', { documentId: window.__documentId, args });
  const queued = window.fbq.queue.splice(0);
  window.fbq.callMethod = (...args) => record(args);
  queued.forEach(record);
  new MutationObserver(records => {
    if (location.pathname !== '/' && records.some(r => [...r.addedNodes].some(n => n.nodeType === 1))) {
      window.__recordAdBoundary('mount', { documentId: window.__documentId, path: location.pathname });
    }
  }).observe(document.getElementById('root'), { childList: true, subtree: true });
})();
`
