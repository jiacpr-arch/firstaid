// ตรวจว่ากำลังรันใน browser อัตโนมัติ (Playwright ตอน prerender, bot ทั่วไป)
// ใช้กันไม่ให้ analytics (PostHog / Meta Pixel / Vercel) ยิง event ปลอมตอน build
export const isAutomated =
  typeof navigator !== 'undefined' && navigator.webdriver === true
