import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '1524889459310260'

export default function MetaPixel() {
  const location = useLocation()

  useEffect(() => {
    if (!PIXEL_ID || window.fbq) return
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL_ID)
  }, [])

  useEffect(() => {
    if (!PIXEL_ID || !window.fbq) return
    window.fbq('track', 'PageView')
  }, [location.pathname])

  return null
}
