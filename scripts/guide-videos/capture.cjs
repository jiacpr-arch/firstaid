// Captures real firstaid screens (dev server, mocked APIs) for the CPR guide videos.
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5179';
const LEARNER = '123e4567-e89b-42d3-a456-426614174ddd';

const YT_STUB = `window.YT={Player:function(el,opts){var host=typeof el==='string'?document.getElementById(el):el;
var d=document.createElement('div');d.style.cssText='width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,#7f1d1d,#b91c1c);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:600 15px sans-serif;border-radius:12px';
d.innerHTML='<div style="font-size:44px;line-height:1">▶</div><div style="margin-top:6px">วิดีโอบทเรียน CPR</div>';host.replaceWith(d);
this.mute=function(){};this.unMute=function(){};this.playVideo=function(){};this.destroy=function(){};this.getCurrentTime=function(){return 0};this.getDuration=function(){return 60};this.getPlayerState=function(){return -1};this.isMuted=function(){return false};}};
setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},0);`;

async function setup(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, locale: 'th-TH' });
  const p = await ctx.newPage();
  const st = { issued: !!o.certIssued, saved: false };
  await p.route('**/www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: YT_STUB }));
  await p.route('**/www.youtube.com/**', (r) => r.abort());
  await p.route('**/api/entitlements**', (r) => r.fulfill({ json: { chapters: o.chapters || [] } }));
  await p.route('**/api/cohorts/my-cpr', (r) => r.fulfill({ json: o.inClass
    ? { includesCpr: true, cprPromoCode: 'JIA-FA-K7Q2PX', startsOn: '2026-11-21', cpr: { redeemed: true, modulesDone: Object.keys(o.scores || {}).length, finalScore: null, completed: !!o.complete, scores: o.scores || {} } }
    : { includesCpr: false } }));
  await p.route('**/api/cpr/progress', (r) => r.fulfill({ json: { access: 'paid', scores: o.scores || {}, completed: !!o.complete } }));
  await p.route('**/api/cpr/grade', (r) => {
    const b = JSON.parse(r.request().postData());
    const pass = o.gradePass !== false;
    const total = b.questions.length;
    const correct = pass ? total : Math.floor(total * 0.4);
    r.fulfill({ json: { score: Math.round(correct / total * 100), correct, total, passed: pass, saved: true, ...(total === 5 ? { corrects: b.answers } : {}) } });
  });
  await p.route('**/api/vouchers/list', (r) => r.fulfill({ json: { vouchers: o.vouchers || [] } }));
  await p.route('**/api/vouchers/create', (r) => r.fulfill({ json: { vouchers: [] } }));
  await p.route('**/example.supabase.co/**', (r) => {
    const u = r.request().url(); const body = r.request().postData() || '{}';
    if (u.includes('/auth/v1/user')) return r.fulfill({ json: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@jia.test' } });
    if (u.includes('rpc/jia_person_certificates')) {
      const j = JSON.parse(body);
      if (j.action === 'claim') { if (!st.saved && !o.certNameOk) return r.fulfill({ status: 400, json: { message: 'บัตรนักเรียน JIA ยังไม่มีชื่อ' } }); st.issued = true; return r.fulfill({ json: {} }); }
      return r.fulfill({ json: st.issued
        ? { certificates: [{ courseId: 'cpr', status: 'issued', number: 'CPR-2611-0042', verifyPath: '/verify/x', expiresAt: '2028-11-21' , name: 'สมหญิง ใจดี', kind: 'online' }], claimable: [] }
        : { certificates: [], claimable: o.claimable ? [{ courseId: 'cpr' }] : [] } });
    }
    if (u.includes('rpc/jia_identity')) { const j = JSON.parse(body); if (j.action === 'saveProfile') { st.saved = true; return r.fulfill({ json: {} }); } return r.fulfill({ json: { nameTh: '', phone: '', nameLocked: false } }); }
    return r.fulfill({ json: {} });
  });
  await p.goto(BASE + '/');
  await p.evaluate(async ({ o, LEARNER }) => {
    localStorage.clear();
    const learner = { id: LEARNER, name: 'สมหญิง ใจดี', phone: '0812345678', lineSkippedAt: Date.now(), onboardedAt: Date.now(), realNameAt: Date.now() };
    if (o.inClass) Object.assign(learner, { cohortCode: 'K7Q2PX', cohortName: 'CPR + ปฐมพยาบาล บ.ตัวอย่าง 21 พ.ย.', cprPromoCode: 'JIA-FA-K7Q2PX' });
    localStorage.setItem('firstaid.learner', JSON.stringify({ state: { learner }, version: 0 }));
    localStorage.setItem('firstaid.settings', JSON.stringify({ state: { houseAdDismissedAt: Date.now() }, version: 0 }));
    if (o.session) localStorage.setItem('sb-example-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@jia.test' } }));
    const db = await import('/src/db/database.js');
    if (o.postDone) {
      await db.saveExamAttempt({ learnerId: LEARNER, kind: 'pre', score: 60, passed: true });
      await db.saveExamAttempt({ learnerId: LEARNER, kind: 'post', score: 90, passed: true });
    }
  }, { o, LEARNER });
  return { p, ctx };
}

