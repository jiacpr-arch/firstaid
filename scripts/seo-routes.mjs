// แหล่งเดียวของรายการ URL public ทั้งเว็บ — ใช้ร่วมกันโดย generate-seo-files.mjs
// (sitemap) และ prerender.mjs จะได้ไม่มีทางหลุด sync กัน
// import ข้อมูลคอร์สตรง ๆ ได้เพราะเป็น pure-data ESM (ไม่มี dependency ฝั่ง browser)
import { lessons } from '../src/courses/firstaid/lessons.js'
import { algorithms } from '../src/courses/firstaid/algorithms.js'
import { scenarios } from '../src/courses/firstaid/scenarios.js'

export const SITE_URL = 'https://firstaid.morroo.com'

// route → ไฟล์ data ที่กำหนดเนื้อหา (ใช้หา lastmod จาก git log)
export function buildRoutes() {
  return [
    { path: '/', source: null },
    { path: '/learn', source: 'src/courses/firstaid/lessons.js' },
    ...lessons.map((l) => ({ path: `/learn/${l.id}`, source: 'src/courses/firstaid/lessons.js' })),
    { path: '/algorithms', source: 'src/courses/firstaid/algorithms.js' },
    ...algorithms.map((a) => ({ path: `/algorithms/${a.id}`, source: 'src/courses/firstaid/algorithms.js' })),
    { path: '/simulation', source: 'src/courses/firstaid/scenarios.js' },
    ...scenarios.map((s) => ({ path: `/simulation/${s.id}`, source: 'src/courses/firstaid/scenarios.js' })),
    { path: '/call', source: null },
    { path: '/news', source: null },
    { path: '/schedule', source: null },
    { path: '/game', source: null },
    { path: '/certificate', source: null },
  ]
}
