# วิดีโอคู่มือ CPR (public/guide-videos/cpr-*-guide.*)

สร้างจากหน้าจอจริงของแอป (dev server + API จำลอง) + เสียงพากย์ภาษาไทย (edge-tts, `th-TH-NiwatNeural`)
+ คำบรรยายฝังในภาพ (libass, ฟอนต์ Noto Sans Thai) และไฟล์ `.vtt`

1. รัน dev server แบบมี Supabase จำลอง:
   `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx vite --port 5179`
2. `node scripts/guide-videos/capture.cjs` → ภาพหน้าจอใน `scripts/guide-videos/shots/` (ต้องมี Playwright)
3. `python3 scripts/guide-videos/build.py cpr-student-guide` และ `... cpr-admin-guide`
   (ต้องมี `pip install edge-tts`, ffmpeg, Pillow, ฟอนต์ Noto Sans Thai แบบ TTF และเข้าถึง speech.platform.bing.com ได้)
4. คัดลอก `<name>.mp4/.jpg/.vtt` ไป `public/guide-videos/`

แก้บทพากย์/คำบรรยายที่ `cpr-student-guide.json` / `cpr-admin-guide.json` (แต่ละฉาก: `shot`, `step`, `title`, `lines`)
— เสียงพากย์อ่านจาก `lines` โดยแปลงคำอังกฤษเป็นคำอ่านไทยตามตาราง `SAY` ใน build.py
