import { useEffect, useState } from 'react'

// ข่าวกู้ชีพ/AED จาก JiaAED public API (cache ฝั่ง server 5 นาที)
// เก็บผลล่าสุดลง localStorage เพื่อให้ยังแสดงได้ตอนออฟไลน์ — โหลดไม่ได้และไม่มี cache = ได้ []
const NEWS_API = 'https://jiaaed.com/api/news/public'
const CACHE_PREFIX = 'jiaaed-news-cache-v1'

function readCache(cacheKey) {
  try {
    const items = JSON.parse(localStorage.getItem(cacheKey))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export function useJiaAedNews(limit) {
  const cacheKey = `${CACHE_PREFIX}-${limit}`
  const [items, setItems] = useState(() => readCache(cacheKey))

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${NEWS_API}?limit=${limit}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.items)) return
        setItems(data.items)
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.items))
        } catch {
          // storage เต็ม/ปิดใช้งาน — ข้ามได้ แค่เสีย cache ออฟไลน์
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [limit, cacheKey])

  return items
}
