# สคริปต์วิดีโอ — บทที่ 15 การห้ามเลือดและพันแผล

> บทเรียนต้นทาง: `/learn/bleeding` (หมวด 3 บาดเจ็บฉุกเฉิน) — เนื้อหาใน `src/courses/firstaid/lessons.js`
> บทพูดทุกประโยคเรียบเรียงจากเนื้อหาในเว็บ **ห้ามเติมข้อมูลที่ไม่มีในบท**

---

## 0. กฎการทำวิดีโอ (ใช้ทุกบท)

1. รูปที่มีตัวอักษร/speech bubble → ครอปออกก่อน ห้ามเอาเข้า image-to-video ตรงๆ
2. ฉากเทคนิค (กดแผล พันแผล รัด) → ห้ามให้ AI ขยับมือ ใช้ภาพ "ค้าง/ผลลัพธ์" + `hands stay still`
   ให้เสียงบรรยาย + ตัวหนังสือบนจอเป็นคนสอน
3. Prompt เป็นภาษาอังกฤษ
4. โทน documentary realism ไม่ใช่ cinematic — เลือดแค่คราบเล็กน้อยบนผ้าก๊อซ

**ตั้งค่า Flow:** Veo 3.1 **Fast** ทุกคลิป / **Quality** เฉพาะ hook / x2 ต่อ prompt / เว็บ 16:9, TikTok 9:16
**ตัดต่อ:** CapCut — ปิดเสียงคลิป, อัดเสียงบรรยาย/TTS แยก, ใส่ซับไทยทุกประโยค

---

## 1. เนื้อหาบทในเว็บ (อ้างอิง)

**หน้า 1 — หลักการ**
เลือดออกมีตั้งแต่เล็กน้อยจนถึงเสียชีวิตได้ — บางจุดเลือดออกอาจเล็กน้อยด้วยตา แต่เส้นเลือดใหญ่แตกได้ภายในไม่กี่นาที
**Direct pressure** (กดที่จุดเลือดออกตรงๆ) เป็นวิธีง่ายและมีประสิทธิภาพสูง

**หน้า 2 — ขั้นตอนห้ามเลือด**
1. ประเมินสถานการณ์ปลอดภัย
2. ใส่ถุงมือ + PPE
3. วางผ้าพันแผลบนแผล
4. กดตรงๆ ด้วยฝ่ามือ/นิ้ว ที่ผ้าพันแผล
5. ถ้าเลือดยังไม่หยุด — เพิ่มผ้าพันแผลซ้อนทับและกดแน่นขึ้น
6. กดจนเลือดหยุด
7. ถ้าต้องกดนาน — ใช้ผ้าพันแผลพันรอบแผลให้แน่น

**หน้า 3 — 🟡 โทร 1669 เมื่อ**
มีเลือดออกมาก • หยุดเลือดไม่ได้ • มีอาการช็อก • สงสัยบาดเจ็บศีรษะ คอ หลัง ร่วมด้วย • ไม่แน่ใจในการปฐมพยาบาล

**หน้า 4 — การพันแผล**
ใช้ผ้าก๊อซ ผ้าสะอาด หรือถุงมือสะอาด
1. ใช้ก๊อซ/ผ้าพันแผล กดบริเวณแผล
2. พันรอบด้วยผ้าพันแผลให้แน่น
ช่วยปิดบาดแผล ป้องกันเชื้อโรค และกดห้ามเลือดได้ในตัว

**หน้า 5 — 🔴 การรัด (Tourniquet) — กรณีฉุกเฉิน**
ใช้เฉพาะกรณีเลือดออกมากๆ จากแขน/ขา และกดแผลแล้วเลือดยังไม่หยุด
1. โทร 1669
2. ใส่ถุงมือ + PPE
3. วางชุดรัดเหนือแผลประมาณ 2 นิ้ว
4. รัดจนเลือดหยุดไหล
5. **จดเวลาที่เริ่มรัด**
6. ส่งสถานพยาบาลเร็วที่สุด

**ห้ามไขออก/ปลดเด็ดขาด** — ให้เจ้าหน้าที่กู้ชีพจัดการต่อ
หากไม่มีชุดรัด ใช้ผ้า + ไม้/ปากกา/ตะเกียบ ผูกแล้วหมุนรัดได้

**หน้า 6 — Quiz**
การหยุดเลือด โดยการกดบริเวณที่มีเลือดออกทันที? — ก. ใช่ ✅ / ข. ไม่ใช่
เฉลย: ใช่ — Direct pressure คือวิธีห้ามเลือดที่ปลอดภัยและได้ผลที่สุด

