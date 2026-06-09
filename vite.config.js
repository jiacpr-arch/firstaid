import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const manifest = {
  name: 'ปฐมพยาบาลเบื้องต้น',
  short_name: 'ปฐมพยาบาล',
  description: 'หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน — เรียนทฤษฎีออนไลน์ และฝึกปฏิบัติกับครูผู้สอน',
  theme_color: '#16A34A',
  background_color: '#F4F6FA',
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
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
})
