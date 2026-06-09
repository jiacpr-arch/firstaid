// Pre-test และ Post-test สำหรับหลักสูตรปฐมพยาบาลเบื้องต้น
// ข้อสอบดัดแปลงจากคู่มือต้นฉบับ "การปฐมพยาบาลเบื้องต้น ฉบับประชาชนทั่วไป" โดย หมอเจี่ย
// คะแนนผ่าน Post-test: ≥ 80%

// ────────── คลังข้อสอบรวม 30 ข้อ (ครอบคลุม 4 บท) ──────────

const QUESTIONS_CH1 = [
  {
    id: 'c1q1',
    chapter: 1,
    question: 'เบอร์โทรฉุกเฉินทางการแพทย์ของประเทศไทยคือ?',
    choices: [
      { id: 'a', text: '191' },
      { id: 'b', text: '1669' },
      { id: 'c', text: '1196' },
      { id: 'd', text: '199' },
    ],
    correctId: 'b',
    explanation: '1669 — สถาบันการแพทย์ฉุกเฉินแห่งชาติ โทรฟรี 24 ชม.',
  },
  {
    id: 'c1q2',
    chapter: 1,
    question: 'พบผู้ประสบภัยรู้สึกตัวดี ขั้นแรกควรทำ?',
    choices: [
      { id: 'a', text: 'แตะตัวเริ่มช่วยทันที' },
      { id: 'b', text: 'แนะนำตัวเป็นอาสาปฐมพยาบาล แล้วถาม "ให้ช่วยไหม?"' },
      { id: 'c', text: 'รอจนผู้ป่วยร้องขอความช่วยเหลือ' },
      { id: 'd', text: 'ถ่ายคลิปขอความช่วยเหลือออนไลน์' },
    ],
    correctId: 'b',
    explanation: 'ต้องขออนุญาตก่อนแตะตัวผู้ที่รู้สึกตัวดี',
  },
  {
    id: 'c1q3',
    chapter: 1,
    question: 'หากสัมผัสเลือดเข้าตา/ปาก/จมูก ควรล้างน้ำนาน?',
    choices: [
      { id: 'a', text: '5 นาที' },
      { id: 'b', text: '10 นาที' },
      { id: 'c', text: 'มากกว่า 15 นาที' },
      { id: 'd', text: 'ไม่ต้องล้าง' },
    ],
    correctId: 'c',
    explanation: 'ล้างน้ำเปล่าปริมาณมากๆ มากกว่า 15 นาที',
  },
  {
    id: 'c1q4',
    chapter: 1,
    question: 'การล้างมือด้วยสบู่ ควรถูนานอย่างน้อย?',
    choices: [
      { id: 'a', text: '5 วินาที' },
      { id: 'b', text: '10 วินาที' },
      { id: 'c', text: '20 วินาที' },
      { id: 'd', text: '60 วินาที' },
    ],
    correctId: 'c',
    explanation: 'ถูให้ทั่ว 7 ขั้นตอน นานอย่างน้อย 20 วินาที',
  },
  {
    id: 'c1q5',
    chapter: 1,
    question: 'ผู้ประสบภัยปลุกไม่ตื่น มีเสียงกรน หายใจพะงาบ หมายถึง?',
    choices: [
      { id: 'a', text: 'หลับสนิท' },
      { id: 'b', text: 'ภาวะฉุกเฉินถึงชีวิต ต้อง CPR' },
      { id: 'c', text: 'อิ่มอาหารมาก' },
      { id: 'd', text: 'ฝันร้าย' },
    ],
    correctId: 'b',
    explanation: 'หายใจพะงาบเป็นสัญญาณหัวใจหยุดเต้น',
  },
]

