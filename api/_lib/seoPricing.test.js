import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION, courseJsonLd } from '../../src/lib/seo.js'
import { FREE_CHAPTER, CHAPTER_PRICES, COURSE_BUNDLE_PRICE } from '../../src/config/pricing.js'

test('public course metadata explains free preview and paid chapters accurately', () => {
  assert.match(DEFAULT_TITLE, /หมวดแรกฟรี/)
  assert.match(DEFAULT_DESCRIPTION, new RegExp(`หมวดที่ ${FREE_CHAPTER} เรียนฟรี`))
  assert.match(DEFAULT_DESCRIPTION, new RegExp(`เริ่ม ${Math.min(...Object.values(CHAPTER_PRICES))} บาท`))
  assert.match(DEFAULT_DESCRIPTION, new RegExp(`ครบทุกหมวด ${COURSE_BUNDLE_PRICE} บาท`))
  assert.doesNotMatch(DEFAULT_DESCRIPTION, /ออนไลน์ฟรีสำหรับ/)
})

test('structured course offer uses the configured bundle price, not a free whole course', () => {
  const course = courseJsonLd().find(item => item['@type'] === 'Course')
  assert.equal(course.isAccessibleForFree, false)
  assert.equal(course.offers.price, COURSE_BUNDLE_PRICE)
  assert.equal(course.offers.priceCurrency, 'THB')
  assert.equal(course.hasPart.filter(item => item.isAccessibleForFree).length, 1)
  assert.equal(course.hasPart[0].name, `บทเรียนหมวดที่ ${FREE_CHAPTER}`)
  for (const [index, [chapter, price]] of Object.entries(CHAPTER_PRICES).entries()) {
    const part = course.hasPart[index + 1]
    assert.equal(part.name, `บทเรียนหมวดที่ ${chapter}`)
    assert.equal(part.isAccessibleForFree, false)
    assert.equal(part.offers.price, price)
    assert.equal(part.offers.priceCurrency, 'THB')
  }
})

test('individual lesson metadata does not claim every paid chapter is free', () => {
  const source = readFileSync(new URL('../../src/pages/LessonReader.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /บทเรียนปฐมพยาบาลออนไลน์ฟรี/)
})
