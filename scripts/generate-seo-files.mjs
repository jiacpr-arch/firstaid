// สร้าง dist/sitemap.xml + dist/robots.txt หลัง vite build
// รันโดย npm run build (ก่อน prerender)
import { execFileSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { buildRoutes, SITE_URL } from './seo-routes.mjs'

const DIST = new URL('../dist/', import.meta.url).pathname
if (!existsSync(DIST)) {
  console.error('generate-seo-files: dist/ not found — run vite build first')
  process.exit(1)
}

// lastmod ต่อไฟล์ data จาก git — บน Vercel clone อาจ shallow/ไม่มี .git ให้ fallback เวลา build
const lastmodCache = new Map()
function lastmodOf(source) {
  if (!source) return buildTime
  if (!lastmodCache.has(source)) {
    let iso = buildTime
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', source], {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      }).trim()
      if (out) iso = out
    } catch {
      // ไม่มี git history — ใช้เวลา build
    }
    lastmodCache.set(source, iso)
  }
  return lastmodCache.get(source)
}
const buildTime = new Date().toISOString()

const routes = buildRoutes()
const urls = routes
  .map((r) => {
    const iso = lastmodOf(r.source)
    return `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${iso.slice(0, 10)}</lastmod>\n  </url>`
  })
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
writeFileSync(`${DIST}sitemap.xml`, sitemap)

const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /checkin
Disallow: /join
Disallow: /settings
Disallow: /auth/
Disallow: /pre-test
Disallow: /post-test

Sitemap: ${SITE_URL}/sitemap.xml
`
writeFileSync(`${DIST}robots.txt`, robots)

console.log(`generate-seo-files: sitemap.xml (${routes.length} URLs) + robots.txt written`)