const QUESTIONS_CH2 = [
  {
    id: 'c2q1',
    chapter: 2,
    question: 'การกระทุ้งท้องผู้ป่วยสำลัก ควรวางมือบริเวณ?',
    choices: [
      { id: 'a', text: 'คอ' },
      { id: 'b', text: 'หัวเข็มขัด/เหนือสะดือเล็กน้อย' },
      { id: 'c', text: 'ใต้สะดือ' },
      { id: 'd', text: 'กลางหน้าอก' },
    ],
    correctId: 'b',
    explanation: 'ตำแหน่งหัวเข็มขัดหรือเหนือสะดือเล็กน้อย',
  },
  {
    id: 'c2q2',
    chapter: 2,
    question: 'หญิงตั้งครรภ์สำลัก ควรกระทุ้งบริเวณใด?',
    choices: [
      { id: 'a', text: 'หน้าท้องเหมือนปกติ' },
      { id: 'b', text: 'กระดูกหน้าอก (โอบรอบรักแร้)' },
      { id: 'c', text: 'หลัง' },
      { id: 'd', text: 'คอ' },
    ],
    correctId: 'b',
    explanation: 'ห้ามกดหน้าท้อง — ใช้กระดูกหน้าอกแทน',
  },
  {
    id: 'c2q3',
    chapter: 2,
    question: 'อาการแพ้รุนแรง: หายใจลำบาก หน้าบวม ปากบวม ไม่มีสติ?',
    choices: [
      { id: 'a', text: 'ใช่ — Anaphylaxis' },
      { id: 'b', text: 'ไม่ใช่' },
    ],
    correctId: 'a',
    explanation: 'อาการคลาสสิคของ anaphylaxis',
  },
  {
    id: 'c2q4',
    chapter: 2,
    question: 'EpiPen ฉีดที่ตำแหน่งใด?',
    choices: [
      { id: 'a', text: 'แขน' },
      { id: 'b', text: 'หน้าท้อง' },
      { id: 'c', text: 'กล้ามเนื้อต้นขา' },
      { id: 'd', text: 'หลัง' },
    ],
    correctId: 'c',
    explanation: 'กล้ามเนื้อต้นขา ฉีดผ่านเสื้อผ้าได้',
  },
  {
    id: 'c2q5',
    chapter: 2,
    question: 'ผู้ประสบภัยแน่นหน้าอก ปกติไม่มีโรค ไม่แพ้ ASA — ให้กิน?',
    choices: [
      { id: 'a', text: 'Paracetamol' },
      { id: 'b', text: 'Aspirin เคี้ยว 1 เม็ด' },
      { id: 'c', text: 'น้ำเปล่า' },
      { id: 'd', text: 'ห้ามให้อะไร' },
    ],
    correctId: 'b',
    explanation: 'Aspirin เคี้ยว 1 เม็ดทันที (ถ้าไม่แพ้/ไม่มีโรคกระเพาะ/โรคเลือด)',
  },
  {
    id: 'c2q6',
    chapter: 2,
    question: 'อาการแขน/ขา ชา อ่อนแรง ข้างเดียว มักเป็น?',
    choices: [
      { id: 'a', text: 'หมดสติ' },
      { id: 'b', text: 'อัมพาต (Stroke)' },
      { id: 'c', text: 'หัวใจวาย' },
      { id: 'd', text: 'ชัก' },
    ],
    correctId: 'b',
    explanation: 'อาการคลาสสิคของ Stroke',
  },
  {
    id: 'c2q7',
    chapter: 2,
    question: 'น้ำตาลตก ผู้ป่วยกลืน/นั่งได้ ควรให้น้ำตาลหรือไม่?',
    choices: [
      { id: 'a', text: 'ควร' },
      { id: 'b', text: 'ไม่ควร' },
    ],
    correctId: 'a',
    explanation: 'ให้ทันที — น้ำผลไม้ นม น้ำตาล น้ำผึ้ง',
  },
  {
    id: 'c2q8',
    chapter: 2,
    question: 'ผู้ป่วยกำลังชัก สิ่งที่ห้ามทำ?',
    choices: [
      { id: 'a', text: 'หนุนศีรษะด้วยของนุ่ม' },
      { id: 'b', text: 'จับเวลา' },
      { id: 'c', text: 'ใส่ช้อน/ผ้าในปาก' },
      { id: 'd', text: 'เคลียร์ของรอบตัว' },
    ],
    correctId: 'c',
    explanation: 'ห้ามใส่ของในปาก — เสี่ยงสำลัก ฟันหัก กัดมือ',
  },
]

