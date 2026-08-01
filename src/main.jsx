import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Self-host Noto Sans Thai so the certificate's PNG/PDF export can embed the font
// reliably (cross-origin Google Fonts can fail font-embedding during raster capture).
import '@fontsource/noto-sans-thai/400.css'
import '@fontsource/noto-sans-thai/500.css'
import '@fontsource/noto-sans-thai/600.css'
import '@fontsource/noto-sans-thai/700.css'
import '@fontsource/noto-sans-thai/800.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// HTML ที่ prerender ไว้ฝังแท็ก meta/JSON-LD ของ <Seo> มาด้วย ([data-seo]) —
// กวาดทิ้งก่อน mount ไม่งั้นจะซ้ำกับชุดใหม่ที่ React 19 hoist ขึ้น <head>
document.querySelectorAll('[data-seo]').forEach((el) => el.remove())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
