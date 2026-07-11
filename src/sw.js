import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

precacheAndRoute(self.__WB_MANIFEST || [])

// SPA offline fallback: การเปิด/รีเฟรช deep link (/learn/:id, /call, …) ตอน
// ออฟไลน์ต้องได้ index.html จาก precache — ไม่งั้น browser โชว์หน้า error ทั้งที่
// จุดขายของแอปคือใช้ได้ตอนฉุกเฉินไม่มีเน็ต (ยกเว้น /api/* ที่ต้องวิ่งขึ้น network)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  })
)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