const QUESTIONS_CH3 = [
  {
    id: 'c3q1',
    chapter: 3,
    question: 'การห้ามเลือดที่ดีที่สุด?',
    choices: [
      { id: 'a', text: 'กดบริเวณที่เลือดออกตรงๆ' },
      { id: 'b', text: 'รัดด้วยยางรถ' },
      { id: 'c', text: 'ราดแอลกอฮอล์' },
      { id: 'd', text: 'แช่น้ำเกลือ' },
    ],
    correctId: 'a',
    explanation: 'Direct pressure คือมาตรฐาน',
  },
  {
    id: 'c3q2',
    chapter: 3,
    question: 'เลือดกำเดาไหล ควรอยู่ในท่า?',
    choices: [
      { id: 'a', text: 'เงยหน้า' },
      { id: 'b', text: 'เอนหลัง' },
      { id: 'c', text: 'เอนตัวไปข้างหน้า' },
      { id: 'd', text: 'นอนหงาย' },
    ],
    correctId: 'c',
    explanation: 'เอนตัวไปข้างหน้า ไม่ให้เลือดไหลลงคอ',
  },
  {
    id: 'c3q3',
    chapter: 3,
    question: 'ของมีคมคาในตัวผู้ป่วย ควรทำอย่างไร?',
    choices: [
      { id: 'a', text: 'ดึงออกทันที' },
      { id: 'b', text: 'ปล่อยไว้ ห้ามดึง' },
      { id: 'c', text: 'หมุนคลายออก' },
      { id: 'd', text: 'กรีดแผลเอาออก' },
    ],
    correctId: 'b',
    explanation: 'ห้ามดึง — แผลจะกว้างขึ้น เลือดออกมาก',
  },
  {
    id: 'c3q4',
    chapter: 3,
    question: 'ฟันหลุดจากปาก ควรเก็บอย่างไร?',
    choices: [
      { id: 'a', text: 'แช่ในน้ำส้มสายชู' },
      { id: 'b', text: 'แช่ในน้ำนมหรือน้ำสะอาด' },
      { id: 'c', text: 'ห่อด้วยกระดาษทิชชู่' },
      { id: 'd', text: 'ทิ้งไป — แพทย์ปลูกฟันใหม่ได้' },
    ],
    correctId: 'b',
    explanation: 'แช่ในน้ำนมหรือน้ำสะอาด จับเฉพาะเนื้อฟัน',
  },
  {
    id: 'c3q5',
    chapter: 3,
    question: 'สับสน คลื่นไส้ อาเจียน ปวดศีรษะ หลังกระแทก = บาดเจ็บที่ศีรษะ?',
    choices: [
      { id: 'a', text: 'ใช่' },
      { id: 'b', text: 'ไม่ใช่' },
    ],
    correctId: 'a',
    explanation: 'อาการเหล่านี้บ่งบอกบาดเจ็บที่ศีรษะ',
  },
  {
    id: 'c3q6',
    chapter: 3,
    question: 'ข้อเท้าผิดรูป ควรประคบร้อนเพื่อลดบวม?',
    choices: [
      { id: 'a', text: 'จริง' },
      { id: 'b', text: 'ไม่จริง — ต้องประคบเย็น 20 นาที' },
    ],
    correctId: 'b',
    explanation: 'ประคบเย็นด้วยน้ำแข็ง 20 นาที',
  },
  {
    id: 'c3q7',
    chapter: 3,
    question: 'แผลไหม้เล็กน้อย ควรล้างด้วยน้ำชนิดใด?',
    choices: [
      { id: 'a', text: 'น้ำอุ่น' },
      { id: 'b', text: 'น้ำแข็งประคบ' },
      { id: 'c', text: 'น้ำเย็น' },
      { id: 'd', text: 'น้ำอุณหภูมิห้อง' },
    ],
    correctId: 'd',
    explanation: 'น้ำเย็น/น้ำแข็งจะทำให้แผลแย่ลง',
  },
  {
    id: 'c3q8',
    chapter: 3,
    question: 'แผลไหม้ขนาดใหญ่ ห่มผู้ป่วยด้วย?',
    choices: [
      { id: 'a', text: 'ผ้าเปียก' },
      { id: 'b', text: 'ผ้าแห้ง' },
      { id: 'c', text: 'พลาสติก' },
      { id: 'd', text: 'อลูมิเนียมฟอยล์' },
    ],
    correctId: 'b',
    explanation: 'ห่มผ้าแห้ง — ป้องกันการเสียความร้อน',
  },
  {
    id: 'c3q9',
    chapter: 3,
    question: 'พบผู้ถูกไฟฟ้าช็อตที่ยังติดสายไฟ ขั้นแรกควร?',
    choices: [
      { id: 'a', text: 'ดึงตัวออกทันทีด้วยมือ' },
      { id: 'b', text: 'ปิดสะพานไฟใหญ่ก่อน' },
      { id: 'c', text: 'ราดน้ำดับ' },
      { id: 'd', text: 'เริ่ม CPR ทันที' },
    ],
    correctId: 'b',
    explanation: 'ปิดสะพานไฟก่อน — กระแสไฟฟ้านำผ่านคนได้',
  },
]

