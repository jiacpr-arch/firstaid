import { FREE_CHAPTER, CHAPTER_PRICES, COURSE_BUNDLE_PRICE } from '../config/pricing.js'

// ค่ากลางของ SEO ทั้งเว็บ — Seo component และ script ฝั่ง build (sitemap/prerender)
// อ้างอิงชุดเดียวกัน เพื่อให้ canonical/title/description ไม่หลุดจากกัน
export const SITE_URL = 'https://firstaid.morroo.com'
export const SITE_NAME = 'FirstAid by Jia Training Center'

export const DEFAULT_TITLE =
  'ปฐมพยาบาลเบื้องต้น | หมวดแรกฟรี — Jia Training Center'
export const DEFAULT_DESCRIPTION =
  `คอร์สปฐมพยาบาลออนไลน์: หมวดที่ ${FREE_CHAPTER} เรียนฟรี หมวดเพิ่มเติมเริ่ม ${Math.min(...Object.values(CHAPTER_PRICES))} บาท ` +
  `หรือปลดล็อกครบทุกหมวด ${COURSE_BUNDLE_PRICE} บาท ผู้มีสิทธิ์เรียนเดิมเข้าเรียนได้ตามสิทธิ์ โดย Jia Training Center`
export const DEFAULT_OG_IMAGE = '/og-image.jpg'

export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Jia Training Center',
  url: SITE_URL,
  logo: `${SITE_URL}/cert-logo.png`,
}

export function breadcrumbJsonLd(items) {
  // items: [{ name, path }] เรียงจากหน้าแรก → หน้าปัจจุบัน
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

export function itemListJsonLd(paths) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: paths.map((path, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}${path}`,
    })),
  }
}

export function lessonJsonLd(lesson) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: lesson.title,
    description: lesson.summary,
    inLanguage: 'th',
    mainEntityOfPage: `${SITE_URL}/learn/${lesson.id}`,
    publisher: ORGANIZATION_JSON_LD,
  }
}

export function algorithmJsonLd(algo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: algo.title,
    description: algo.summary,
    inLanguage: 'th',
    step: algo.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: s.text,
    })),
  }
}

export function courseJsonLd() {
  return [
    ORGANIZATION_JSON_LD,
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'th',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: 'ปฐมพยาบาลเบื้องต้นสำหรับประชาชนทั่วไป',
      description: DEFAULT_DESCRIPTION,
      provider: ORGANIZATION_JSON_LD,
      inLanguage: 'th',
      isAccessibleForFree: false,
      offers: {
        '@type': 'Offer',
        name: 'ปลดล็อกครบทุกหมวด',
        price: COURSE_BUNDLE_PRICE,
        priceCurrency: 'THB',
        category: 'Paid',
      },
      hasPart: [
        {
          '@type': 'CreativeWork',
          name: `บทเรียนหมวดที่ ${FREE_CHAPTER}`,
          isAccessibleForFree: true,
        },
        ...Object.entries(CHAPTER_PRICES).map(([chapter, price]) => ({
          '@type': 'CreativeWork',
          name: `บทเรียนหมวดที่ ${chapter}`,
          isAccessibleForFree: false,
          offers: { '@type': 'Offer', price, priceCurrency: 'THB' },
        })),
      ],
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        courseWorkload: 'PT1H',
      },
    },
  ]
}
