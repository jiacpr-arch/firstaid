function fbqCustom(event, props) {
  try { window.fbq?.('trackCustom', event, props) } catch { /* tracking must not crash */ }
}

export function track(event, props = {}) {
  fbqCustom(event, props)
}
