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
  // แอป Google (สแกน QR ด้วย Google Lens / กดลิงก์จากผลค้นหา) เปิดหน้าในเบราว์เซอร์ของแอปเอง ("GSA/<ver>")
  // ล็อกอิน LINE ผ่านระบบกลางในนี้วนหน้า "เข้าสู่ระบบ" ↔ "อนุญาต" ไม่จบ (เจอจริงตอนทดลองคลาส พ.ย. 69)
  if (/\bGSA\/[\d.]+/.test(ua)) return 'google'
  return null
}

// true เฉพาะกรณีที่ควรเตือน (FB/IG/LINE) — ปลอดภัยถ้า navigator ไม่มี
export function shouldWarnInAppBrowser() {
  return detectInAppBrowser() !== null
}

// เบราว์เซอร์ติดเครื่องของ Android ที่ไม่ใช่ Chrome (Xiaomi/Realme-OPPO/vivo/Huawei/UC) — สแกน QR ด้วยกล้อง
// แล้วเปิดในนี้ ล็อกอิน LINE ผ่านระบบกลางเด้งไปแอป LINE แล้วไม่กลับมาเบราว์เซอร์นี้ (เจอจริงคลาส ซีเอ็มเอ 2/2569)
// ใช้เฉพาะหน้าเข้าคลาส (JoinClass) ให้พาไปเปิดใน Chrome ก่อน — ไม่รวมใน detectInAppBrowser เพราะไม่ใช่แอปโซเชียล
export function detectAndroidOemBrowser() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (!/Android/i.test(ua)) return null
  if (/MiuiBrowser|XiaoMi\//i.test(ua)) return 'Xiaomi'
  if (/HeyTapBrowser|OppoBrowser|OPBrowser/i.test(ua)) return 'Realme/OPPO'
  if (/VivoBrowser|vivobrowser/i.test(ua)) return 'vivo'
  if (/HuaweiBrowser|HONORBrowser/i.test(ua)) return 'Huawei'
  if (/UCBrowser/i.test(ua)) return 'UC'
  return null
}