const QUESTIONS_CH4 = [
  {
    id: 'c4q1',
    chapter: 4,
    question: 'งูกัด สิ่งที่ควรทำ?',
    choices: [
      { id: 'a', text: 'รัดเหนือแผล' },
      { id: 'b', text: 'ดูดพิษออก' },
      { id: 'c', text: 'กรีดแผล' },
      { id: 'd', text: 'ให้ผู้ป่วยอยู่นิ่งสงบ ล้างน้ำ โทร 1669' },
    ],
    correctId: 'd',
    explanation: 'ห้ามรัด/ดูด/กรีด — ทำให้พิษกระจายเร็วและติดเชื้อ',
  },
  {
    id: 'c4q2',
    chapter: 4,
    question: 'หลังถูกแมลง/ผึ้งต่อย ควรสังเกตอาการนาน?',
    choices: [
      { id: 'a', text: '10 นาที' },
      { id: 'b', text: '20 นาที' },
      { id: 'c', text: '30 นาที' },
      { id: 'd', text: '60 นาที' },
    ],
    correctId: 'c',
    explanation: 'อย่างน้อย 30 นาที สังเกตการแพ้รุนแรง',
  },
  {
    id: 'c4q3',
    chapter: 4,
    question: 'ผึ้งต่อย เอาเข็มออกโดย?',
    choices: [
      { id: 'a', text: 'บีบดึงออก' },
      { id: 'b', text: 'ขูดด้วยวัสดุขอบมน (บัตรแข็ง)' },
      { id: 'c', text: 'ใช้แหนบจับ' },
      { id: 'd', text: 'ปล่อยไว้' },
    ],
    correctId: 'b',
    explanation: 'ขูดด้วยบัตรแข็ง — ห้ามรีด (จะดันพิษเข้าตัว)',
  },
  {
    id: 'c4q4',
    chapter: 4,
    question: 'จับหมัด (Tick) ออกจากผิวโดย?',
    choices: [
      { id: 'a', text: 'จี้ด้วยไม้ร้อน' },
      { id: 'b', text: 'ล้างด้วยแอลกอฮอล์' },
      { id: 'c', text: 'ใช้มือหยิบ' },
      { id: 'd', text: 'ใช้คีมหนีบหัว-ปาก แล้วยกตรงๆ' },
    ],
    correctId: 'd',
    explanation: 'คีมหนีบหัว-ปาก ยกตรงๆ ห้ามหมุน/พลิก',
  },
  {
    id: 'c4q5',
    chapter: 4,
    question: 'ลมแดดอันตรายถึงชีวิตจริงหรือไม่?',
    choices: [
      { id: 'a', text: 'จริง' },
      { id: 'b', text: 'ไม่จริง' },
    ],
    correctId: 'a',
    explanation: 'ภาวะถึงชีวิต — ต้องลดอุณหภูมิทันทีในนาทีแรก',
  },
  {
    id: 'c4q6',
    chapter: 4,
    question: 'ลมแดด — วางผ้าเย็นบริเวณใด?',
    choices: [
      { id: 'a', text: 'ฝ่ามือ ฝ่าเท้า' },
      { id: 'b', text: 'หน้าผาก' },
      { id: 'c', text: 'คอ รักแร้ ขาหนีบ' },
      { id: 'd', text: 'หลัง' },
    ],
    correctId: 'c',
    explanation: 'จุดที่มีเส้นเลือดใหญ่ใกล้ผิว — คอ รักแร้ ขาหนีบ',
  },
  {
    id: 'c4q7',
    chapter: 4,
    question: 'อาการสับสน อาจเป็นได้ทั้งลมแดดและภาวะตัวเย็น?',
    choices: [
      { id: 'a', text: 'ถูก' },
      { id: 'b', text: 'ผิด' },
    ],
    correctId: 'a',
    explanation: 'ทั้งสองภาวะมีอาการสับสน — ดูบริบทอื่นประกอบ',
  },
  {
    id: 'c4q8',
    chapter: 4,
    question: 'CPR ผู้ถูกเคมีอันตราย ใช้หน้ากากทุกครั้ง?',
    choices: [
      { id: 'a', text: 'ถูก' },
      { id: 'b', text: 'ผิด' },
    ],
    correctId: 'a',
    explanation: 'ป้องกันผู้ช่วยจากสารพิษ — ห้ามเป่าปาก',
  },
]

