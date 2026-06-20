// LINE OA @jiacpr deep links — รวมไว้ที่เดียวกันทุก component ใช้ร่วม
export const LINE_OA_ID = '@jiacpr'

// เปิดหน้า "เพิ่มเพื่อน" ตรง ๆ (ใช้กับ QR และปุ่ม fallback)
export const LINE_ADD_URL = `https://line.me/R/ti/p/${LINE_OA_ID}`

// เปิดแชต @jiacpr พร้อม "ข้อความสนใจเรียน + ที่มา" พิมพ์ไว้ให้แล้ว ลูกค้าแค่กดส่ง
// (ถ้ายังไม่ได้เพิ่มเพื่อน LINE จะให้เพิ่มก่อนแล้วค่อยส่ง)
// ใส่ sourceLabel เพื่อให้ทีมเซลล์รู้ว่าลูกค้ามาจาก funnel ไหน — ไม่งั้นเห็นเพื่อนใหม่แล้วงง
export function lineInterestUrl(sourceLabel) {
  const text = `สนใจเรียนปฐมพยาบาล / First Aid กับ Jia 🙏\nมาจากแอปเรียนออนไลน์ — ${sourceLabel}`
  return `https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(text)}`
}
