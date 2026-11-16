import { guestReturn } from '../_lib/stripeCheckout.js'

// GET /api/checkout/return?chapter=N&session_id=cs_… — Stripe success_url ของการซื้อแบบ guest (ยังไม่ล็อกอิน)
// เก็บ session id ไว้ใน cookie HttpOnly ที่ส่งไปเฉพาะ /api/checkout/claim (30 วัน) แล้วพากลับ /buy?guest_paid=N
// session id ไม่อยู่ใน URL ของแอป จึงไม่หลุดไป analytics / referrer / ประวัติหน้าแอป
export default function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const { location, cookie } = guestReturn(req.query || {})
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (cookie) res.setHeader('Set-Cookie', cookie)
  res.setHeader('Location', location)
  res.status(303).end()
}