export const ALL_QUESTIONS = [
  ...QUESTIONS_CH1,
  ...QUESTIONS_CH2,
  ...QUESTIONS_CH3,
  ...QUESTIONS_CH4,
]

// Pre-test: 10 ข้อ สุ่ม 2-3 ข้อต่อบท
const PRE_TEST_QUESTIONS = [
  QUESTIONS_CH1[0], QUESTIONS_CH1[1], QUESTIONS_CH1[4],
  QUESTIONS_CH2[0], QUESTIONS_CH2[2], QUESTIONS_CH2[5],
  QUESTIONS_CH3[0], QUESTIONS_CH3[1], QUESTIONS_CH3[6],
  QUESTIONS_CH4[0],
]

// Post-test: 20 ข้อ ครอบคลุมทุกบท
const POST_TEST_QUESTIONS = [
  ...QUESTIONS_CH1.slice(0, 4),
  ...QUESTIONS_CH2.slice(0, 6),
  ...QUESTIONS_CH3.slice(0, 6),
  ...QUESTIONS_CH4.slice(0, 4),
]

export const preTest = {
  id: 'pre-test',
  title: 'แบบทดสอบก่อนเรียน',
  description: 'ทดสอบความรู้พื้นฐานก่อนเริ่มหลักสูตร — ไม่มีคะแนนผ่าน/ตก',
  questions: PRE_TEST_QUESTIONS,
}

export const postTest = {
  id: 'post-test',
  title: 'แบบทดสอบหลังเรียน',
  description: 'ผ่านที่คะแนน 80% ขึ้นไป เพื่อรับใบประกาศภาคทฤษฎี',
  passingScore: 80,
  questions: POST_TEST_QUESTIONS,
}
