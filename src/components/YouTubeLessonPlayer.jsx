import { useEffect, useRef } from 'react'

// โหลด YouTube IFrame Player API ครั้งเดียว (singleton) แล้ว resolve เมื่อพร้อม
let ytReadyPromise = null
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytReadyPromise) return ytReadyPromise
  ytReadyPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (prev) try { prev() } catch { /* ignore */ }
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytReadyPromise
}

// Player วิดีโอบทเรียน — ใช้ YT IFrame API ติดตามเวลาที่เล่นจริง
// เรียก onPlay ครั้งแรกที่กดเล่น และ onWatched เมื่อดูถึง ~watchThreshold (หรือคลิปจบ)
// เปลี่ยน videoId หรือ resetKey เพื่อเริ่มนับใหม่ (เช่น ให้ดูซ้ำหลังตก mini quiz)
export default function YouTubeLessonPlayer({
  videoId,
  orientation = 'portrait',
  watchThreshold = 0.9,
  resetKey = 0,
  onPlay,
  onWatched,
}) {
  const hostRef = useRef(null)
  const onPlayRef = useRef(onPlay)
  const onWatchedRef = useRef(onWatched)
  useEffect(() => {
    onPlayRef.current = onPlay
    onWatchedRef.current = onWatched
  })

  useEffect(() => {
    let cancelled = false
    let player = null
    let poll = null
    let watched = false
    let played = false

    const stopPoll = () => {
      if (poll) { clearInterval(poll); poll = null }
    }
    const fireWatched = () => {
      if (watched) return
      watched = true
      stopPoll()
      try { onWatchedRef.current?.() } catch { /* ignore */ }
    }
    const checkProgress = () => {
      if (!player?.getCurrentTime) return
      const dur = player.getDuration ? player.getDuration() : 0
      if (dur > 0 && player.getCurrentTime() / dur >= watchThreshold) fireWatched()
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !hostRef.current) return
      player = new YT.Player(hostRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, fs: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              if (!played) {
                played = true
                try { onPlayRef.current?.() } catch { /* ignore */ }
              }
              stopPoll()
              poll = setInterval(checkProgress, 1000)
            } else {
              stopPoll()
            }
            if (e.data === YT.PlayerState.ENDED) fireWatched()
          },
        },
      })
    })

    return () => {
      cancelled = true
      stopPoll()
      try { player?.destroy() } catch { /* ignore */ }
    }
  }, [videoId, watchThreshold, resetKey])

  const portrait = orientation === 'portrait'
  return (
    <div
      className="lesson-video-frame"
      style={portrait ? { maxWidth: 340, aspectRatio: '9 / 16', marginInline: 'auto' } : undefined}
    >
      {/* YT.Player แทนที่ div นี้ด้วย iframe */}
      <div ref={hostRef} />
    </div>
  )
}
