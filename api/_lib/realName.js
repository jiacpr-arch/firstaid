// ชื่อบนใบประกาศต้องเป็นชื่อ-นามสกุลจริง ไม่ใช่ชื่อ LINE/ชื่อเล่น
// (เคยหลุดเป็น "Kulawat💰", "𝕬𝖈𝖈𝖔𝖑𝖆𝖊𝖉" เพราะฟอร์มเติมชื่อ LINE ให้แล้วนักเรียนกดผ่าน)
// ใช้ทั้งฝั่งฟอร์มขอใบประกาศ (src/components/TheoryCertCard.jsx) และหน้าเข้าคลาส

const norm = (v) => String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()

// ชื่อนี้คือชื่อ LINE เดิม ๆ หรือไม่ (เทียบแบบไม่สนช่องว่าง/ตัวพิมพ์/ตัวอักษรแฟนซี)
export function isLineName(name, lineName) {
  const a = norm(name)
  return !!a && a === norm(lineName)
}

// คืนข้อความบอกปัญหา หรือ '' ถ้าดูเป็นชื่อจริง
export function realNameProblem(name, { lineName = '' } = {}) {
  const raw = String(name ?? '').trim()
  if (raw.length < 2) return 'กรุณากรอกชื่อ-นามสกุล'
  // อีโมจิ / ตัวอักษรแฟนซี (Mathematical Alphanumeric เช่น 𝕬𝖈𝖈) / สัญลักษณ์ชี้
  if (/\p{Extended_Pictographic}/u.test(raw) || /[\u{1D400}-\u{1D7FF}]/u.test(raw)) {
    return 'กรุณาใช้ชื่อจริง ไม่ใส่อีโมจิหรือตัวอักษรตกแต่ง'
  }
  if (!/\S+\s+\S+/.test(raw)) return 'กรุณากรอกทั้งชื่อและนามสกุล (เว้นวรรคระหว่างชื่อกับนามสกุล)'
  if (lineName && isLineName(raw, lineName)) return 'นี่คือชื่อ LINE — กรุณากรอกชื่อ-นามสกุลจริงตามบัตรประชาชน'
  return ''
}

// ชื่อที่ควรเติมให้ในช่องตอนเปิดฟอร์ม: ชื่อที่ดูไม่ใช่ชื่อจริง (เช่นชื่อ LINE) ให้เว้นว่างไว้ให้พิมพ์เอง
export function prefillRealName(candidate, { lineName = '' } = {}) {
  const v = String(candidate ?? '').trim()
  return v && !realNameProblem(v, { lineName }) ? v : ''
}
