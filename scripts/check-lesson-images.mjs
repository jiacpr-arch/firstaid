// ตรวจว่าสื่อทุกชิ้น (รูป + วิดีโอที่อัปเอง) ที่อ้างอิงในบทเรียนมีไฟล์จริง
// และเตือนไฟล์ที่ไม่ถูกใช้งาน — วิดีโอ YouTube (field youtube) เป็นลิงก์ภายนอก จึงข้ามการตรวจไฟล์
// รัน: npm run check:images
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { lessons } from '../src/courses/firstaid/lessons.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const mediaDirs = [join(publicDir, 'lesson-images'), join(publicDir, 'lesson-videos')]

// เก็บ src ของสื่อทุกตัวจากทุก step (รูป + วิดีโอที่อัปเอง + poster)
const refs = [] // { src, lessonId, kind }
const add = (src, lessonId, kind) => { if (src) refs.push({ src, lessonId, kind }) }
for (const lesson of lessons) {
  for (const step of lesson.steps ?? []) {
    if (step.type === 'image') add(step.src, lesson.id, 'รูป')
    if (step.image?.src) add(step.image.src, lesson.id, 'รูป')
    if (step.type === 'video') { add(step.src, lesson.id, 'วิดีโอ'); add(step.poster, lesson.id, 'poster') }
    if (step.video) { add(step.video.src, lesson.id, 'วิดีโอ'); add(step.video.poster, lesson.id, 'poster') }
  }
}

const errors = []
const used = new Set()

for (const { src, lessonId, kind } of refs) {
  if (/^https?:\/\//.test(src)) continue // URL ภายนอก (เช่นอัปจากหน้า admin → Supabase) ไม่ตรวจไฟล์
  if (!src.startsWith('/')) {
    errors.push(`บท "${lessonId}": ${kind} src ต้องขึ้นต้นด้วย "/" (พบ "${src}")`)
    continue
  }
  const filePath = join(publicDir, src) // public/ คือ root ของ path ที่ขึ้นต้นด้วย /
  if (!existsSync(filePath)) {
    errors.push(`บท "${lessonId}": ไม่พบไฟล์${kind} "${src}" (คาดว่าอยู่ที่ public${src})`)
  } else {
    used.add(resolve(filePath))
  }
}

// เตือน (ไม่ใช่ error) ไฟล์สื่อที่ไม่มีบทไหนอ้างถึง
const orphans = []
for (const dir of mediaDirs) {
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (name === 'README.md' || name.startsWith('.')) continue
    const full = resolve(join(dir, name))
    if (!used.has(full)) orphans.push(join(dir.split('/').pop(), name))
  }
}

console.log(`ตรวจสื่อในบทเรียน: อ้างอิง ${refs.length} ชิ้น จาก ${lessons.length} บท`)

if (orphans.length) {
  console.warn(`\n⚠️  ไฟล์สื่อที่ยังไม่มีบทไหนใช้ (${orphans.length}):`)
  for (const o of orphans) console.warn(`   - ${o}`)
}

if (errors.length) {
  console.error(`\n❌ พบปัญหา ${errors.length} จุด:`)
  for (const e of errors) console.error(`   - ${e}`)
  process.exit(1)
}

console.log('\n✅ สื่อทุกชิ้นที่อ้างอิง (ที่เป็นไฟล์) มีครบ')
