import { authHeader } from '../utils/authHeader'

// ผลเกม FIRST AID HERO ↔ backend — ทั้งสองทาง best-effort:
// endpoint ล่ม/ออฟไลน์ เกมยังเล่นได้ปกติ (คะแนนหลักอยู่ localStorage อยู่แล้ว)

// ส่งผลหนึ่งรอบขึ้น leaderboard — ไม่ throw ไม่ block เกม
export async function submitGameResult(payload) {
  try {
    await fetch('/api/game/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(payload),
    })
  } catch {
    /* ออฟไลน์/ล่ม — ข้าม ไม่กระทบเกม */
  }
}

// ดึงอันดับผู้เล่น top 20 — คืน [] เมื่อโหลดไม่ได้ (ผู้เรียกโชว์ข้อความว่างเอง)
// cohortCode (ทางเลือก): จัดอันดับเฉพาะคนในคลาสนั้น
export async function fetchLeaderboard(learnerId, cohortCode) {
  try {
    const params = new URLSearchParams()
    if (learnerId) params.set('learnerId', learnerId)
    if (cohortCode) params.set('cohortCode', cohortCode)
    const qs = params.size ? `?${params}` : ''
    const res = await fetch(`/api/game/leaderboard${qs}`)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.rows) ? data.rows : null
  } catch {
    return null
  }
}
