// ตรวจจับ in-app browser ของโซเชียล (เบราว์เซอร์ในแอป) จาก userAgent
//
// ทราฟิกจากโฆษณา Facebook/Instagram จะเปิด landing page ในเบราว์เซอร์ในแอปของตัวเอง
// ซึ่งมักทำให้การกดลิงก์ไปแอป LINE (deep link) ค้างหรือไม่กลับมา ทำให้ผู้ใช้แอด LINE ไม่สำเร็จ
// เราตรวจจับแล้วแนะนำให้เปิดในเบราว์เซอร์จริง (Chrome/Safari) เพื่อให้ flow แอด LINE ลื่นขึ้น
//
// รวมเบราว์เซอร์ในแอป LINE ด้วย เพราะตอน LINE Login เด้งกลับมาที่ /auth/line/callback
// มันมักสร้าง browsing context ใหม่ ทำให้ sessionStorage/cookie ที่เก็บ state+nonce หาย
// → callback เช็ค state ไม่ผ่าน แล้วขึ้น "เซสชันหมดอายุ" ล็อกอินไม่สำเร็จ
// การแอด OA ผ่าน LINE Login ยังทำงานได้แม้เปิดใน Chrome/Safari (LINE app เด้งขึ้นมาให้ยืนยันเอง)
export function detectInAppBrowser() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook'
  if (/Instagram/.test(ua)) return 'instagram'
  // เบราว์เซอร์ในแอป LINE ใส่โทเคน "Line/<version>" ใน UA (เช่น "Line/13.5.0")
  // ระวังไม่ให้ชนคำอื่น จึงบังคับให้ตามด้วย / แล้วเป็นตัวเลขเวอร์ชัน
  if (/\bLine\/[\d.]+/i.test(ua)) return 'line'
  return null
}

// true เฉพาะกรณีที่ควรเตือน (FB/IG/LINE) — ปลอดภัยถ้า navigator ไม่มี
export function shouldWarnInAppBrowser() {
  return detectInAppBrowser() !== null
}
