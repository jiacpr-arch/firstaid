export const PURCHASE_RECEIPT_KEY = 'firstaid_purchase_receipt_v1'
export const PURCHASE_RECEIPT_PATH = '/api/checkout/receipt-page'

// Called only after the authenticated confirm endpoint returns paid. A storage
// or navigation failure leaves the existing payment-success/learning UI intact.
export function openPurchaseReceipt(win, doc, receipt) {
  if (typeof receipt !== 'string' || receipt.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(receipt)) return false
  try {
    win.sessionStorage.setItem(PURCHASE_RECEIPT_KEY, receipt)
    if (win.sessionStorage.getItem(PURCHASE_RECEIPT_KEY) !== receipt) return false
    const meta = doc.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    doc.head.appendChild(meta)
    win.location.replace(PURCHASE_RECEIPT_PATH)
    return true
  } catch {
    try { win.sessionStorage.removeItem(PURCHASE_RECEIPT_KEY) } catch { /* no SDK is loaded here */ }
    return false
  }
}
