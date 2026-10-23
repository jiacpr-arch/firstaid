// PWA ค้างเวอร์ชันเก่า: sw.js เวอร์ชันใหม่ skipWaiting + clients.claim ทันทีก็จริง แต่หน้าที่เปิดอยู่
// ยังรัน JS ชุดเก่าที่โหลดไว้แล้ว — ผู้ใช้ที่เปิดแท็บค้างไว้ (เช่นในเบราว์เซอร์มือถือ) จึงไม่เห็นของใหม่เลย
// ตัวนี้: เช็ก SW ใหม่เป็นระยะ + ทุกครั้งที่กลับมาที่แท็บ และพอ SW ใหม่ยึดหน้าแล้วก็รีโหลดให้เอง
// ยกเว้นหน้าที่กำลังทำอะไรค้างอยู่ (สอบ/สถานการณ์จำลอง/เกม/บทเรียน/admin) — รอเปลี่ยนหน้าครั้งถัดไปค่อยรีโหลด

const CHECK_EVERY_MS = 30 * 60 * 1000
const BUSY_PATHS = [/^\/(pre|post)-test/, /^\/simulation\/./, /^\/game/, /^\/learn\/./, /^\/checkin/, /^\/admin/, /^\/scan\//, /^\/auth\//]

let pending = false
let started = false

const isBusy = (pathname) => BUSY_PATHS.some((re) => re.test(pathname))

function reload() {
  pending = false
  window.location.reload()
}

export function initAppUpdate() {
  if (started || !('serviceWorker' in navigator)) return
  started = true
  const sw = navigator.serviceWorker
  // ครั้งแรกที่ติดตั้ง SW (ยังไม่มีตัวคุมหน้า) ก็ยิง controllerchange — ไม่ต้องรีโหลด
  let hadController = !!sw.controller

  sw.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return }
    if (isBusy(window.location.pathname)) pending = true
    else reload()
  })

  const check = () => sw.getRegistration().then((reg) => reg?.update()).catch(() => {})
  setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

// เรียกทุกครั้งที่เปลี่ยนหน้า: มีเวอร์ชันใหม่รออยู่และหน้าใหม่ไม่ได้ทำอะไรค้าง → รีโหลดเป็นเวอร์ชันใหม่
export function applyPendingUpdate(pathname) {
  if (pending && !isBusy(pathname)) reload()
}
