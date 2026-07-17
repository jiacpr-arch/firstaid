import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, Volume2, VolumeX } from 'lucide-react';
import {
  scenarios, LEVEL_META, TRACK_META, trackOf,
} from '../courses/firstaid/gameScenarios';
import { getCharacter } from '../game/characters';
import CharacterSprite from '../game/CharacterSprite';
import EcgStrip from '../game/EcgStrip';
import {
  createInitialState, applyFx, nextNode, recordCorrect, recordWrong,
  gradeFor, fmtTime, shuffled, getDifficulty, pushEtco2, wasArrest, correctCount,
  scoreFor, speedBonus, avgSpeed, FAST_FRACTION, comboMultiplier,
  DIFFICULTY, DEFAULT_DIFFICULTY,
} from '../game/storyEngine';
import {
  initAudio, playShockSound, playROSCSound, playWarningBeep,
  playMetronomeClick, playBeep,
} from '../utils/sound';
import { track } from '../utils/analytics';
import {
  recordGrade, syncAwards, listWithEarned, readGrades, ACHIEVEMENTS,
} from '../game/achievements';
import './firstAidGame.css';

// เกมโหมดโบนัสของ FirstAid Morroo — engine เดียวกับ Code Blue Sim (acls-emr)
// แต่เนื้อหา/ตัวละคร/ป้ายเป็นปฐมพยาบาลสำหรับคนทั่วไป และไม่ผูกกับ progress/ใบเซอร์
const GAME_NAME = 'FIRST AID HERO';
const GAME_EYEBROW = 'ฮีโร่ปฐมพยาบาล';

const HISCORE_PREFIX = 'firstaid_game_hiscore';
const MUTE_KEY = 'firstaid_game_muted';
const DIFF_KEY = 'firstaid_game_difficulty';
const hiscoreKey = (diff) => `${HISCORE_PREFIX}_${diff}`;

// สำเนาสถานะ engine สำหรับ render (render ห้ามอ่าน ref ตรงๆ)
function snapshot(st) {
  return { ...st, timeline: [...st.timeline], etco2Trace: [...st.etco2Trace] };
}

// ป้ายบนจอ AED (โชว์เฉพาะหลังแปะแผ่น AED — คนทั่วไปไม่มี monitor ก่อนหน้านั้น)
const RHYTHM_NAMES = {
  flat: 'ไม่มีสัญญาณชีพ ⚠',
  vf: 'AED: แนะนำช็อกไฟฟ้า ⚠',
  nsr: 'ฟื้นแล้ว — มีชีพจร',
  brady: 'ชีพจรช้าผิดปกติ ⚠',
  pacing: 'เครื่องกระตุ้นทำงาน',
  tachy: 'ชีพจรเร็วผิดปกติ ⚠',
};
// rhythm ที่ "มีชีพจรแต่ไม่เสถียร" — เตือนสีทอง ไม่ blink (ต่างจาก shockable/arrest ที่ blink แดง)
const WARN_RHYTHMS = new Set(['brady', 'pacing', 'tachy']);

const CLEARED_KEY = 'firstaid_game_cleared'; // เก็บ id เคสที่เคยผ่าน
const readCleared = () => {
  try { return new Set(JSON.parse(localStorage.getItem(CLEARED_KEY)) || []); }
  catch { return new Set(); }
};

// ปลดล็อกราย "หมวด" (track): เคสยากของหมวดปลดเมื่อผ่าน basic ของหมวดนั้นก่อน
// — บังคับลำดับการเรียนให้ไต่ทีละหมวด แทนปลดทั้งคลังพร้อมกัน
const TRACK_BASIC_TO_UNLOCK = 2; // ต้องผ่าน basic ของหมวดอย่างน้อยเท่านี้ (หรือเท่าที่หมวดมี)
// หมวดที่ไม่มีเคส basic เลย ใช้เกณฑ์รวม: ผ่าน basic หมวดไหนก็ได้
const BASIC_TO_UNLOCK = 3;

const isBasic = (s) => (LEVEL_META[s.level]?.order || 0) === 0;

// จำนวนเคส basic (ในคลังปัจจุบัน) ที่ผู้เล่นผ่านแล้ว
function clearedBasicCount(cleared, pool) {
  return pool.filter((s) => isBasic(s) && cleared.has(s.id)).length;
}

// เคสนี้ล็อกอยู่ไหม: left = ต้องผ่าน basic อีกกี่เคส (0 = ปลดแล้ว),
// inTrack = เกณฑ์นับเฉพาะ basic ของหมวดนี้ (ไว้เลือกข้อความบนป้ายล็อก)
function lockInfo(sc, cleared, pool) {
  if (isBasic(sc)) return { left: 0, inTrack: false };
  const basics = pool.filter((s) => isBasic(s) && trackOf(s) === trackOf(sc));
  if (basics.length > 0) {
    const need = Math.min(TRACK_BASIC_TO_UNLOCK, basics.length);
    const done = basics.filter((s) => cleared.has(s.id)).length;
    return { left: Math.max(0, need - done), inTrack: true };
  }
  return { left: Math.max(0, BASIC_TO_UNLOCK - clearedBasicCount(cleared, pool)), inTrack: false };
}

const isUnlocked = (sc, cleared, pool) => lockInfo(sc, cleared, pool).left === 0;

// สุ่มเคสให้ปุ่ม 🎲 — แยกไว้นอก component (react-hooks/purity ไม่ให้เรียก Math.random ใน render)
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

// คลังโจทย์คงที่จากไฟล์ในโค้ด (v1 ไม่มีโหลดจาก backend)
const pool = scenarios;

