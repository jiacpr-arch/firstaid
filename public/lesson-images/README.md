# รูปภาพประกอบบทเรียน (lesson-images)

มี 2 วิธีใส่รูป:

- **อัปผ่านหน้า Admin (ไม่ต้องแตะไฟล์)** — เข้า `/admin/media` ลากรูป/วิดีโอขึ้น
  Supabase Storage แล้วกด "คัดลอกโค้ด step" ไปวางใน `lessons.js` ได้เลย
  (ต้องตั้งค่า Supabase + รัน `supabase/lesson-media-storage.sql` ครั้งเดียวก่อน)
- **วางไฟล์เองในโฟลเดอร์นี้** (วิธีด้านล่าง) — เหมาะกับรูปที่อยากให้ใช้งานออฟไลน์ได้

---

วางไฟล์รูปสำหรับบทเรียนไว้ในโฟลเดอร์นี้ แล้วอ้างอิงในไฟล์
`src/courses/firstaid/lessons.js` ด้วย path ที่ขึ้นต้นด้วย `/lesson-images/`

## วิธีใส่รูปในบทเรียน

1. วางไฟล์รูปไว้ที่ `public/lesson-images/` เช่น `cpr-hand-position.jpg`
2. เพิ่ม step ลงในบทเรียนที่ต้องการ ใน `src/courses/firstaid/lessons.js`

### แบบที่ 1 — step รูปภาพล้วน

```js
{ type: 'image',
  heading: 'ตำแหน่งวางมือ',            // ไม่ใส่ก็ได้
  src: '/lesson-images/cpr-hand-position.jpg',
  alt: 'ตำแหน่งวางมือสำหรับ CPR',      // คำบรรยายสำหรับ screen reader
  caption: 'วางส้นมือกลางหน้าอก' },    // ข้อความใต้รูป ไม่ใส่ก็ได้
```

### แบบที่ 2 — รูปประกอบใต้ข้อความ (step `read`)

```js
{ type: 'read',
  heading: 'ท่าพักฟื้น (Recovery position)',
  body: 'จัดให้ผู้ป่วยนอนตะแคง...',
  image: { src: '/lesson-images/recovery-position.jpg',
           alt: 'ท่านอนตะแคงพักฟื้น',
           caption: 'นอนตะแคง ศีรษะแหงนเล็กน้อย' } },
```

## ข้อแนะนำ

- ใช้ไฟล์ `.jpg`, `.png` หรือ `.webp` (แนะนำ `.webp` ไฟล์เล็กกว่า)
- ย่อรูปให้กว้างไม่เกิน ~1200px เพื่อให้โหลดเร็วและประหยัดเน็ต
- ตั้งชื่อไฟล์เป็นภาษาอังกฤษ ตัวพิมพ์เล็ก คั่นด้วย `-` เช่น `wound-dressing.webp`
- ใส่ `alt` ทุกครั้ง เพื่อการเข้าถึง (accessibility)
- รูปในโฟลเดอร์นี้จะถูกแคชไว้ใช้งานแบบออฟไลน์โดย PWA อัตโนมัติ
