// ตรวจว่ารูปทุกรูปที่อ้างอิงในบทเรียนมีไฟล์จริง และเตือนรูปที่ไม่ถูกใช้งาน
// รัน: npm run check:images
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { lessons } from '../src/courses/firstaid/lessons.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const imagesDir = join(publicDir, 'lesson-images')

// เก็บ src ของรูปทุกตัวจากทุก step (step 'image' และ field image บน step อื่น)
const refs = [] // { src, lessonId }
for (const lesson of lessons) {
  for (const step of lesson.steps ?? []) {
    if (step.type === 'image' && step.src) refs.push({ src: step.src, lessonId: lesson.id })
    if (step.image?.src) refs.push({ src: step.image.src, lessonId: lesson.id })
  }
}

const errors = []
const used = new Set()

for (const { src, lessonId } of refs) {
  if (!src.startsWith('/')) {
    errors.push(`บท "${lessonId}": src ต้องขึ้นต้นด้วย "/" (พบ "${src}")`)
    continue
  }
  const filePath = join(publicDir, src) // public/ คือ root ของ path ที่ขึ้นต้นด้วย /
  if (!existsSync(filePath)) {
    errors.push(`บท "${lessonId}": ไม่พบไฟล์รูป "${src}" (คาดว่าอยู่ที่ public${src})`)
  } else {
    used.add(resolve(filePath))
  }
}

// เตือน (ไม่ใช่ error) รูปใน lesson-images/ ที่ไม่มีบทไหนอ้างถึง
const orphans = []
if (existsSync(imagesDir)) {
  for (const name of readdirSync(imagesDir)) {
    if (name === 'README.md' || name.startsWith('.')) continue
    if (!used.has(resolve(join(imagesDir, name)))) orphans.push(name)
  }
}

console.log(`ตรวจรูปในบทเรียน: อ้างอิง ${refs.length} รูป จาก ${lessons.length} บท`)

if (orphans.length) {
  console.warn(`\n⚠️  รูปที่ยังไม่มีบทไหนใช้ (${orphans.length}):`)
  for (const o of orphans) console.warn(`   - lesson-images/${o}`)
}

if (errors.length) {
  console.error(`\n❌ พบปัญหา ${errors.length} จุด:`)
  for (const e of errors) console.error(`   - ${e}`)
  process.exit(1)
}

console.log('\n✅ รูปทุกรูปที่อ้างอิงมีไฟล์ครบ')
