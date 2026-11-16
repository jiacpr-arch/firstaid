// ที่มาของผู้ซื้อ (last touch) สำหรับ metadata ของ Stripe Checkout — ให้รายงานแอด (jia-ads-hub sourceOf)
// แยกยอดขายตามแหล่งได้ ข้อมูลนี้ไปที่บัญชี Stripe ของเราเท่านั้น: ไม่ส่งเข้า analytics / Meta / Google
// และไม่ได้โหลด SDK ใด ๆ — ใช้ร่วมกันทั้งหน้าเว็บ (เก็บจาก URL) และ api/checkout/create.js (ตรวจซ้ำก่อนส่ง Stripe)

// เฉพาะ key ที่ตัวอ่าน sourceOf ใช้ — key อื่นทิ้งหมด
export const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'fbc', 'gclid', 'gbraid', 'wbraid', 'ttclid',
]
export const ATTRIBUTION_STORAGE_KEY = 'firstaid_checkout_attribution_v1'
export const ATTRIBUTION_MAX_AGE_MS = 90 * 86400000
const VALUE_RE = /^[A-Za-z0-9._~:/+=-]{1,200}$/

// ค่าเดียว → string ที่ปลอดภัย | null (ต้องเป็น string, trim แล้ว ≤200 ตัว, ตัวอักษรตาม allowlist)
// utm_* ที่เป็นตัวเลขล้วน ≥9 หลัก (หน้าตาเหมือนเบอร์โทร) ทิ้ง กันข้อมูลส่วนตัวหลุดเข้า metadata
export function sanitizeAttributionValue(key, value) {
  if (!ATTRIBUTION_KEYS.includes(key) || typeof value !== 'string') return null
  const v = value.trim()
  if (!VALUE_RE.test(v)) return null
  if (key.startsWith('utm_') && /^[0-9]{9,}$/.test(v)) return null
  return v
}

// object ใด ๆ → { key: value } เฉพาะ key ที่รู้จักและค่าผ่านการตรวจ
export function sanitizeAttribution(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const key of ATTRIBUTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    const v = sanitizeAttributionValue(key, input[key])
    if (v) out[key] = v
  }
  return out
}

// query string ของหน้าแรกที่เข้า → attribution (key ซ้ำใช้ค่าแรก) · fbc ไม่รับจาก URL (มาจาก cookie _fbc ฝั่งเซิร์ฟเวอร์เท่านั้น)
export function attributionFromSearch(search) {
  let params
  try { params = new URLSearchParams(search || '') } catch { return {} }
  const raw = {}
  for (const key of ATTRIBUTION_KEYS) {
    if (key === 'fbc') continue
    const v = params.get(key)
    if (v != null) raw[key] = v
  }
  return sanitizeAttribution(raw)
}

// เข้าเว็บพร้อม utm/click id → จำเป็น last touch (~90 วัน) ในเครื่องนี้ · ไม่มี key เลย = ไม่ทับของเดิม
export function captureAttribution(win, now = Date.now()) {
  try {
    const touch = attributionFromSearch(win.location.search)
    if (!Object.keys(touch).length) return false
    win.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify({ v: 1, savedAt: now, touch }))
    return true
  } catch { return false }
}

// last touch ที่ยังไม่หมดอายุ (ตรวจซ้ำทุกค่า) | {} — หมดอายุหรือเสียแล้วลบทิ้ง
export function readAttribution(win, now = Date.now()) {
  try {
    const raw = win.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    if (!p || p.v !== 1 || !Number.isSafeInteger(p.savedAt) || p.savedAt > now || now - p.savedAt > ATTRIBUTION_MAX_AGE_MS) {
      win.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY)
      return {}
    }
    return sanitizeAttribution(p.touch)
  } catch { return {} }
}
