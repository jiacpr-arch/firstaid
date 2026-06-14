// คอมโพเนนต์แสดงรูป/วิดีโอที่ใช้ร่วมกันทั้งบทเรียน สถานการณ์จำลอง และผังช่วยชีวิต
export function LessonImage({ src, alt, caption }) {
  if (!src) return null
  return (
    <figure className="lesson-image">
      <img src={src} alt={alt || caption || ''} loading="lazy" />
      {caption && <figcaption className="text-caption">{caption}</figcaption>}
    </figure>
  )
}

export function LessonVideo({ src, youtube, poster, caption, title }) {
  if (youtube) {
    return (
      <figure className="lesson-video">
        <div className="lesson-video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtube}`}
            title={title || caption || 'วิดีโอบทเรียน'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        {caption && <figcaption className="text-caption">{caption}</figcaption>}
      </figure>
    )
  }
  if (src) {
    return (
      <figure className="lesson-video">
        <video controls preload="metadata" poster={poster} playsInline>
          <source src={src} />
        </video>
        {caption && <figcaption className="text-caption">{caption}</figcaption>}
      </figure>
    )
  }
  return null
}

// แสดงสื่อจากแถว lesson_media (รูป หรือวิดีโอ/YouTube) — ใช้ใน scenario/algorithm
export function MediaRow({ row }) {
  if (!row) return null
  if (row.kind === 'image') {
    return <LessonImage src={row.url} alt={row.alt} caption={row.caption} />
  }
  return <LessonVideo src={row.url} youtube={row.youtube} caption={row.caption} title={row.alt} />
}
