// Prerender หน้า public ทั้งหมด (~89 หน้า) เป็น HTML จริงหลัง vite build
// เพื่อให้ crawler เห็น title/meta/JSON-LD/เนื้อหา โดยไม่ต้องรัน JS
//
// วิธีทำงาน: serve dist/ ด้วย vite preview → เปิดแต่ละ route ใน headless Chromium
// (Playwright) → รอ <title data-seo> จาก React → เก็บ DOM ทั้งหน้าเขียนเป็น
// dist/<route>/index.html — Vercel เสิร์ฟไฟล์จริงก่อน SPA rewrite เสมอ
//
// ข้ามได้ด้วย PRERENDER_SKIP=1 (escape hatch ถ้า Chromium ใช้ไม่ได้ในบาง環境)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright'
import { buildRoutes } from './seo-routes.mjs'

const DIST = new URL('../dist/', import.meta.url).pathname
const PORT = 4173
const CONCURRENCY = 5

if (process.env.PRERENDER_SKIP === '1') {
  console.log('prerender: skipped (PRERENDER_SKIP=1)')
  process.exit(0)
}
if (!existsSync(DIST)) {
  console.error('prerender: dist/ not found — run vite build first')
  process.exit(1)
}

// domain ภายนอกที่ไม่จำเป็นต่อการ render — บล็อกกันช้า/กัน event หลุด
// (analytics ถูกปิดอยู่แล้วผ่าน navigator.webdriver แต่กันไว้อีกชั้น)
const BLOCKED = [
  'connect.facebook.net', 'facebook.com', 'posthog.com', 'i.posthog.com',
  'youtube.com', 'ytimg.com', 'googlevideo.com', 'vercel-insights.com',
]

async function launchBrowser() {
  // บน Vercel (Amazon Linux) Chromium ของ playwright ใช้ไม่ได้ — ใช้ @sparticuz/chromium
  if (process.env.VERCEL) {
    const sparticuz = (await import('@sparticuz/chromium')).default
    return chromium.launch({
      executablePath: await sparticuz.executablePath(),
      args: sparticuz.args,
    })
  }
  return chromium.launch()
}

function outputPathFor(route) {
  return route === '/' ? join(DIST, 'index.html') : join(DIST, route.slice(1), 'index.html')
}

const routes = buildRoutes().map((r) => r.path)
const server = await preview({ preview: { port: PORT, strictPort: true } })
const origin = `http://localhost:${PORT}`
const browser = await launchBrowser()

const context = await browser.newContext()
// ห้าม service worker ลงทะเบียน + บล็อก domain ภายนอก
await context.route('**/*', (route) => {
  const url = route.request().url()
  if (url.endsWith('/sw.js') || url.endsWith('/registerSW.js')) return route.abort()
  if (BLOCKED.some((d) => new URL(url).hostname.endsWith(d))) return route.abort()
  return route.continue()
})

let done = 0
const failed = []

async function renderRoute(route) {
  const page = await context.newPage()
  try {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // รอ meta ของหน้า (จาก <Seo>) ถูก hoist ขึ้น head — สัญญาณว่า React render แล้ว
    await page.waitForSelector('head title[data-seo]', { state: 'attached', timeout: 20000 })
    // เผื่อ content ที่ตามหลัง meta อีกนิด (เช่น รอ Dexie/state gate ตัดสินใจ)
    await page.waitForTimeout(300)
    const html = await page.evaluate(() => {
      // กันสคริปต์ analytics ที่อาจถูก inject ไว้หลุดเข้า snapshot
      document
        .querySelectorAll('script[src*="fbevents"], script[src*="posthog"], script[src*="/_vercel/insights"]')
        .forEach((el) => el.remove())
      return '<!doctype html>' + document.documentElement.outerHTML
    })
    const out = outputPathFor(route)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html)
    done += 1
    if (done % 20 === 0) console.log(`prerender: ${done}/${routes.length}`)
  } catch (err) {
    failed.push({ route, message: err.message?.split('\n')[0] })
  } finally {
    await page.close()
  }
}

// รันทีละชุดตาม CONCURRENCY
const queue = [...routes]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) await renderRoute(queue.shift())
  }),
)

await browser.close()
await server.close()

if (failed.length > 0) {
  console.error(`prerender: ${failed.length} route(s) failed:`)
  failed.forEach((f) => console.error(`  ${f.route}: ${f.message}`))
  process.exit(1)
}
console.log(`prerender: ${done}/${routes.length} pages written to dist/`)
