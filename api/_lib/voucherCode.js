// Distinct prefix from certificate codes (FA-) so admin can tell them apart at a glance.
const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateVoucherCode() {
  let out = ''
  for (let i = 0; i < 8; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)]
  return `FAV-${out}`
}
