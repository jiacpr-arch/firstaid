// ตรวจจับ in-app browser ของโซเชียล (เบราว์เซอร์ในแอป) จาก userAgent
//
// ทราฟิกจากโฆษณา Facebook/Instagram จะเปิด landing page ในเบราว์เซอร์ในแอปของตัวเอง
// ซึ่งมักทำให้การกดลิงก์ไปแอป LINE (deep link) ค้างหรือไม่กลับมา ทำให้ผู้ใช้แอด LINE ไม่สำเร็จ
// เราตรวจจับแล้วแนะนำให้เปิดในเบราว์เซอร์จริง (Chrome/Safari) เพื่อให้ flow แอด LINE ลื่นขึ้น
//
// หมายเหตุ: ไม่นับเบราว์เซอร์ในแอป LINE เอง เพราะถ้าผู้ใช้อยู่ในแอป LINE อยู่แล้ว การแอด OA ทำได้ปกติ
export function detectInAppBrowser() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook'
  if (/Instagram/.test(ua)) return 'instagram'
  return null
}

// true เฉพาะกรณีที่ควรเตือน (FB/IG) — ปลอดภัยถ้า navigator ไม่มี
export function shouldWarnInAppBrowser() {
  return detectInAppBrowser() !== null
}