async function shot(p, name, { scrollTo, fullTop } = {}) {
  await p.waitForTimeout(400);
  if (scrollTo) await p.locator(scrollTo).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  if (fullTop) await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
}

async function answerAll(p) {
  const cards = p.locator('.card:has(.text-headline)');
  const n = await cards.count();
  for (let i = 0; i < n; i++) await cards.nth(i).locator('button').first().click();
}

(async () => {
  const b = await chromium.launch();
  const all1to6 = { 1: 100, 2: 100, 3: 80, 4: 100, 5: 100, 6: 80 };
  let s;

  // ===== student: public learner, locked =====
  s = await setup(b, { session: true });
  await s.p.goto(BASE + '/learn'); await s.p.waitForTimeout(2500);
  await shot(s.p, 's01_learn_ch5', { scrollTo: '[data-testid=cpr-chapter]' });
  await s.p.goto(BASE + '/cpr'); await s.p.waitForTimeout(2000);
  await shot(s.p, 's02_cpr_locked', { fullTop: true });
  await s.p.locator('text=หมวดนี้ต้องปลดล็อกก่อน').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await s.p.waitForTimeout(300);
  await s.p.screenshot({ path: path.join(OUT, 's03_unlock_card.png') }); console.log('shot s03');
  await s.ctx.close();

  // ===== student: class learner, post-test done =====
  s = await setup(b, { inClass: true, postDone: true, session: true });
  await s.p.goto(BASE + '/'); await s.p.waitForTimeout(3000);
  await shot(s.p, 's04_class_home', { fullTop: true });
  await s.ctx.close();

  // ===== paid learner: overview + module + quiz =====
  s = await setup(b, { chapters: [5], session: true, scores: {} });
  await s.p.goto(BASE + '/cpr'); await s.p.waitForTimeout(2500);
  await shot(s.p, 's05_overview', { fullTop: true });
  await s.p.goto(BASE + '/cpr/1'); await s.p.waitForTimeout(2000);
  await shot(s.p, 's06_module_video', { fullTop: true });
  await s.ctx.close();

  s = await setup(b, { chapters: [5], session: true, scores: { 1: 100 } });
  await s.p.goto(BASE + '/cpr/1'); await s.p.waitForTimeout(2000);
  await s.p.locator('[data-testid=cpr-quiz-start]').click(); await s.p.waitForTimeout(400);
  await answerAll(s.p);
  await shot(s.p, 's07_quiz', { fullTop: true });
  await s.p.locator('[data-testid=cpr-quiz-submit]').scrollIntoViewIfNeeded();
  await shot(s.p, 's08_quiz_submit');
  await s.p.locator('[data-testid=cpr-quiz-submit]').click(); await s.p.waitForTimeout(800);
  await shot(s.p, 's09_pass', { fullTop: true });
  await s.ctx.close();

  s = await setup(b, { chapters: [5], session: true, scores: { 1: 100, 2: 100 }, gradePass: false });
  await s.p.goto(BASE + '/cpr/2'); await s.p.waitForTimeout(2000);
  await s.p.locator('[data-testid=cpr-quiz-start]').click(); await s.p.waitForTimeout(400);
  await answerAll(s.p);
  await s.p.locator('[data-testid=cpr-quiz-submit]').click(); await s.p.waitForTimeout(800);
  await shot(s.p, 's10_fail', { fullTop: true });
  await s.ctx.close();

  // final exam (all 6 passed)
  s = await setup(b, { chapters: [5], session: true, scores: all1to6 });
  await s.p.goto(BASE + '/cpr'); await s.p.waitForTimeout(2500);
  await shot(s.p, 's11_ready_final', { fullTop: true });
  await s.p.goto(BASE + '/cpr/7'); await s.p.waitForTimeout(2000);
  await shot(s.p, 's12_final_start', { fullTop: true });
  await s.ctx.close();

  s = await setup(b, { chapters: [5], session: false, scores: all1to6 });
  await s.p.goto(BASE + '/cpr/7'); await s.p.waitForTimeout(2000);
  await shot(s.p, 's13_final_login', { fullTop: true });
  await s.ctx.close();

  // certificate: claim form then issued
  s = await setup(b, { chapters: [5], session: true, scores: { ...all1to6, 7: 90 }, complete: true, claimable: true });
  await s.p.goto(BASE + '/cpr'); await s.p.waitForTimeout(3000);
  await shot(s.p, 's14_cert_claim', { scrollTo: '[data-testid=cpr-cert-claim]' });
  await s.p.locator('[data-testid=cpr-cert-claim] button').click(); await s.p.waitForTimeout(1500);
  await shot(s.p, 's15_cert_issued', { scrollTo: '[data-testid=hub-certificate]' });
  await s.ctx.close();

  s = await setup(b, {});
  await s.p.goto(BASE + '/cpr/guide'); await s.p.waitForTimeout(2000);
  await shot(s.p, 's16_guide', { fullTop: true });
  await s.ctx.close();

  // ===== admin =====
  const vouchers = [
    { code: 'CPR-8KD2QW', chapter: 5, price_thb: 99, valid_days: 365, max_uses: 1, use_count: 0, status: 'active', created_at: new Date().toISOString() },
    { code: 'ALL-4TZ9MX', chapter: 0, price_thb: 249, valid_days: 365, max_uses: 1, use_count: 1, status: 'redeemed', created_at: new Date(Date.now() - 86400000).toISOString() },
  ];
  s = await setup(b, { session: true, vouchers });
  await s.p.goto(BASE + '/admin'); await s.p.waitForTimeout(2500);
  await shot(s.p, 'a01_dashboard', { fullTop: true });
  await s.p.goto(BASE + '/admin/vouchers'); await s.p.waitForTimeout(2500);
  const sel = s.p.locator('select').first();
  const opts = await sel.locator('option').allTextContents();
  const cprOpt = opts.find((t) => t.includes('CPR'));
  if (cprOpt) await sel.selectOption({ label: cprOpt });
  await shot(s.p, 'a02_vouchers_form', { fullTop: true });
  await s.p.locator('text=CPR-8KD2QW').first().evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
  await shot(s.p, 'a03_vouchers_list');
  await s.p.goto(BASE + '/admin/guide#cpr-chapter'); await s.p.waitForTimeout(2500);
  await shot(s.p, 'a04_guide_section', { scrollTo: '#cpr-chapter' });
  await s.p.locator('text=ข้อความส่งลูกค้า — หมวด CPR').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(s.p, 'a05_guide_message');
  await s.p.goto(BASE + '/admin/guide#cpr-class'); await s.p.waitForTimeout(2000);
  await shot(s.p, 'a06_guide_class', { scrollTo: '#cpr-class' });
  await s.ctx.close();

  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
