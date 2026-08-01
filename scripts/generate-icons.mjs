// สร้างไอคอน PWA เป็น PNG จาก public/icon.svg — Android/iOS ต้องมี 192/512 PNG
// (manifest เดิมมีแค่ SVG ตัวเดียว ทำให้ installability/Lighthouse ตก)
// รันครั้งเดียวแล้ว commit ผลลัพธ์: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = new URL('..', import.meta.url).pathname
const svg = readFileSync(`${ROOT}public/icon.svg`, 'utf8')
mkdirSync(`${ROOT}public/icons`, { recursive: true })

// any: ใช้ svg เดิมเต็มพื้นที่ (มีมุมโค้งในตัว)
// maskable: พื้นเขียวเต็ม + กากบาทย่อไว้ใน safe zone 80% (มุมโค้งให้ OS ตัดเอง)
function pageHtml(size, { maskable }) {
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#16A34A;display:grid;place-items:center">
         <svg width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" viewBox="44 44 104 104">
           <rect x="80" y="44" width="32" height="104" rx="8" fill="#FFFFFF"/>
           <rect x="44" y="80" width="104" height="32" rx="8" fill="#FFFFFF"/>
         </svg>
       </div>`
    : svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
  return `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px}</style></head><body>${inner}</body></html>`
}

const browser = await chromium.launch()
// หมายเหตุ: public/apple-touch-icon.png ไม่ได้สร้างจากสคริปต์นี้ — เป็นโลโก้จริง
// ของ Jia Training Center (มาจาก main) อย่า generate ทับ
const jobs = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
]
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } })
  const tmp = `${ROOT}node_modules/.icon-template.html`
  writeFileSync(tmp, pageHtml(job.size, job))
  await page.goto(`file://${tmp}`)
  await page.screenshot({ path: `${ROOT}${job.file}`, omitBackground: !job.maskable })
  await page.close()
  console.log(`generate-icons: ${job.file}`)
}
await browser.close()
