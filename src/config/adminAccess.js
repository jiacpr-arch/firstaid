// admin เปิดให้เข้าโดยไม่ต้องล็อกอินเมื่อ VITE_ADMIN_OPEN=true (โหมดช่วงเริ่มต้น)
// ใช้ร่วมกันหลายที่: RequireAdmin (ปล่อยเข้า), AdminLogin (เด้งกลับ), AdminDashboard (ซ่อนปุ่มออก)
export const OPEN_ADMIN = (import.meta.env.VITE_ADMIN_OPEN || '').trim().toLowerCase() === 'true'