export default function FirstAidGame() {
  const navigate = useNavigate();
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem(DIFF_KEY) || DEFAULT_DIFFICULTY,
  );
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ---- engine state: mutable ใน ref (logic) + snapshot state (render) ----
  const S = useRef(createInitialState(DEFAULT_DIFFICULTY));
  const [view, setView] = useState(() => snapshot(createInitialState(DEFAULT_DIFFICULTY)));

  // เลือกเคส: ถ้ามีเคสเดียวข้ามหน้าเลือกไปหน้า title เลย
  const [sc, setSc] = useState(pool[0]);
  const [cleared, setCleared] = useState(readCleared);
  const [screen, setScreen] = useState(pool.length > 1 ? 'select' : 'title'); // select | title | game | debrief
  const [selectFilter, setSelectFilter] = useState('all'); // all | <track id>
  const [quitMenu, setQuitMenu] = useState(false); // เมนูออก/เล่นใหม่ ระหว่างเล่น
  const [freshAwards, setFreshAwards] = useState([]); // เหรียญที่เพิ่งปลดล็อก (โชว์ใน debrief)
  const [awardsTick, setAwardsTick] = useState(0); // บังคับ re-read เหรียญหลังจบเคส

  const [speaker, setSpeaker] = useState(null); // { who, pose, popN }
  const [plate, setPlate] = useState(null); // { name } override (time-skip)
  const [dlgHtml, setDlgHtml] = useState('');
  const [typing, setTyping] = useState(false);
  const [choice, setChoice] = useState(null); // { q, options, hintTgt }
  const [decisionLeft, setDecisionLeft] = useState(getDifficulty(difficulty).decisionTime);
  const [drama, setDrama] = useState(null); // null | 'red' | 'white'
  const [inter, setInter] = useState(null); // { text, green }
  const [flashN, setFlashN] = useState(0);
  const [redN, setRedN] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [comboBreak, setComboBreak] = useState(null); // { n, k } โชว์ตอนคอมโบขาด
  const [result, setResult] = useState(null); // { won, grade, score, isHiscore }
  const [hiscore, setHiscore] = useState(() => Number(localStorage.getItem(hiscoreKey(difficulty)) || 0));

  const timers = useRef({ type: null, dec: null, misc: [], metronome: null });
  const busyRef = useRef(false);
  const [awaitTap, setAwaitTap] = useState(false);
  const currentChoiceRef = useRef(null);
  const retryChoiceRef = useRef(null);
  const decisionLeftRef = useRef(0); // เวลาที่เหลือ ณ วินาทีที่กดเลือก (คำนวณโบนัสความไว)
  const comboBreakN = useRef(0);     // key ให้อนิเมชัน COMBO BREAK เล่นซ้ำได้
  const hintUsedRef = useRef(false); // โหมดง่าย: ใบ้ target หลังตอบผิดครั้งแรกของแต่ละจุด
  const typeDoneRef = useRef(null);
  const fullHtmlRef = useRef('');
  const popCounter = useRef(0);

  const stopMetronome = useCallback(() => {
    if (timers.current.metronome) {
      clearInterval(timers.current.metronome);
      timers.current.metronome = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    const t = timers.current;
    if (t.type) clearTimeout(t.type);
    if (t.dec) clearInterval(t.dec);
    if (t.metronome) clearInterval(t.metronome);
    t.misc.forEach(clearTimeout);
    t.type = null; t.dec = null; t.metronome = null; t.misc = [];
  }, []);
  useEffect(() => clearAllTimers, [clearAllTimers]);

  // ---- flow ทั้งหมดเป็น plain functions: เรียกไขว้/เรียกซ้ำกันได้อิสระ
  //      ปลอดภัยจาก stale closure เพราะแตะเฉพาะ ref + state setter (stable) ----

  function syncView() {
    setView(snapshot(S.current));
  }

  function later(fn, ms) {
    timers.current.misc.push(setTimeout(fn, ms));
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function sfx(fn) {
    if (!mutedRef.current) fn();
  }

  // metronome ~110/นาที ระหว่าง CPR (หยุดเมื่อ shock/ฟื้น/ผิด/จบเคส)
  function startMetronome() {
    stopMetronome();
    if (mutedRef.current) return;
    timers.current.metronome = setInterval(() => {
      if (!mutedRef.current) playMetronomeClick();
    }, 545);
  }

  // ผูกเสียงกับ fx ที่ node ทำ (เรียกก่อน applyFx เพื่ออ่านสถานะ cpr เดิม)
  function soundForFx(fx) {
    if (!fx) return;
    if (fx.shock) { sfx(playShockSound); stopMetronome(); }
    if (fx.rosc) { sfx(playROSCSound); stopMetronome(); }
    if (fx.alarm) sfx(playWarningBeep);
    if (fx.cpr && !S.current.cpr) startMetronome();
  }

  function finishTyping() {
    if (timers.current.type) clearTimeout(timers.current.type);
    timers.current.type = null;
    setDlgHtml(fullHtmlRef.current);
    setTyping(false);
    const done = typeDoneRef.current;
    typeDoneRef.current = null;
    if (done) done();
  }

  function typeText(html, onDone) {
    if (timers.current.type) clearTimeout(timers.current.type);
    fullHtmlRef.current = html;
    typeDoneRef.current = onDone || null;
    setTyping(true);
    setDlgHtml('');
    let i = 0;
    let out = '';
    const step = () => {
      if (i >= html.length) { finishTyping(); return; }
      const ch = html[i];
      if (ch === '<') {
        const close = html.indexOf('>', i);
        out += html.slice(i, close + 1);
        i = close + 1;
      } else {
        out += ch;
        i += 1;
      }
      setDlgHtml(out);
      timers.current.type = setTimeout(step, reducedMotion ? 0 : 16);
    };
    step();
  }

  function doShake() {
    setShaking(true);
    later(() => setShaking(false), 450);
  }

  function doBigMoment() {
    vibrate([90, 50, 160]);
    if (!reducedMotion) {
      setFlashN((n) => n + 1);
      doShake();
    }
  }

  function endCase(won) {
    clearAllTimers();
    const st = S.current;
    const grade = gradeFor(st, won);
    const score = scoreFor(st, won);
    const bonus = speedBonus(st, won);
    const speed = avgSpeed(st);
    // เคลียร์แบบ "ไว": ชนะ ไม่ผิดเลย และเฉลี่ยตอบถูกในครึ่งแรกของเวลา → เหรียญสายฟ้า
    const fastClear = won && st.wrong === 0 && speed >= FAST_FRACTION;
    const key = hiscoreKey(st.difficulty);
    let isHiscore = false;
    if (score > Number(localStorage.getItem(key) || 0)) {
      localStorage.setItem(key, String(score));
      setHiscore(score);
      isHiscore = score > 0;
    }
    let fresh = [];
    if (won) {
      const nextCleared = new Set(cleared);
      nextCleared.add(sc.id);
      setCleared(nextCleared);
      localStorage.setItem(CLEARED_KEY, JSON.stringify([...nextCleared]));
      // บันทึกเกรด + ปลดล็อกเหรียญ (client-side ล้วน) — โชว์เหรียญใหม่ในหน้า debrief
      const grades = recordGrade(sc.id, grade, st.difficulty, fastClear);
      const { fresh: freshIds } = syncAwards(pool, nextCleared, grades);
      fresh = ACHIEVEMENTS.filter((a) => freshIds.includes(a.id));
      setAwardsTick((n) => n + 1);
    }
    setFreshAwards(fresh);
    track('game_completed', {
      scenario_id: sc.id,
      difficulty: st.difficulty,
      won,
      grade,
      wrong: st.wrong,
      time_to_cpr: st.firstCPRAt,
      time_to_shock: st.firstShockAt,
      duration: st.simTime,
    });
    syncView();
    setResult({ won, grade, score, isHiscore, bonus, speed });
    setChoice(null);
    setInter(null);
    setScreen('debrief');
    window.scrollTo(0, 0);
  }

  function showChoice(c) {
    currentChoiceRef.current = c;
    setDrama('white');
    const diff = getDifficulty(S.current.difficulty);
    // โหมดง่าย: หลังพลาดจุดนี้ไปแล้วครั้งนึง ใบ้หมวด target ที่ถูก + dim ตัวที่ผิด
    const hintTgt = diff.hints && hintUsedRef.current
      ? (c.options.find((o) => o.ok)?.tgt || null)
      : null;
    setChoice({ q: c.q, options: shuffled(c.options), hintTgt });
    setDecisionLeft(diff.decisionTime);
    decisionLeftRef.current = diff.decisionTime;
    if (timers.current.dec) clearInterval(timers.current.dec);
    let left = diff.decisionTime;
    timers.current.dec = setInterval(() => {
      left -= 0.25;
      decisionLeftRef.current = left;
      setDecisionLeft(left);
      if (left <= 0) {
        clearInterval(timers.current.dec);
        timers.current.dec = null;
        pick({
          ok: false,
          timeout: true,
          why: 'หมดเวลา — ในเหตุฉุกเฉิน ความลังเลทำให้ผู้ป่วยแย่ลง',
          worsen: true,
        });
      }
    }, 250);
  }

  function runNode(node) {
    const st = S.current;
    if (node.t) st.simTime += node.t;
    syncView();

    if (node.say) {
      const { who, pose, text, fx } = node.say;
      soundForFx(fx);
      applyFx(st, fx);
      pushEtco2(st);
      setDrama(pose === 'panic' ? 'red' : null);
      popCounter.current += 1;
      setSpeaker({ who, pose, popN: popCounter.current });
      setPlate(null);
      setAwaitTap(true);
      typeText(text);
      syncView();
      return;
    }

    if (node.inter) {
      busyRef.current = true;
      soundForFx(node.fx);
      applyFx(st, node.fx);
      pushEtco2(st);
      if (node.drama) setDrama(node.drama);
      syncView();
      doBigMoment();
      setInter({ text: node.inter, green: !!node.green });
      later(() => {
        setInter(null);
        busyRef.current = false;
        advance();
      }, reducedMotion ? 350 : 1050);
      return;
    }

    if (node.skip) {
      busyRef.current = true;
      setDrama(null);
      popCounter.current += 1;
      setSpeaker({ who: 'opr_1669', pose: 'idle', popN: popCounter.current });
      setPlate({ name: '— เวลาเดินต่อ —' });
      setAwaitTap(false);
      typeText(`⏩ ${node.skip}…`, () => {
        later(() => {
          busyRef.current = false;
          advance();
        }, reducedMotion ? 200 : 700);
      });
      return;
    }

    if (node.choice) {
      showChoice(node.choice);
      return;
    }

    if (node.end) {
      endCase(true);
      return;
    }

    advance();
  }

  function advance() {
    const node = nextNode(S.current, sc.story);
    if (!node) { endCase(true); return; }
    runNode(node);
  }

  function pick(option) {
    if (timers.current.dec) { clearInterval(timers.current.dec); timers.current.dec = null; }
    setChoice(null);
    const st = S.current;

    if (option.ok) {
      // สัดส่วนเวลาที่เหลือ = ความไว (ตอบทันที ≈ 1, ตอบตอนจวนหมดเวลา ≈ 0)
      const dt = getDifficulty(st.difficulty).decisionTime;
      const speedFrac = dt > 0 ? decisionLeftRef.current / dt : 0;
      recordCorrect(st, option, speedFrac);
      currentChoiceRef.current = null;
      hintUsedRef.current = false; // จุดถัดไปเริ่มใหม่ ไม่ใบ้
      // เสียงคอมโบ — ยิ่งสตรีคยาว เสียงยิ่งสูงขึ้น (juice)
      if (st.combo >= 2) sfx(() => playBeep(360 + Math.min(st.combo, 8) * 70, 0.1, 0.22));
      syncView();
      advance();
      return;
    }

    // คอมโบขาด — ถ้าสตรีคเคยยาวพอ โชว์ "BREAK" ให้รู้สึกถึงการเสีย streak
    if (st.combo >= 3) {
      setComboBreak({ n: st.combo, k: comboBreakN.current++ });
      later(() => setComboBreak(null), reducedMotion ? 300 : 900);
    }
    recordWrong(st, option);
    pushEtco2(st);
    hintUsedRef.current = true; // จุดนี้เคยพลาด — โหมดง่ายจะใบ้ตอนเล่นซ้ำ
    vibrate([60, 40, 60]);
    sfx(() => playBeep(160, 0.28, 0.35)); // เสียงผิดต่ำ
    if (!reducedMotion) {
      setRedN((n) => n + 1);
      doShake();
    }
    stopMetronome();
    syncView();

    popCounter.current += 1;
    setSpeaker({ who: 'opr_1669', pose: 'stern', popN: popCounter.current });
    setPlate(null);
    setDrama('red');

    // โหมดยาก: ไม่เฉลยเหตุผลตอนพลาด (เก็บไว้ debrief) — เพิ่มความกดดัน
    const showWhy = getDifficulty(st.difficulty).showWhyOnWrong;
    const whyText = showWhy ? ` ${option.why}` : '';

    if (st.hp <= 0) {
      setAwaitTap(false);
      typeText(`<span class="cbs-em">ผู้ป่วยไปแล้ว…</span>${whyText}`, () => {
        later(() => endCase(false), reducedMotion ? 400 : 1400);
      });
      return;
    }

    // ดุแล้วให้ตัดสินใจข้อเดิมซ้ำ (สภาพแย่ลงแล้ว)
    retryChoiceRef.current = currentChoiceRef.current;
    setAwaitTap(true);
    typeText(
      `<span class="cbs-em">ช้าก่อน!</span>${whyText}${option.worsen ? ' — ผู้ป่วยแย่ลง อาการทรุดหนักขึ้น!' : ''}`,
    );
  }

  function onDialogTap() {
    if (busyRef.current) return;
    if (timers.current.type) { finishTyping(); return; }
    if (!awaitTap) return;
    setAwaitTap(false);
    if (retryChoiceRef.current) {
      const c = retryChoiceRef.current;
      retryChoiceRef.current = null;
      showChoice(c);
      return;
    }
    advance();
  }

  function startGame() {
    clearAllTimers();
    setQuitMenu(false);
    if (!mutedRef.current) initAudio(); // ปลดล็อก AudioContext ตอนผู้ใช้แตะปุ่ม
    S.current = createInitialState(difficulty);
    syncView();
    busyRef.current = false;
    setAwaitTap(false);
    currentChoiceRef.current = null;
    retryChoiceRef.current = null;
    hintUsedRef.current = false;
    setResult(null);
    setFreshAwards([]);
    setComboBreak(null);
    setChoice(null);
    setInter(null);
    setDrama(null);
    setSpeaker(null);
    setPlate(null);
    setDlgHtml('');
    setScreen('game');
    track('game_started', { scenario_id: sc.id, difficulty });
    later(() => advance(), reducedMotion ? 100 : 400);
  }

  function pickScenario(chosen) {
    setSc(chosen);
    setScreen('title');
    window.scrollTo(0, 0);
  }

  function backToSelect() {
    clearAllTimers();
    stopMetronome();
    setQuitMenu(false);
    if (pool.length > 1) setScreen('select');
    else navigate('/');
  }

  function chooseDifficulty(id) {
    setDifficulty(id);
    localStorage.setItem(DIFF_KEY, id);
    setHiscore(Number(localStorage.getItem(hiscoreKey(id)) || 0));
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      if (next) stopMetronome();
      return next;
    });
  }

  // ============ AWARDS (รางวัล/เหรียญ) ============
  if (screen === 'awards') {
    // awardsTick อ้างในนี้เพื่อให้ re-read localStorage หลังจบเคส (ค่าเหรียญ sticky)
    void awardsTick;
    const badges = listWithEarned(pool, cleared, readGrades());
    const earnedN = badges.filter((b) => b.earned).length;
    return (
      <div className="cbs-app">
        <section className="cbs-select">
          <div className="cbs-eyebrow">{GAME_EYEBROW} · รางวัลของฉัน</div>
          <h1 className="cbs-select-title"><span className="cbs-gold-text">เหรียญ</span> ที่ปลดล็อกได้</h1>
          <p className="cbs-select-sub">ปลดล็อกแล้ว {earnedN}/{badges.length} — เก็บครบทุกเหรียญเพื่อพิสูจน์ฝีมือฮีโร่ปฐมพยาบาล</p>
          <div className="cbs-award-grid">
            {badges.map((b) => (
              <div key={b.id} className={`cbs-badge ${b.earned ? 'cbs-badge-on' : 'cbs-badge-off'}`}>
                <span className="cbs-badge-icon">{b.earned ? b.icon : '🔒'}</span>
                <span className="cbs-badge-title">{b.title}</span>
                <span className="cbs-badge-desc">{b.desc}</span>
              </div>
            ))}
          </div>
          <button type="button" className="cbs-btn-ghost" onClick={() => { setScreen('select'); window.scrollTo(0, 0); }}>
            ← กลับไปเลือกเคส
          </button>
        </section>
      </div>
    );
  }

  // ============ CASE SELECT ============
  if (screen === 'select') {
    // awardsTick บังคับให้คำนวณเหรียญใหม่หลังจบเคส (ค่าอยู่ใน localStorage)
    void awardsTick;
    const badgeList = listWithEarned(pool, cleared, readGrades());
    // จัดกลุ่มตาม "หมวด" — level เหลือเป็นป้ายความยากบนการ์ด
    const tracksInPool = [...new Set(pool.map(trackOf))]
      .sort((a, b) => (TRACK_META[a]?.order ?? 9) - (TRACK_META[b]?.order ?? 9));
    const shownTracks = selectFilter === 'all' ? tracksInPool : tracksInPool.filter((t) => t === selectFilter);
    // เคสในหมวดเรียงง่าย→ยาก ให้แต่ละหมวดเป็นบันไดของตัวเอง
    const casesInTrack = (tk) => pool
      .filter((c) => trackOf(c) === tk)
      .sort((a, b) => (LEVEL_META[a.level]?.order ?? 0) - (LEVEL_META[b.level]?.order ?? 0));
    const orderedAll = tracksInPool.flatMap(casesInTrack);
    // เคสแนะนำถัดไป: เคสแรก (ตามลำดับหมวด+ความยาก) ที่ปลดแล้วแต่ยังไม่ผ่าน — กดปุ่มเดียวเล่นต่อได้เลย
    const nextCase = orderedAll.find((c) => !cleared.has(c.id) && isUnlocked(c, cleared, pool));

    // สุ่มเคสจากที่ปลดล็อกแล้ว (เอาเคสที่ยังไม่ผ่านก่อน) — โหมดทบทวนไม่ต้องเลือกเอง
    const randomCase = () => {
      const unlockedAll = orderedAll.filter((c) => isUnlocked(c, cleared, pool));
      const fresh = unlockedAll.filter((c) => !cleared.has(c.id));
      const src = fresh.length ? fresh : unlockedAll;
      if (src.length) pickScenario(pickRandom(src));
    };

    const renderCase = (c) => {
      const { left, inTrack } = lockInfo(c, cleared, pool);
      const unlocked = left === 0;
      const done = cleared.has(c.id);
      return (
        <button
          key={c.id}
          type="button"
          className={`cbs-case ${unlocked ? '' : 'cbs-case-locked'}`}
          onClick={() => unlocked && pickScenario(c)}
          disabled={!unlocked}
        >
          <div className="cbs-case-top">
            <span className={`cbs-case-level cbs-lvl-${c.level}`}>{LEVEL_META[c.level]?.label || c.level}</span>
            {done && <span className="cbs-case-done">✓ ผ่านแล้ว</span>}
            {!unlocked && (
              <span className="cbs-case-lock">🔒 ผ่านพื้นฐาน{inTrack ? 'หมวดนี้' : ''}อีก {left} เคส</span>
            )}
          </div>
          <div className="cbs-case-name">{c.title}</div>
          <div className="cbs-case-desc">{c.subtitle}</div>
        </button>
      );
    };

    return (
      <div className="cbs-app">
        <section className="cbs-select">
          <div className="cbs-eyebrow">{GAME_EYEBROW} · เลือกเคส</div>
          <h1 className="cbs-select-title"><span className="cbs-gold-text">{GAME_NAME}</span> ภารกิจช่วยชีวิต</h1>
          <p className="cbs-select-sub">
            ฝึกตัดสินใจช่วยชีวิตทีละสถานการณ์ — ผ่านเคสพื้นฐานของหมวด เพื่อปลดเคสที่ยากขึ้นในหมวดนั้น
          </p>
          {(nextCase || pool.length > 1) && (
            <div className="cbs-quick-row">
              {nextCase && (
                <button type="button" className="cbs-next" onClick={() => pickScenario(nextCase)}>
                  <span className="cbs-next-eyebrow">▶ เคสแนะนำถัดไป</span>
                  <span className="cbs-next-name">{nextCase.title}</span>
                  <span className="cbs-next-meta">
                    {TRACK_META[trackOf(nextCase)].icon} {TRACK_META[trackOf(nextCase)].label}
                    {' · '}
                    {LEVEL_META[nextCase.level]?.label || nextCase.level}
                  </span>
                </button>
              )}
              {pool.length > 1 && (
                <button type="button" className="cbs-dice" onClick={randomCase} aria-label="สุ่มเคส">
                  🎲
                  <span className="cbs-dice-label">สุ่มเคส</span>
                </button>
              )}
            </div>
          )}
          {tracksInPool.length > 1 && (
            <div className="cbs-select-tabs" role="group" aria-label="กรองตามหมวด">
              <button
                type="button"
                className={`cbs-tab ${selectFilter === 'all' ? 'cbs-tab-on' : ''}`}
                onClick={() => setSelectFilter('all')}
                aria-pressed={selectFilter === 'all'}
              >
                ทั้งหมด
              </button>
              {tracksInPool.map((tk) => (
                <button
                  key={tk}
                  type="button"
                  className={`cbs-tab ${selectFilter === tk ? 'cbs-tab-on' : ''}`}
                  onClick={() => setSelectFilter(tk)}
                  aria-pressed={selectFilter === tk}
                >
                  {TRACK_META[tk]?.icon} {TRACK_META[tk]?.label || tk}
                </button>
              ))}
            </div>
          )}
          <div className="cbs-case-groups">
            {shownTracks.map((tk) => {
              const cases = casesInTrack(tk);
              const doneCount = cases.filter((c) => cleared.has(c.id)).length;
              const meta = TRACK_META[tk] || TRACK_META.other;
              return (
                <div key={tk} className="cbs-case-group">
                  <div className="cbs-group-head">
                    <span className="cbs-track-name">{meta.icon} {meta.label}</span>
                    <span className="cbs-group-prog">ผ่าน {doneCount}/{cases.length}</span>
                  </div>
                  {meta.desc && <div className="cbs-track-desc">{meta.desc}</div>}
                  <div className="cbs-case-list">
                    {cases.map(renderCase)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cbs-cert-note">
            🎮 โหมดเกมเป็นของแถมสนุกๆ — ไม่มีผลต่อใบเซอร์และแบบฝึกหลักในเมนู "ฝึกสถานการณ์"
          </div>
          <button type="button" className="cbs-btn-ghost" onClick={() => { setScreen('awards'); window.scrollTo(0, 0); }}>
            🏅 รางวัลของฉัน ({badgeList.filter((b) => b.earned).length}/{badgeList.length})
          </button>
          <button type="button" className="cbs-btn-ghost" onClick={() => navigate('/')}>
            <Home size={15} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            กลับหน้าแรก
          </button>
        </section>
      </div>
    );
  }

  // ============ TITLE ============
  if (screen === 'title') {
    return (
      <div className="cbs-app">
        <section className="cbs-title">
          <div className="cbs-eyebrow">{GAME_EYEBROW} · {LEVEL_META[sc.level]?.label || 'เคส'}</div>
          <h1><span className="cbs-gold-text">{sc.title}</span></h1>
          <p className="cbs-title-sub">
            {sc.subtitle}<br />
            คุณคือ <b>ผู้ช่วยเหลือคนแรก</b> — ทุกคนรอบตัวรอการตัดสินใจของคุณ<br />
            ตัดสินใจผิด ผู้ป่วยแย่ลงจริง เวลาไม่เคยรอใคร
          </p>
          <div className="cbs-diff-group" role="group" aria-label="เลือกระดับความยาก">
            <span className="cbs-diff-label">ระดับความยาก</span>
            <div className="cbs-diff-btns">
              {Object.values(DIFFICULTY).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`cbs-diff-btn ${difficulty === d.id ? 'cbs-diff-on' : ''}`}
                  onClick={() => chooseDifficulty(d.id)}
                  aria-pressed={difficulty === d.id}
                >
                  <span className="cbs-diff-name">{d.label}</span>
                  <span className="cbs-diff-meta">{d.decisionTime}s · ♥{d.hp}</span>
                </button>
              ))}
            </div>
            <div className="cbs-diff-hint">⚡ ตอบถูกเร็ว = ได้โบนัสคะแนน</div>
          </div>
          <div className="cbs-title-row">
            {hiscore > 0 && <div className="cbs-hiscore-chip">HI-SCORE {hiscore}</div>}
            <button
              type="button"
              className="cbs-icon-btn"
              onClick={toggleMute}
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? <VolumeX size={16} strokeWidth={2.4} /> : <Volume2 size={16} strokeWidth={2.4} />}
            </button>
          </div>
          <button type="button" className="cbs-btn-main" onClick={startGame}>
            <AlertTriangle size={18} strokeWidth={2.6} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8 }} />
            รับเคส
          </button>
          <button type="button" className="cbs-btn-ghost" onClick={backToSelect}>
            {pool.length > 1
              ? <>← เลือกเคสอื่น</>
              : <><Home size={15} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />กลับหน้าแรก</>}
          </button>
          <div className="cbs-note">FIRST AID GAME · MORROO</div>
        </section>
      </div>
    );
  }

  // ============ DEBRIEF ============
  if (screen === 'debrief' && result) {
    const st = view;
    const arrest = wasArrest(st);
    // ป้าย/ข้อความผลลัพธ์: เคสหัวใจหยุดเต้น → ฟื้น, เคสอื่น → พ้นวิกฤต
    // scenario ตั้ง sc.outcome:{stamp,win} มา override ได้
    const winStamp = result.won ? (sc.outcome?.stamp || (arrest ? 'ฟื้นแล้ว!' : 'พ้นวิกฤต!')) : 'จบเคส…';
    const winSub = result.won
      ? (sc.outcome?.win || (arrest
        ? 'ผู้ป่วยกลับมาหายใจอีกครั้ง — เคสนี้เป็นของคุณ'
        : 'ผู้ป่วยพ้นภาวะวิกฤต — อ่านสรุปด้านล่างเพื่อฝึกให้แม่นขึ้น'))
      : 'ผู้ป่วยไม่รอด — อ่านสรุปด้านล่าง แล้วกลับมาแก้มือ';
    return (
      <div className="cbs-app">
        <section className={`cbs-debrief ${result.won ? 'cbs-winbg' : 'cbs-losebg'}`}>
          <div className={`cbs-stamp ${result.won ? 'cbs-win' : 'cbs-lose'}`}>
            {winStamp}
          </div>
          <div className="cbs-diff-badge">โหมด {getDifficulty(st.difficulty).label}</div>
          <p className="cbs-verdict-sub">
            {winSub}
            {result.won && result.bonus > 0 && (
              <><br />⚡ โบนัสความไว +{result.bonus} คะแนน (ตอบถูกเร็ว)</>
            )}
            {result.won && comboMultiplier(st) > 1 && (
              <><br />🔥 สตรีคสูงสุด ×{st.maxCombo} — ตัวคูณคะแนน ×{comboMultiplier(st).toFixed(2)}</>
            )}
            {result.isHiscore && <><br />🏆 New Hi-Score: {result.score}</>}
          </p>
          {freshAwards.length > 0 && (
            <div className="cbs-award-reveal">
              <div className="cbs-award-reveal-head">🎖 ปลดล็อกรางวัลใหม่!</div>
              <div className="cbs-award-reveal-row">
                {freshAwards.map((a) => (
                  <div key={a.id} className="cbs-badge cbs-badge-new">
                    <span className="cbs-badge-icon">{a.icon}</span>
                    <span className="cbs-badge-title">{a.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="cbs-grade-row">
            <div className="cbs-grade-box">
              <span className={`cbs-grade cbs-g-${result.grade.toLowerCase()}`}>{result.grade}</span>
              <span className="cbs-grade-label">GRADE</span>
            </div>
            <div className="cbs-metric-grid">
              <Metric label="ตัดสินใจถูก" value={String(correctCount(st))} tone="good" />
              <Metric label="ตัดสินใจพลาด" value={String(st.wrong)}
                tone={st.wrong === 0 ? 'good' : st.wrong <= 2 ? 'warn' : 'badv'} />
              {result.won && st.speedCount > 0 && (
                <Metric label="ความไวเฉลี่ย" value={`${Math.round(result.speed * 100)}%`}
                  tone={result.speed >= FAST_FRACTION ? 'good' : 'warn'} />
              )}
              {result.won && st.maxCombo >= 2 && (
                <Metric label="สตรีคสูงสุด" value={`×${st.maxCombo}`} tone="good" />
              )}
              {/* เมตริกเฉพาะเคสหัวใจหยุดเต้น — โชว์เฉพาะเมื่อเกิดจริง ไม่ขึ้น "—" ในเคสที่ไม่เกี่ยวข้อง */}
              {st.firstCPRAt >= 0 && (
                <Metric label="เริ่มปั๊มหัวใจภายใน" value={fmtTime(st.firstCPRAt)}
                  tone={st.firstCPRAt <= 90 ? 'good' : 'warn'} />
              )}
              {st.firstShockAt >= 0 && (
                <Metric label="ช็อก AED ภายใน" value={fmtTime(st.firstShockAt)}
                  tone={st.firstShockAt <= 300 ? 'good' : 'warn'} />
              )}
              <Metric label="เวลาทั้งเคส" value={fmtTime(st.simTime)} tone="" />
            </div>
          </div>
          {arrest && st.etco2Trace.length > 1 && (
            <div className="cbs-etco2">
              <div className="cbs-tl-title">คุณภาพการปั๊มหัวใจตลอดเคส</div>
              <Etco2Sparkline trace={st.etco2Trace} />
              <div className="cbs-etco2-cap">ยิ่งสูง = ปั๊มต่อเนื่องไม่สะดุด · เส้นพุ่งขึ้นตอนท้าย = ผู้ป่วยฟื้น</div>
            </div>
          )}
          <div className="cbs-tl-title">TIMELINE การตัดสินใจของคุณ</div>
          <div className="cbs-timeline">
            {st.timeline.map((it, i) => (
              <div key={i} className={`cbs-tl-item ${it.ok ? 'cbs-ok' : 'cbs-err'}`}>
                <span className="cbs-tl-time">{fmtTime(it.t)}</span>
                <span className="cbs-tl-dot" />
                <span>
                  {it.text}
                  {it.note && <span className="cbs-tl-note">{it.note}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="cbs-debrief-actions">
            <button type="button" className="cbs-btn-main" onClick={startGame}>
              <RefreshCw size={16} strokeWidth={2.6} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
              เล่นเคสนี้อีกครั้ง
            </button>
            {pool.length > 1 && (
              <button type="button" className="cbs-btn-ghost" onClick={() => { setScreen('select'); window.scrollTo(0, 0); }}>
                ← เลือกเคสอื่น
              </button>
            )}
            <button type="button" className="cbs-btn-ghost" onClick={() => navigate('/')}>
              กลับหน้าแรก
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ============ GAME ============
  const st = view;
  const char = speaker ? getCharacter(speaker.who) : null;
  const plateName = plate?.name || char?.name || ' ';
  const plateColors = plate ? null : char?.plate || null;
  const gameDiff = getDifficulty(st.difficulty);
  const maxHp = st.maxHp || gameDiff.hp;
  const timerPct = Math.max(0, (decisionLeft / gameDiff.decisionTime) * 100);
  const rhythmBad = st.rhythm === 'vf' || st.rhythm === 'flat';
  const rhythmWarn = WARN_RHYTHMS.has(st.rhythm);
  // แผงสถานะผู้ป่วยแบบไม่มีจอ (ก่อนแปะ AED) — คนทั่วไปไม่เห็นคลื่นหัวใจ
  const statusText = st.rosc ? 'ฟื้นแล้ว — หายใจได้เอง'
    : st.cpr ? 'กำลังปั๊มหัวใจ…'
      : st.alarm ? 'หมดสติ · ไม่หายใจ ⚠'
        : 'ประเมินสถานการณ์…';
  const statusTone = st.rosc ? 'cbs-good' : st.cpr ? 'cbs-warn' : st.alarm ? 'cbs-bad' : '';

  return (
    <div className={`cbs-app ${shaking ? 'cbs-shake' : ''}`}>
      <section className="cbs-game">
        <div className={`cbs-stage ${drama === 'red' ? 'cbs-drama-red' : drama === 'white' ? 'cbs-drama' : ''}`}>
          <div className="cbs-hud">
            <div className="cbs-hud-monitor">
              {st.aed ? (
                <>
                  <span className={`cbs-rhythm-name ${rhythmBad ? 'cbs-bad' : rhythmWarn ? 'cbs-warn' : ''}`}>
                    {RHYTHM_NAMES[st.rhythm] || 'AED — กำลังวิเคราะห์'}
                  </span>
                  <EcgStrip rhythm={st.rhythm} cpr={st.cpr} />
                </>
              ) : (
                <>
                  <span className="cbs-rhythm-name">สถานะผู้ป่วย</span>
                  <span className={`cbs-status-line ${statusTone}`}>{statusText}</span>
                </>
              )}
            </div>
            <div className="cbs-hud-right">
              <div className="cbs-gauge">
                <span className="cbs-gauge-label">PATIENT</span>
                <div className="cbs-gauge-cells">
                  {Array.from({ length: maxHp }).map((_, i) => (
                    <span
                      key={i}
                      className={`cbs-cell ${i >= st.hp ? 'cbs-off' : (st.hp === 1 && i === 0 ? 'cbs-last' : '')}`}
                    />
                  ))}
                </div>
              </div>
              <div className="cbs-timechip">{fmtTime(st.simTime)}</div>
            </div>
          </div>

          {/* คอมโบสด — ยิ่งสตรีคยาว ป้ายยิ่งใหญ่/ร้อน (juice), รีปั๊มทุกครั้งที่เพิ่ม */}
          {st.combo >= 2 && (
            <div className={`cbs-combo cbs-combo-t${Math.min(st.combo, 6)}`} key={`combo-${st.combo}`}>
              <span className="cbs-combo-label">COMBO</span>
              <span className="cbs-combo-n">×{st.combo}</span>
            </div>
          )}
          {comboBreak && (
            <div className="cbs-combo-break" key={`brk-${comboBreak.k}`}>
              COMBO ×{comboBreak.n} BREAK!
            </div>
          )}

          {/* ปุ่มเมนูระหว่างเล่น — ซ่อนตอนกำลังเลือก (choices overlay) กันกดพลาด */}
          {!choice && (
            <button
              type="button"
              className="cbs-menu-btn"
              onClick={() => setQuitMenu(true)}
              aria-label="เมนู"
            >
              ☰
            </button>
          )}

          {speaker && (
            <div className={`cbs-sprite ${reducedMotion ? '' : 'cbs-pop'}`} key={`sp-${speaker.popN}`}>
              <CharacterSprite charId={speaker.who} pose={speaker.pose} talking={typing} />
            </div>
          )}

          {choice && (
            <div className="cbs-choices">
              <div className="cbs-qbanner">⚖ {choice.q}</div>
              {choice.hintTgt && (
                <div className="cbs-hint">💡 ลองเลือกแนว <b>{choice.hintTgt}</b> ดูสิ</div>
              )}
              {choice.options.map((o, i) => {
                const dim = choice.hintTgt && o.tgt !== choice.hintTgt;
                const glow = choice.hintTgt && o.tgt === choice.hintTgt;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`cbs-choice ${dim ? 'cbs-choice-dim' : ''} ${glow ? 'cbs-choice-hint' : ''}`}
                    onClick={() => pick(o)}
                  >
                    <span className="cbs-choice-tgt">▸ {o.tgt}</span>
                    {o.label}
                  </button>
                );
              })}
              <div className="cbs-choice-timer">
                <div
                  className={`cbs-choice-timer-fill ${timerPct < 30 ? 'cbs-low' : ''}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="cbs-dlg-area">
          {/* กล่องบทพูดแบบ AA: แตะเพื่อข้าม/ไปต่อ */}
          <div
            className="cbs-dlg"
            onClick={onDialogTap}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDialogTap(); }
            }}
          >
            <div
              className="cbs-nameplate"
              style={plateColors ? { background: `linear-gradient(180deg, ${plateColors[0]}, ${plateColors[1]})` } : undefined}
            >
              {plateName}
            </div>
            {/* บทพูดมาจาก scenario data ในโค้ดเรา (จำกัด <span class="cbs-em"> เท่านั้น) */}
            <div className="cbs-dlg-text" dangerouslySetInnerHTML={{ __html: dlgHtml }} />
            {!typing && awaitTap && <div className="cbs-adv">▼</div>}
          </div>
        </div>
      </section>

      {quitMenu && (
        <div className="cbs-quit" role="dialog" aria-label="เมนูระหว่างเล่น">
          <div className="cbs-quit-card">
            <div className="cbs-quit-title">หยุดพักเคสนี้</div>
            <button type="button" className="cbs-btn-main cbs-quit-resume" onClick={() => setQuitMenu(false)}>
              เล่นต่อ
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={startGame}>
              <RefreshCw size={15} strokeWidth={2.4} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
              เริ่มเคสนี้ใหม่
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={backToSelect}>
              {pool.length > 1 ? 'ออกไปเลือกเคสอื่น' : 'ออกไปหน้าแรก'}
            </button>
            <div className="cbs-quit-note">ออกกลางเคส = เคสนี้ไม่ถูกบันทึกผล</div>
          </div>
        </div>
      )}

      {inter && (
        <div className="cbs-inter">
          <div className="cbs-inter-burst" />
          <div className={`cbs-inter-bubble ${inter.green ? 'cbs-green-bubble' : ''}`}>
            <span className="cbs-inter-text">{inter.text}</span>
          </div>
        </div>
      )}
      {flashN > 0 && <div key={`fl-${flashN}`} className="cbs-flash cbs-go" />}
      {redN > 0 && <div key={`rf-${redN}`} className="cbs-redflash cbs-go" />}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="cbs-metric">
      <span className="cbs-metric-label">{label}</span>
      <span className={`cbs-metric-val ${tone ? `cbs-${tone}` : ''}`}>{value}</span>
    </div>
  );
}

// กราฟคุณภาพ CPR แบบ area sparkline — เน้นจุดปลาย (ฟื้น) และเส้นเป้า
function Etco2Sparkline({ trace }) {
  const W = 300;
  const H = 60;
  const maxV = 45;
  const tMax = trace[trace.length - 1].t || 1;
  const x = (t) => (t / tMax) * W;
  const y = (v) => H - (Math.min(v, maxV) / maxV) * (H - 6) - 3;
  const pts = trace.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const last = trace[trace.length - 1];
  const targetY = y(35);
  return (
    <svg className="cbs-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="กราฟคุณภาพการปั๊มหัวใจ">
      <line x1="0" y1={targetY} x2={W} y2={targetY} className="cbs-spark-target" strokeDasharray="4 4" />
      <path d={area} className="cbs-spark-area" />
      <path d={line} className="cbs-spark-line" />
      <circle cx={x(last.t)} cy={y(last.v)} r="3.5" className="cbs-spark-dot" />
    </svg>
  );
}
