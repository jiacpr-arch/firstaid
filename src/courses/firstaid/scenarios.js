// Scenario / Simulation — decision-tree practice for laypersons
// step: { id, prompt, image?, choices: [{id, text, correct, feedback, nextStepId | 'end'}] }
// score: +1 per correct, max = number of decision steps

export const scenarios = [
  {
    id: 'mall-collapse',
    title: 'ชายวัย 50 ล้มลงในห้าง',
    summary: 'พบชายอายุ 50 ปี ล้มลงหน้าร้านอาหารกะทันหัน ไม่ขยับ',
    minutes: 5,
    icon: 'AlertCircle',
    color: '#DC2626',
    steps: [
      {
        id: 's1',
        prompt: 'คุณเห็นชายล้มลงตรงทางเดินกลางห้าง คนเริ่มมุงดู คุณจะทำอะไรก่อน?',
        choices: [
          { id: 'a', text: 'รีบเขย่าให้ตื่น', correct: false,
            feedback: 'ก่อนเข้าไปต้องดูปลอดภัยก่อน — และยังไม่ได้เรียกความช่วยเหลือ', nextStepId: 's2' },
          { id: 'b', text: 'ดูรอบ ๆ ว่าปลอดภัย แล้วเรียกชื่อ-เขย่าไหล่เบา ๆ', correct: true,
            feedback: 'ถูกต้อง! หลัก Danger → Response', nextStepId: 's2' },
          { id: 'c', text: 'ถ่ายคลิปแล้วโพสต์ขอความช่วยเหลือออนไลน์', correct: false,
            feedback: 'เสียเวลามาก — โทร 1669 ตรง ๆ เร็วกว่าเยอะ', nextStepId: 's2' },
        ],
      },
      {
        id: 's2',
        prompt: 'เขย่าแล้วผู้ป่วยไม่ตอบสนอง ไม่หายใจ ขั้นต่อไป?',
        choices: [
          { id: 'a', text: 'รีบกดหน้าอกทันที', correct: false,
            feedback: 'ต้องเรียก 1669 และขอ AED ก่อน — แล้วค่อยเริ่ม CPR', nextStepId: 's3' },
          { id: 'b', text: 'ตะโกนสั่งคนรอบ ๆ ให้โทร 1669 และวิ่งหา AED', correct: true,
            feedback: 'ถูก! Designate คนช่วยชัดเจน เช่น "คุณเสื้อแดงโทร 1669, คุณเสื้อฟ้าวิ่งหา AED"', nextStepId: 's3' },
          { id: 'c', text: 'เป่าปาก 2 ครั้งก่อน', correct: false,
            feedback: 'สำหรับประชาชน ใช้ Hands-only CPR — ไม่ต้องเป่าปาก', nextStepId: 's3' },
        ],
      },
      {
        id: 's3',
        prompt: 'คุณเริ่ม CPR แล้ว 2 นาที AED มาถึง คุณควร?',
        choices: [
          { id: 'a', text: 'หยุดกดหน้าอก เปิด AED ติดแผ่นทันที', correct: true,
            feedback: 'ใช่ — หยุด CPR ชั่วคราว ติดแผ่นเร็วที่สุด', nextStepId: 's4' },
          { id: 'b', text: 'รอ CPR จบ 5 รอบก่อน', correct: false,
            feedback: 'AED เป็นการรักษาที่ effective ที่สุด — ติดทันทีที่ทำได้', nextStepId: 's4' },
          { id: 'c', text: 'ให้คนอื่นใช้ AED คุณยังกดต่อ', correct: false,
            feedback: 'การกดต่อขณะติดแผ่นทำให้แผ่นไม่ติดสนิท — หยุดสั้น ๆ เพื่อติด', nextStepId: 's4' },
        ],
      },
      {
        id: 's4',
        prompt: 'AED บอก "Shock advised" ขั้นต่อไป?',
        choices: [
          { id: 'a', text: 'กดปุ่มช็อกทันที', correct: false,
            feedback: 'ต้องเช็คว่าไม่มีใครแตะตัวผู้ป่วยก่อน — เสี่ยงโดนช็อกตามไปด้วย', nextStepId: 'end' },
          { id: 'b', text: 'ตะโกน "ทุกคนถอย" แล้วกดปุ่มช็อก', correct: true,
            feedback: 'ถูกต้อง — clear แล้วกด', nextStepId: 'end' },
          { id: 'c', text: 'รอเครื่องกดเอง', correct: false,
            feedback: 'AED รุ่นที่ใช้ในห้าง/สนามบิน ต้องกดปุ่มเอง', nextStepId: 'end' },
        ],
      },
    ],
  },
  {
    id: 'kitchen-burn',
    title: 'น้ำมันลวก',
    summary: 'แม่บ้านราดน้ำมันร้อนใส่แขนตัวเอง',
    minutes: 3,
    icon: 'Flame',
    color: '#EA580C',
    steps: [
      {
        id: 's1',
        prompt: 'แม่ของคุณราดน้ำมันร้อนใส่แขน เห็นผิวแดงและเริ่มพอง สิ่งแรกที่ทำ?',
        choices: [
          { id: 'a', text: 'ใส่ยาสีฟัน', correct: false,
            feedback: 'ผิด! ทำให้แผลติดเชื้อ', nextStepId: 's2' },
          { id: 'b', text: 'ราดน้ำสะอาดอุณหภูมิห้องไหลผ่าน 15–20 นาที', correct: true,
            feedback: 'ถูกต้อง — ลดความร้อนและบรรเทาปวด', nextStepId: 's2' },
          { id: 'c', text: 'ใช้น้ำแข็งประคบโดยตรง', correct: false,
            feedback: 'น้ำแข็งทำให้เนื้อเยื่อตายเพิ่ม', nextStepId: 's2' },
        ],
      },
      {
        id: 's2',
        prompt: 'หลังราดน้ำ เห็นตุ่มพองขนาดเท่าเหรียญสิบ ปวดมาก ขั้นต่อไป?',
        choices: [
          { id: 'a', text: 'เจาะตุ่มน้ำให้ออก', correct: false,
            feedback: 'ห้ามเจาะ — เสี่ยงติดเชื้อ ปล่อยให้ตุ่มทำหน้าที่ป้องกัน', nextStepId: 's3' },
          { id: 'b', text: 'ปิดด้วยผ้าก๊อซสะอาด ไม่ทาอะไร แล้วพาไป รพ.', correct: true,
            feedback: 'ใช่ — แผลพองที่หน้า/มือ/ใหญ่ ควรให้แพทย์ดู', nextStepId: 's3' },
          { id: 'c', text: 'ทาว่านหางจระเข้สด', correct: false,
            feedback: 'ของสดอาจมีเชื้อแบคทีเรีย ทำให้แผลติดเชื้อ', nextStepId: 's3' },
        ],
      },
      {
        id: 's3',
        prompt: 'ระหว่างพาไป รพ. แม่บอกว่าเหนื่อย ใจสั่น ทำอะไร?',
        choices: [
          { id: 'a', text: 'ให้ดื่มน้ำเปล่าจิบ ๆ', correct: true,
            feedback: 'ใช่ — แผลไหม้ทำให้เสียน้ำ การดื่มน้ำช่วยได้ ถ้าไม่อาเจียน', nextStepId: 'end' },
          { id: 'b', text: 'ให้กินยาแก้ปวดเอง', correct: false,
            feedback: 'รอให้แพทย์ประเมินก่อน อาจใช้ยาที่แรงกว่าได้', nextStepId: 'end' },
          { id: 'c', text: 'ไม่ต้องทำอะไร เดี๋ยวก็ดี', correct: false,
            feedback: 'อาการใจสั่นอาจเป็นสัญญาณ shock — แจ้งคนขับให้รีบ', nextStepId: 'end' },
        ],
      },
    ],
  },
  {
    id: 'child-choking',
    title: 'เด็ก 4 ขวบสำลักลูกอม',
    summary: 'ลูกของเพื่อนคุณ อายุ 4 ขวบ สำลักลูกอม',
    minutes: 3,
    icon: 'Baby',
    color: '#D97706',
    steps: [
      {
        id: 's1',
        prompt: 'เด็กจับคอ พูดไม่ออก ไอแห้ง คุณ?',
        choices: [
          { id: 'a', text: 'ล้วงในปากหาลูกอม', correct: false,
            feedback: 'อันตราย — อาจดันลูกอมลงไปอีก', nextStepId: 's2' },
          { id: 'b', text: 'ตบหลังกลางสะบัก 5 ครั้ง', correct: true,
            feedback: 'ใช่ — ตบหลังก่อน 5 ครั้ง', nextStepId: 's2' },
          { id: 'c', text: 'ให้ดื่มน้ำ', correct: false,
            feedback: 'ทำให้สำลักหนักกว่าเดิม', nextStepId: 's2' },
        ],
      },
      {
        id: 's2',
        prompt: 'ตบ 5 ครั้งแล้วยังไม่หลุด ต่อไป?',
        choices: [
          { id: 'a', text: 'รัดท้อง (Heimlich) 5 ครั้ง', correct: true,
            feedback: 'ถูก — เด็กอายุ >1 ปี ใช้ Heimlich ได้ (กำมือเหนือสะดือ ดึงเข้า-ขึ้น)', nextStepId: 's3' },
          { id: 'b', text: 'อุ้มกลับหัวเขย่า', correct: false,
            feedback: 'ไม่แนะนำ — เสี่ยงคอเคล็ดและไม่ได้ผล', nextStepId: 's3' },
          { id: 'c', text: 'รอให้หมดสติก่อน', correct: false,
            feedback: 'รอไม่ได้ — สมองขาดออกซิเจน 4 นาทีเริ่มเสียหาย', nextStepId: 's3' },
        ],
      },
      {
        id: 's3',
        prompt: 'ลูกอมหลุดออก เด็กไอและร้องไห้ ขั้นต่อไป?',
        choices: [
          { id: 'a', text: 'พาไป รพ. เพื่อตรวจ', correct: true,
            feedback: 'ใช่ — อาจมีเศษค้างหรือบาดเจ็บภายใน', nextStepId: 'end' },
          { id: 'b', text: 'ปล่อยเล่นต่อได้เลย', correct: false,
            feedback: 'ควรให้แพทย์ตรวจดูทางเดินหายใจ', nextStepId: 'end' },
          { id: 'c', text: 'ให้นอนพักก่อน', correct: false,
            feedback: 'ควรให้แพทย์ตรวจก่อน', nextStepId: 'end' },
        ],
      },
    ],
  },
  {
    id: 'car-accident',
    title: 'อุบัติเหตุรถจักรยานยนต์',
    summary: 'พบผู้ขับขี่นอนข้างถนน ใส่หมวกกันน็อก',
    minutes: 4,
    icon: 'Car',
    color: '#7C3AED',
    steps: [
      {
        id: 's1',
        prompt: 'เห็นผู้ขับขี่นอนข้างถนน รถยังเลื่อนอยู่ใกล้ ๆ ทำอะไรก่อน?',
        choices: [
          { id: 'a', text: 'รีบเข้าไปอุ้มออกมาทันที', correct: false,
            feedback: 'อันตราย — อาจมีรถวิ่งมาชน และเคลื่อนย้ายผิดวิธีอาจทำให้พิการ', nextStepId: 's2' },
          { id: 'b', text: 'เตือนรถคันอื่นด้วยไฟฉาย/เสื้อสะท้อนแสง แล้วโทร 1669', correct: true,
            feedback: 'ถูก — Scene safety ก่อน', nextStepId: 's2' },
          { id: 'c', text: 'ถ่ายรูปหลักฐานก่อน', correct: false,
            feedback: 'ทำได้ทีหลัง — ความปลอดภัยและการเรียก 1669 มาก่อน', nextStepId: 's2' },
        ],
      },
      {
        id: 's2',
        prompt: 'ผู้ป่วยใส่หมวกกันน็อกอยู่ หายใจอยู่ คุณ?',
        choices: [
          { id: 'a', text: 'ถอดหมวกกันน็อกออกทันที', correct: false,
            feedback: 'อาจทำให้คอบาดเจ็บเพิ่ม — รอเจ้าหน้าที่ ยกเว้นหายใจไม่ออก', nextStepId: 's3' },
          { id: 'b', text: 'ปล่อยหมวกไว้ ประคองคอให้นิ่ง ๆ', correct: true,
            feedback: 'ใช่ — สงสัย C-spine injury เสมอในอุบัติเหตุ', nextStepId: 's3' },
          { id: 'c', text: 'นั่งให้ตรง', correct: false,
            feedback: 'ห้ามขยับคอ', nextStepId: 's3' },
        ],
      },
      {
        id: 's3',
        prompt: 'ขาของผู้ป่วยมีเลือดออกพุ่ง คุณ?',
        choices: [
          { id: 'a', text: 'กดแผลตรง ๆ ด้วยผ้าสะอาด ใส่ถุงมือก่อน', correct: true,
            feedback: 'ถูก — direct pressure ปลอดภัยที่สุด และป้องกันตัวเอง', nextStepId: 'end' },
          { id: 'b', text: 'รัดเหนือแผลด้วยเชือก', correct: false,
            feedback: 'ใช้เฉพาะเมื่อกดไม่หยุดและเลือดพุ่ง (life-threatening) — ปกติกดก่อน', nextStepId: 'end' },
          { id: 'c', text: 'ราดน้ำล้างแผล', correct: false,
            feedback: 'อย่าล้างแผลใหญ่ — ห้ามเลือดก่อน', nextStepId: 'end' },
        ],
      },
    ],
  },
  {
    id: 'beach-drowning',
    title: 'เด็กจมน้ำที่ชายหาด',
    summary: 'พบเด็กอายุ 10 ขวบลอยคว่ำในน้ำ',
    minutes: 3,
    icon: 'Wind',
    color: '#0EA5E9',
    steps: [
      {
        id: 's1',
        prompt: 'เห็นเด็กลอยคว่ำห่างฝั่ง 5 เมตร คุณว่ายน้ำไม่เก่ง ทำ?',
        choices: [
          { id: 'a', text: 'กระโดดลงไปคว้ามา', correct: false,
            feedback: 'อันตราย — คุณอาจจมตามไปด้วย', nextStepId: 's2' },
          { id: 'b', text: 'ตะโกนเรียกคนช่วย + โยนห่วงยาง/ขวดน้ำ + ยื่นไม้', correct: true,
            feedback: 'ถูก — หลัก "ตะโกน-โยน-ยื่น"', nextStepId: 's2' },
          { id: 'c', text: 'ถ่ายคลิปขอความช่วย', correct: false,
            feedback: 'ทุกวินาทีสำคัญ — ทำตามหลัก reach-throw-go', nextStepId: 's2' },
        ],
      },
      {
        id: 's2',
        prompt: 'นำเด็กขึ้นมาแล้วไม่หายใจ ทำอะไร?',
        choices: [
          { id: 'a', text: 'อุ้มกระแทกไล่น้ำออก', correct: false,
            feedback: 'ผิด — เสียเวลา และอาจสำลักอาเจียนเข้าปอด', nextStepId: 's3' },
          { id: 'b', text: 'เริ่ม CPR ทันที + โทร 1669', correct: true,
            feedback: 'ใช่ — เริ่ม CPR ทันทีไม่ต้องไล่น้ำ', nextStepId: 's3' },
          { id: 'c', text: 'พลิกคว่ำตบหลัง', correct: false,
            feedback: 'นั่นสำหรับสำลัก — เด็กจมน้ำที่ไม่หายใจต้อง CPR', nextStepId: 's3' },
        ],
      },
      {
        id: 's3',
        prompt: 'CPR 5 รอบ เด็กไอน้ำออกมาและร้องไห้ คุณ?',
        choices: [
          { id: 'a', text: 'จบภารกิจ ปล่อยกลับบ้านได้', correct: false,
            feedback: 'แม้ดูดีขึ้น ก็ยังต้องไป รพ. เพราะอาจมี "Secondary drowning" ภายใน 24 ชม.', nextStepId: 'end' },
          { id: 'b', text: 'จัดท่าตะแคง รักษาอบอุ่น พาไป รพ.', correct: true,
            feedback: 'ใช่ — Recovery position และพาไปตรวจปอด', nextStepId: 'end' },
          { id: 'c', text: 'ให้ดื่มน้ำชา', correct: false,
            feedback: 'ห้ามให้กิน-ดื่ม จนกว่าจะตรวจที่ รพ.', nextStepId: 'end' },
        ],
      },
    ],
  },
]

export const scenariosById = Object.fromEntries(scenarios.map(s => [s.id, s]))
