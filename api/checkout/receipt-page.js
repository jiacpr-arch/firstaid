// Intentionally outside the React/PWA application. Older service workers already
// exclude /api/*, so they cannot replace this document with a learner app shell.
export const RECEIPT_HTML = `<!doctype html><html lang="th"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>ยืนยันการซื้อ | JiaCPR Training</title>
<style>body{font:18px/1.7 system-ui,sans-serif;color:#173b36;background:#fafaf5;margin:0}main{max-width:640px;margin:40px auto;padding:24px}section{border:1px solid #bccbc6;border-radius:12px;padding:18px;margin:18px 0;background:white}button,a{font:inherit;padding:10px;display:inline-block;margin:5px;border-radius:8px}button{cursor:pointer}a{color:#17695c}small{display:block} [hidden]{display:none!important}</style>
</head><body><main><h1 id="title">ตรวจสอบรายการซื้อ</h1>
<p id="status" role="status">กำลังตรวจสอบ กรุณารอสักครู่</p>
<div id="choices" hidden>
<p>การวัดผลเป็นทางเลือก ไม่กระทบสิทธิ์เรียน ระบบส่งยอดซื้อ สกุลเงิน และรหัสรายการแบบไม่เปิดเผยเลข Stripe ผู้ให้บริการยังได้รับข้อมูลการเข้าชม IP ข้อมูลเบราว์เซอร์ และรหัสคุกกี้ตามการทำงานของแท็ก ไม่ส่งชื่อ เบอร์โทร ข้อมูลสุขภาพ หรือผลการเรียน</p>
<section><h2>Meta</h2><p>อนุญาตให้ Meta Pixel ของ JiaCPR Training วัดการซื้อครั้งนี้เพื่อวัดผลโฆษณาหรือไม่?</p><button data-vendor="meta" data-choice="granted">อนุญาต Meta</button><button data-vendor="meta" data-choice="denied">ไม่อนุญาต / ถอนความยินยอม Meta</button><small id="meta-status"></small></section>
<section><h2>Google Analytics</h2><p>อนุญาตให้ Google Analytics ของ JiaCPR Training วัดยอดซื้อ การเข้าชม และการใช้งานทั่วไปเฉพาะหน้ายืนยันนี้หรือไม่? อาจมีการวัดการเลื่อนหรือการกดลิงก์ในหน้านี้ ไม่เปิด Google Signals หรือส่งข้อมูลสำหรับจับคู่ผู้ใช้</p><button data-vendor="google" data-choice="granted">อนุญาต Google Analytics</button><button data-vendor="google" data-choice="denied">ไม่อนุญาต / ถอนความยินยอม Google</button><small id="google-status"></small></section>
</div><a href="/learn" rel="noreferrer">ไปหน้าบทเรียน</a><p><small>การวัดผลนี้ไม่ใช่ใบเสร็จรับเงิน และคุณไม่จำเป็นต้องอนุญาตเพื่อเรียนต่อ</small></p></main>
<script type="module" src="/purchase-receipt.js"></script></body></html>`

export const RECEIPT_CSP = "default-src 'none'; script-src 'self' https://connect.facebook.net https://www.googletagmanager.com; style-src 'unsafe-inline'; img-src https://www.facebook.com data:; connect-src 'self' https://www.facebook.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', RECEIPT_CSP)
  if (req.method !== 'GET') return res.status(405).end()
  return res.status(200).send(RECEIPT_HTML)
}