### รูปประกอบในเว็บ (Supabase `lesson_media`, lesson_id = `bleeding`)

| รูป | อยู่หน้า | ใช้ทำคลิป | ลิงก์ |
|---|---|---|---|
| 0 | หน้าปก | Hook (Quality) | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781766959460-72d6f128-a3ed-4701-a737-6aa558e4be05.png) |
| 1 | หลักการ | 1 คลิป | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781767327373-c3eaebae-6071-4ff0-82a1-757bbf1f371b.png) |
| 2 | ขั้นตอนห้ามเลือด | 2–3 คลิป (7 ข้อ) | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781767457969-065d0570-fe45-4cc6-af7c-0d5a78bb32f7.png) |
| 3 | โทร 1669 | 1 คลิป | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781767496679-5f0c2335-dca3-469f-be75-a991e5e0a5d7.png) |
| 4 | การพันแผล | 1 คลิป (ใช้ซ้ำตอนสรุป/CTA) | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781767559967-d12c3ccc-5e38-468c-96e8-ef5350f0f6b0.png) |
| 5 | Tourniquet | 1–2 คลิป | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781767965412-329e7e75-15c4-4cef-98d1-66601990fd7f.png) |
| 6 | Quiz | ไม่ต้อง gen — ใช้เป็นพื้นหลังเบลอ | [เปิด](https://tpoiyykbgsgnrdwzgzvn.supabase.co/storage/v1/object/public/lesson-media/images/1781768057911-324e919d-c08a-4137-97f4-fe071efcbbd2.png) |

> ยังไม่ได้ตรวจรูปทีละรูป (ตัวอักษรในภาพ / ท่าเทคนิค) — ส่งรูปให้ Claude ดูก่อน gen แล้วปรับ prompt ด้านล่างให้ใช้รูปจริงเป็นภาพตั้งต้น

---

## 2. เวอร์ชันเต็ม — บนเว็บ (~2 นาที, 16:9)

| # | เวลา | ภาพ | บทพูด | ตัวหนังสือบนจอ |
|---|---|---|---|---|
| 1 | 0:00 | **Clip 1** Hook (Quality) | "ล้มรถ เลือดออก… บางแผลดูนิดเดียว แต่ถ้าเส้นเลือดใหญ่แตก อันตรายถึงชีวิตได้ในไม่กี่นาทีเลยนะ" | **เลือดออก ทำไงดี?** |
| 2 | 0:10 | **Clip A** | "วิธีที่ง่ายและได้ผลที่สุด คือกดตรงที่แผลเลย เรียกว่า Direct pressure" | กดตรงแผล (Direct pressure) |
| 3 | 0:18 | **Clip B** | "ก่อนเข้าช่วย ดูก่อนว่าตรงนั้นปลอดภัยไหม แล้วใส่ถุงมือทุกครั้ง" | ① ดูว่าปลอดภัย ② ใส่ถุงมือ |
| 4 | 0:26 | **Clip A** (ครอปใกล้ขึ้น) | "วางผ้าพันแผลบนแผล แล้วใช้ฝ่ามือหรือนิ้ว กดลงไปตรงๆ" | ③ วางผ้าบนแผล ④ กดตรงๆ |
| 5 | 0:34 | **Clip C** | "ถ้าเลือดยังไม่หยุด วางผ้าซ้อนทับเพิ่ม แล้วกดให้แน่นขึ้น กดไปจนกว่าเลือดจะหยุด" | ⑤ ยังไหล → ซ้อนผ้า กดแน่นขึ้น ⑥ กดจนหยุด |
| 6 | 0:44 | **Clip D** | "ถ้าต้องกดนาน ก็พันผ้ารอบแผลให้แน่นไปเลย ใช้ผ้าก๊อซ ผ้าสะอาด หรือถุงมือสะอาดก็ได้ พันแล้วช่วยปิดแผล กันเชื้อโรค และกดห้ามเลือดไปในตัว" | ⑦ กดนาน → พันให้แน่น |
| 7 | 0:58 | **Clip E** | "ถ้าเลือดออกเยอะ กดแล้วไม่หยุด มีอาการช็อก สงสัยเจ็บหัว คอ หลังร่วมด้วย หรือไม่แน่ใจว่าทำถูกไหม โทร 1669 เลย" | 🟡 **โทร 1669 เมื่อ** + 5 ข้อ |
| 8 | 1:12 | **Clip F** | "ถ้าเลือดออกมากๆ จากแขนหรือขา กดแล้วยังไม่หยุด ถึงจะใช้วิธีรัด โทร 1669 ใส่ถุงมือ วางที่รัดเหนือแผลประมาณ 2 นิ้ว รัดจนเลือดหยุด" | 🔴 **รัด = ฉุกเฉินเท่านั้น** / เหนือแผล ~2 นิ้ว |
| 9 | 1:26 | **Clip G** | "แล้วจดเวลาที่เริ่มรัดไว้ด้วย รัดแล้วห้ามคลายออกเด็ดขาด ให้เจ้าหน้าที่กู้ชีพจัดการต่อ แล้วรีบส่งโรงพยาบาล" | 🔴 **จดเวลา / ห้ามคลาย!** |
| 10 | 1:36 | **Clip H** | "ถ้าไม่มีชุดรัด ใช้ผ้ากับไม้ ปากกา หรือตะเกียบ ผูกแล้วหมุนรัดได้" | ผ้า + ไม้/ปากกา/ตะเกียบ |
| 11 | 1:44 | **Clip D** (ใช้ซ้ำ ซูมช้า) — ฉากสรุปก่อน quiz | "สรุปง่ายๆ จำไว้ข้อเดียว เลือดออก… กดตรงแผลก่อนเสมอ" | **จำไว้: กดตรงแผล** |
| 12 | 1:50 | Clip A เบลอเป็นพื้นหลัง | "ทวนกันหน่อย เลือดออก ให้กดตรงแผลทันที ใช่หรือไม่ใช่?" … (นับ 3 วิ) … "ใช่! กดตรงแผล ปลอดภัยและได้ผลที่สุด" | ดูหัวข้อ Quiz ด้านล่าง |
| 13 | 2:02 | **Clip I** | "เรียนครบทุกบท แล้วสอบรับใบเซอร์ฟรีที่ firstaid.morroo.com" | **firstaid.morroo.com** |

### Quiz บนจอ (~12 วิ, ทำใน CapCut)

| วินาที | บนจอ | เสียง |
|---|---|---|
| 0–3 | ❓ **"การหยุดเลือด โดยการกดบริเวณที่มีเลือดออกทันที?"** | อ่านคำถาม |
| 3–4 | กล่องตัวเลือก **ใช่** / **ไม่ใช่** | — |
| 4–7 | นับถอยหลัง **3…2…1** | ติ๊กๆ |
| 7–12 | กล่อง "ใช่" เป็นสีเขียว ✅ + *"Direct pressure คือวิธีห้ามเลือดที่ปลอดภัยและได้ผลที่สุด"* | "ติ๊ง!" + เฉลย |

วิธีทำ: พื้นหลัง Clip A + Blur → Text คำถาม + กล่อง 2 อัน → countdown template → เปลี่ยนสีกล่องที่ถูก + sticker ✅
**เซฟเป็น template** ไว้ใช้บทต่อไป

---

## 3. เวอร์ชัน TikTok — Quiz ก่อน (~20–25 วิ, 9:16)

| วินาที | ภาพ | เสียง / ตัวหนังสือ |
|---|---|---|
| 0–3 | Hook (Clip 1 แนวตั้ง) | "เพื่อนล้มรถ เลือดไหล…" |
| 3–8 | Clip เดิมเบลอ + คำถาม | **"กดแผลแล้ว เลือดยังซึมออกมา ทำไงต่อ?"**<br>A. เปิดผ้าดูแผล<br>B. วางผ้าซ้อนทับ แล้วกดให้แน่นขึ้น<br>C. เอาน้ำล้างแผลก่อน |
| 8–11 | นับถอยหลัง 3…2…1 | "ตอบในคอมเมนต์!" |
| 11–20 | **Clip C** (ซ้อนผ้า กดแน่น) | "ข้อ B! วางผ้าซ้อนทับ กดให้แน่นขึ้น กดจนเลือดหยุด" |
| 20–25 | **Clip D** | "เรียนฟรี + ใบเซอร์ ลิงก์ในโปรไฟล์" |

> คำตอบ B มาจากขั้นตอนที่ 5–6 หน้า 2 ของบท / A กับ C เป็นตัวหลอก

**ไอเดีย EP ต่อจากบทเดียวกัน**
- EP.2 — "เลือดออกแบบไหน ต้องโทร 1669?" (หน้า 3)
- EP.3 — "รัดห้ามเลือดแล้ว ควรคลายไหม?" (หน้า 5 — ต้องพูดเงื่อนไขครบ: ใช้เมื่อไหร่ / เหนือแผล 2 นิ้ว / จดเวลา / ห้ามคลาย)

**เช็คลิสต์ TikTok**
- ตัวหนังสือกลางจอค่อนบน (ล่าง/ขวาโดนปุ่มบัง)
- ซับไทยทุกประโยค
- เปิด **"AI-generated content"** ตอนโพสต์
- ลิงก์เว็บใส่ใน bio
- ตั้งชื่อซีรีส์ เช่น "ปฐมพยาบาลใน 30 วิ EP.1"

---

## 4. Prompt ทุกคลิป

**ต่อท้ายทุก prompt:**
```
Characters: a Thai female first responder in her late 20s, black hair in a ponytail, plain navy-blue polo uniform with no text or logos, white nitrile gloves; an injured Thai man in his 20s, short black hair, black t-shirt, navy shorts. Setting: quiet Thai roadside, overcast daylight.
Style: realistic documentary footage, handheld, natural muted colors. No text, no logos, no music.
```

**Negative prompt (ถ้ามีช่อง):**
```
text, letters, logos, subtitles, watermark, moving hands, wrapping bandage, extra fingers, distorted hands, blood spray, gore, cinematic lens flare, slow motion, dramatic music
```

**Clip 1 — Hook (Quality)** — ใช้รูปหน้าปก/รูปพันเข่าเป็นภาพตั้งต้น
```
Documentary-style handheld footage of a roadside accident scene in Thailand, overcast daylight. A female paramedic in a navy uniform kneels beside an injured young man sitting on the asphalt next to a fallen motorcycle. She holds a bandage steady on his knee — her hands remain completely still, no wrapping motion. The man breathes heavily and winces slightly, eyes looking down at his knee. In the background, the ambulance's emergency lights flash softly and a responder in a high-visibility vest walks slowly. Leaves sway gently in the breeze.
Camera: very slow, subtle push-in, slight natural handheld sway, no cuts.
Style: realistic news documentary, natural muted colors, soft overcast light, shallow depth of field, no cinematic color grading.
Audio: distant traffic, faint siren fading, wind, the man's heavy breathing. No music, no dialogue.
```

**Clip A — มือกดแผล**
```
Close-up of the responder's gloved hands pressing a folded white gauze pad firmly onto the man's knee. Her palms press down and hold completely still. Only slight breathing movement from both people. Camera slowly pushes in.
```

**Clip B — ดูความปลอดภัย**
```
Medium shot: the responder, already wearing white gloves, kneels beside the injured man on the roadside, turns her head to check traffic on both sides, then looks back down at him. Calm, alert expression. Static camera.
```

**Clip C — ซ้อนผ้า กดแน่นขึ้น**
```
Close-up of the man's knee with two white gauze pads stacked on top of each other, a small red stain on the lower pad. The responder's gloved palms press down firmly on the stack and hold still. No wrapping motion. Slow push-in.
```

**Clip D — แผลพันเสร็จ**
```
The man's knee is neatly wrapped in a white bandage. He sits on the road, breathing more calmly now. The responder rests one gloved hand on his shoulder and speaks reassuringly. Hands stay still. Slow push-in.
```

**Clip E — คนโทร 1669**
```
A Thai bystander in casual clothes stands on the roadside holding a phone to his ear, speaking urgently while glancing toward the injured man and the responder nearby. The phone screen is not visible. Static camera.
```

**Clip F — ที่รัดเหนือแผล**
```
Close-up of the man's upper arm. A white dressing covers a wound on the forearm, and a black tourniquet strap is already tightened on the upper arm, about 5 cm above the dressing. The responder's gloved hand rests still on the strap. No tightening motion. Static camera.
```

**Clip G — จดเวลา**
```
Side angle: the responder writes with a marker on a strip of white tape stuck to the man's arm. The writing is not readable from this angle. Short, simple motion. Static camera.
```

**Clip H — ที่รัดแบบทำเอง**
```
Close-up of a cloth strip tied around the man's upper arm, with a short wooden stick already twisted into the knot to tighten it. The responder's gloved hand holds the stick still. No twisting motion. Static camera.
```

**Clip I — ปิดท้าย**
```
Wide shot: an ambulance parks nearby, and two paramedics walk toward the man, who sits calmly with his knee bandaged. The responder stands up and talks to them. Slow pan.
```

---

## 5. เช็คก่อนใช้แต่ละคลิป (ไม่ผ่าน = gen ใหม่)

- [ ] ใส่ถุงมือ
- [ ] มืออยู่บนแผล ไม่ขยับทำท่าแปลก ๆ
- [ ] ที่รัดอยู่ **เหนือแผล** ไม่อยู่บนข้อพับ/ใต้แผล
- [ ] ไม่มีตัวหนังสือโผล่ในภาพ
- [ ] เลือดไม่เยอะเกิน
