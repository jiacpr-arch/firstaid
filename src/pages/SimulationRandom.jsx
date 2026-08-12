import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { scenarios } from '../courses/firstaid/scenarios'

// การ์ด Games Hub (game.morroo.com) ลิงก์มาที่ /simulation/random เพื่อสุ่มฉาก
// แล้วเข้าเล่นทันที ไม่ต้องไล่เลือกที่หน้า /simulation ก่อน — สุ่มครั้งเดียวต่อ
// การ mount ด้วย useState lazy init (กัน re-roll ตอน re-render) แล้ว redirect
// เข้าฉากนั้น พร้อมคง query string เดิม (utm_* ฯลฯ) ไว้เพื่อ attribution
export default function SimulationRandom() {
  const { search } = useLocation()
  const [targetId] = useState(
    () => scenarios[Math.floor(Math.random() * scenarios.length)].id,
  )
  return <Navigate to={`/simulation/${targetId}${search}`} replace />
}
