import { Phone } from 'lucide-react'

export default function CallEmergencyButton() {
  return (
    <a href="tel:1669" className="fab-emergency" aria-label="โทร 1669">
      <Phone size={16} />
      <span>โทร 1669</span>
    </a>
  )
}
