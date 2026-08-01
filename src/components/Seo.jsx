import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from '../lib/seo'

// Per-route meta ด้วย React 19 native head hoisting — <title>/<meta>/<link>
// ที่ render ตรงนี้จะถูกยกขึ้น <head> อัตโนมัติ ไม่ต้องใช้ react-helmet
// ทุกแท็กติด data-seo ไว้เพื่อให้ main.jsx กวาดชุดที่ฝังมากับ HTML prerender ทิ้ง
// ก่อน React hoist ชุดใหม่ (กันแท็กซ้ำ) และให้ script prerender ใช้เป็นสัญญาณว่าหน้าพร้อม
export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noindex = false,
  jsonLd = null,
}) {
  const url = `${SITE_URL}${path}`
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <>
      <title data-seo="true">{title}</title>
      <meta data-seo="true" name="description" content={description} />
      <link data-seo="true" rel="canonical" href={url} />
      {noindex && <meta data-seo="true" name="robots" content="noindex" />}
      <meta data-seo="true" property="og:type" content={ogType} />
      <meta data-seo="true" property="og:site_name" content={SITE_NAME} />
      <meta data-seo="true" property="og:title" content={title} />
      <meta data-seo="true" property="og:description" content={description} />
      <meta data-seo="true" property="og:url" content={url} />
      <meta data-seo="true" property="og:image" content={imageUrl} />
      <meta data-seo="true" property="og:locale" content="th_TH" />
      <meta data-seo="true" name="twitter:card" content="summary_large_image" />
      <meta data-seo="true" name="twitter:title" content={title} />
      <meta data-seo="true" name="twitter:description" content={description} />
      <meta data-seo="true" name="twitter:image" content={imageUrl} />
      {jsonLdList.map((obj, i) => (
        <script
          key={i}
          data-seo="true"
          type="application/ld+json"
          // escape '<' กัน </script> injection จากข้อมูลเนื้อหา
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(obj).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  )
}
