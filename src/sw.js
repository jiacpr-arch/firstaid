import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST || [])

// รูปเกม (ฉาก+ตัวละคร) ไม่อยู่ใน precache (ดู globIgnores ใน vite.config.js) —
// cache ตอนใช้งานจริงแทน: โหลดครั้งแรกจาก network แล้วเล่นออฟไลน์ได้เหมือนเดิม
// ไฟล์พวกนี้แก้ทีไรเปลี่ยนชื่อไม่ได้ (path ตายตัว) จึงให้หมดอายุใน 30 วันกันรูปเก่าค้าง
registerRoute(
  ({ url }) => url.pathname.startsWith('/images/backgrounds/')
    || url.pathname.startsWith('/images/characters/'),
  new CacheFirst({
    cacheName: 'game-art',
    plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
)

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
