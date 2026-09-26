import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const manifest = {
  name: 'ปฐมพยาบาลเบื้องต้น',
  short_name: 'ปฐมพยาบาล',
  description: 'หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน — เรียนทฤษฎีออนไลน์ และฝึกปฏิบัติกับครูผู้สอน',
  theme_color: '#23736A',
  background_color: '#FAFAF5',
  display: 'standalone',
  orientation: 'any',
  start_url: '/',
  id: '/firstaid',
  shortcuts: [
    {
      name: 'โทร 1669',
      short_name: '1669',
      description: 'โทรเรียกรถพยาบาลทันที',
      url: '/call',
    },
  ],
  icons: [
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.svg', 'icon.svg', 'cert-logo.png', 'icons/*.png', 'apple-touch-icon.png'],
      manifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
        // og-image ใช้เฉพาะตอนแชร์ลิงก์ — ไม่ต้อง precache ให้เปลืองเน็ตผู้ใช้
        // รูปเกม (ฉาก+ตัวละคร) หลาย MB ไม่เข้า precache เช่นกัน — ไม่งั้น SW เวอร์ชันใหม่
        // ต้องโหลดทั้งชุดก่อน activate ทำให้ผู้ใช้เน็ตช้าค้างเวอร์ชันเก่านานมาก
        // (เกมใช้ runtime cache ใน sw.js แทน — โหลดเมื่อเล่นแล้วเก็บไว้ออฟไลน์ได้)
        globIgnores: ['og-image.jpg', 'images/backgrounds/**', 'images/characters/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
})
