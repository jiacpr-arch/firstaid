// สร้าง public/og-image.png (1200×630) — การ์ดโซเชียลสำหรับ og:image/twitter:image
// รันครั้งเดียวแล้ว commit ผลลัพธ์ (ไม่ได้อยู่ใน build): node scripts/generate-og-image.mjs
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = new URL('..', import.meta.url).pathname
const FONT_DIR = `${ROOT}node_modules/@fontsource/noto-sans-thai/files`

const html = `<!doctype html>
<html>
<head>
<style>
  @font-face {
    font-family: 'Noto Sans Thai';
    font-weight: 400;
    src: url('file://${FONT_DIR}/noto-sans-thai-thai-400-normal.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Noto Sans Thai';
    font-weight: 700;
    src: url('file://${FONT_DIR}/noto-sans-thai-thai-700-normal.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Noto Sans Thai';
    font-weight: 800;
    src: url('file://${FONT_DIR}/noto-sans-thai-thai-800-normal.woff2') format('woff2');
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    font-family: 'Noto Sans Thai', sans-serif;
    background: linear-gradient(160deg, #0F1A2E 0%, #14532D 100%);
    color: #fff;
    display: flex; flex-direction: column; justify-content: center;
    padding: 72px 80px;
    position: relative; overflow: hidden;
  }
  .cross {
    position: absolute; right: -60px; top: -60px; opacity: 0.12;
    width: 460px; height: 460px;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(255,255,255,0.14); border-radius: 999px;
    padding: 10px 26px; font-size: 28px; font-weight: 700;
    width: fit-content;
  }
  .badge .dot { width: 16px; height: 16px; border-radius: 50%; background: #4ADE80; }
  h1 { font-size: 96px; font-weight: 800; line-height: 1.15; margin-top: 36px; }
  h1 .accent { color: #4ADE80; }
  .sub { font-size: 38px; font-weight: 400; margin-top: 28px; color: rgba(255,255,255,0.88); }
  .brand { display: flex; align-items: center; gap: 16px; margin-top: 44px; }
  .brand .mark {
    width: 52px; height: 52px; border-radius: 12px; background: #16A34A;
    display: grid; place-items: center;
  }
  .brand .mark svg { width: 34px; height: 34px; }
  .brand span { font-size: 30px; font-weight: 700; }
</style>
</head>
<body>
  <svg class="cross" viewBox="0 0 192 192"><rect x="80" y="44" width="32" height="104" rx="8" fill="#fff"/><rect x="44" y="80" width="104" height="32" rx="8" fill="#fff"/></svg>
  <div class="badge"><span class="dot"></span>คอร์สออนไลน์ฟรี พร้อมใบประกาศ</div>
  <h1>4 นาที<br><span class="accent">คือเส้นแบ่งชีวิต</span></h1>
  <div class="sub">เรียนปฐมพยาบาลเบื้องต้นออนไลน์ฟรี ทำ CPR / AED เป็น พร้อมใบประกาศ</div>
  <div class="brand">
    <div class="mark"><svg viewBox="0 0 192 192"><rect x="80" y="44" width="32" height="104" rx="8" fill="#fff"/><rect x="44" y="80" width="104" height="32" rx="8" fill="#fff"/></svg></div>
    <span>firstaid.morroo.com — Jia Training Center</span>
  </div>
</body>
</html>`

const tmp = `${ROOT}node_modules/.og-template.html`
writeFileSync(tmp, html)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto(`file://${tmp}`)
await page.waitForTimeout(500) // รอฟอนต์
await page.screenshot({ path: `${ROOT}public/og-image.png` })
await browser.close()
console.log('generate-og-image: public/og-image.png (1200x630) written')
