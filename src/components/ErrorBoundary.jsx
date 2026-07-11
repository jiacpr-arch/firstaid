import { Component } from 'react'

// ตรวจว่า error มาจาก lazy chunk ที่หายไปหลัง deploy ใหม่ (Vercel เก็บเฉพาะ
// asset ของ deployment ล่าสุด → dynamic import ของ build เก่า 404)
function isChunkLoadError(error) {
  const msg = error?.message || ''
  return (
    error?.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)
  )
}

const RELOAD_FLAG = 'firstaid.chunk-reloaded'

// กันจอขาวทั้งแอป: render error ใดๆ จะเห็นหน้า fallback พร้อมปุ่มโหลดใหม่แทน
// ถ้าเป็น chunk หายหลัง deploy จะรีโหลดหน้าให้อัตโนมัติ 1 ครั้ง (มี flag กันลูป)
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }

  reset = () => {
    sessionStorage.removeItem(RELOAD_FLAG)
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>🚑</div>
        <div style={{ fontWeight: 700 }}>ขออภัย เกิดข้อผิดพลาดในแอป</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          ข้อมูลการเรียนของคุณยังอยู่ครบ กดโหลดใหม่เพื่อใช้งานต่อ
        </div>
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#e11d48', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}
        >
          โหลดหน้าใหม่
        </button>
        <a href="tel:1669" style={{ marginTop: 4, fontSize: 14 }}>โทรฉุกเฉิน 1669</a>
      </div>
    )
  }
}
