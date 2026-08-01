// ค่ากลางของ SEO ทั้งเว็บ — Seo component และ script ฝั่ง build (sitemap/prerender)
// อ้างอิงชุดเดียวกัน เพื่อให้ canonical/title/description ไม่หลุดจากกัน
export const SITE_URL = 'https://firstaid.morroo.com'
export const SITE_NAME = 'FirstAid by Jia Training Center'

export const DEFAULT_TITLE =
  'ปฐมพยาบาลเบื้องต้น | เรียนฟรี รับใบประกาศ — Jia Training Center'
export const DEFAULT_DESCRIPTION =
  'คอร์สปฐมพยาบาลออนไลน์ฟรีสำหรับบุคคลทั่วไป: 24 บทเรียนสั้น ๆ (บทละ 5–10 นาที), ' +
  '17 ผังช่วยชีวิตฉุกเฉิน, 40 สถานการณ์จำลอง, สอบรับใบประกาศ โดย Jia Training Center'
export const DEFAULT_OG_IMAGE = '/og-image.png'

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
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'THB',
        category: 'Free',
      },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        courseWorkload: 'PT1H',
      },
    },
  ]
}
