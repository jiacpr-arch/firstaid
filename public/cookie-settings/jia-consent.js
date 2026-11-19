/*!
 * jia-consent.js — ปุ่มจัดการคุกกี้ (PDPA) แบบลอย + Google Consent Mode v2 + Meta Pixel
 * วางใน <head> "ก่อน" สคริปต์ gtag / fbq:
 *   <script src="/jia-consent.js"> (แท็ก script ปกติ)
 * Next.js (app router):  <Script src="/jia-consent.js" strategy="beforeInteractive" />
 * ตั้งค่าได้ผ่าน window.JIA_CONSENT = { policyUrl:'/privacy', color:'#2f80ed', position:'left' } ก่อนโหลดไฟล์
 */
(function () {
  'use strict';
  var CFG = Object.assign({
    policyUrl: '/privacy',
    color: '#2f80ed',
    onColor: '#fff',           // สีตัวอักษร/ไอคอนบนสีหลัก (สีอ่อนให้ใช้สีเข้ม)
    position: 'left',          // 'left' | 'right'
    version: 1,                // เพิ่มเลขเมื่อเปลี่ยนนโยบาย → ถามใหม่
    fab: true,
    bannerBottom: 12,
    fabBottom: 0,              // ระยะปุ่มลอยจากขอบล่าง (px) โหมด compact — 0 = ค่าเริ่มต้น 14 (เผื่อหลบแถบเมนูล่าง)          // ระยะแถบจากขอบล่าง (px) เผื่อหลบปุ่มติดต่อของเว็บ                 // false = ไม่แสดงปุ่มลอยของตัวเอง (ไปใส่ในเมนูติดต่อของเว็บแทน: JiaConsent.open())
    compact: false,            // true = แถบแรกเข้าเป็นแถบเล็กบรรทัดเดียว + ปุ่มลอยขนาดเล็ก
    compactText: 'ใช้คุกกี้เพื่อพัฒนาเว็บ',
    simple: false,             // true = เหลือสวิตช์เดียว 'วัดผลและโฆษณา' (รวมทุกอย่างที่ไม่จำเป็น)
    bannerTitle: 'เว็บไซต์นี้ใช้คุกกี้ 🍪',
    bannerText: 'เราใช้คุกกี้เพื่อให้เว็บทำงานได้ วัดผลการใช้งาน และแสดงโฆษณาที่เกี่ยวข้อง คุณเลือกได้ว่าจะยินยอมแบบไหน',
    extra: [],                 // หมวดเพิ่มเติม เช่น [{id:'openai', title:'...', desc:'...'}]
    onChange: null,            // function(consent) เรียกทุกครั้งที่เปลี่ยน (ใช้โหลด/ปิด pixel อื่น ๆ)
    storageKey: 'jia_consent',
    historyKey: 'jia_consent_history'
  }, window.JIA_CONSENT || {});

  // ---------- Google Consent Mode v2: default = denied (ต้องรันก่อน gtag config) ----------
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (!window.gtag) window.gtag = gtag;
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted',
    wait_for_update: 500
  });

  // ---------- storage ----------
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // เก็บซ้ำในคุกกี้ระดับโดเมนหลัก เช่น .morroo.com → กดครั้งเดียวใช้ได้ทุก subdomain
  function rootDomain() { var p = location.hostname.split('.'); return p.length > 2 ? p.slice(-2).join('.') : location.hostname; }
  function readCookie() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + CFG.storageKey + '=([^;]*)'));
    try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; }
  }
  function writeCookie(c) {
    var v = c ? encodeURIComponent(JSON.stringify(c)) : '';
    document.cookie = CFG.storageKey + '=' + v + '; path=/; domain=.' + rootDomain() + '; SameSite=Lax; ' +
      (location.protocol === 'https:' ? 'Secure; ' : '') + 'Max-Age=' + (c ? 31536000 : 0);
  }
  function getConsent() {
    var c = readCookie() || load(CFG.storageKey, null);
    return c && c.v === CFG.version ? c : null;
  }

  function apply(c) {
    var a = c && c.analytics ? 'granted' : 'denied';
    var m = c && c.marketing ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m
    });
    if (window.fbq) window.fbq('consent', m === 'granted' ? 'grant' : 'revoke');
    if (window.ttq && window.ttq.grantConsent) { if (m === 'granted') window.ttq.grantConsent(); else window.ttq.revokeConsent(); }
    if (typeof window.clarity === 'function') window.clarity('consentv2', { ad_Storage: m, analytics_Storage: a });
    if (typeof CFG.onChange === 'function') { try { CFG.onChange(c); } catch (e) {} }
    window.dispatchEvent(new CustomEvent('jia-consent', { detail: c }));
  }
  // ถ้าเคยเลือกไว้แล้ว ส่งค่าให้ Google ทันที (ก่อน gtag config)
  (function () { var c0 = getConsent(); if (c0) { var a0 = c0.analytics ? 'granted' : 'denied', m0 = c0.marketing ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: a0, ad_storage: m0, ad_user_data: m0, ad_personalization: m0 }); } })();
  // fbq ที่โหลดทีหลังจะอ่านค่านี้ได้: if (window.jiaConsent?.marketing) fbq('consent','grant')
  window.jiaConsent = getConsent();

  function setConsent(analytics, marketing, action, extra) {
    var c = { v: CFG.version, necessary: true, analytics: !!analytics, marketing: !!marketing, ts: new Date().toISOString() };
    CFG.extra.forEach(function (x) { c[x.id] = extra ? !!extra[x.id] : !!marketing; });
    save(CFG.storageKey, c);
    writeCookie(c);
    var h = load(CFG.historyKey, []);
    var rec = { ts: c.ts, action: action, analytics: c.analytics, marketing: c.marketing };
    CFG.extra.forEach(function (x) { rec[x.id] = c[x.id]; });
    h.unshift(rec);
    save(CFG.historyKey, h.slice(0, 30));
    window.jiaConsent = c;
    if (!c.analytics || !c.marketing) clearCookies(c);
    apply(c);
  }

  function clearCookies(c) {
    var del = [];
    if (!c || !c.analytics) del.push(/^_ga/, /^_gid$/, /^_gat/, /^ph_/, /^_clck$/, /^_clsk$/);
    if (!c || !c.marketing) del.push(/^_fbp$/, /^_fbc$/, /^_gcl/, /^IDE$/, /^_ttp$/, /^_tt_/, /^ttcsid/, /^ttclid$/, /^__oaiq/);
    var host = location.hostname, root = '.' + host.split('.').slice(-2).join('.');
    document.cookie.split(';').forEach(function (s) {
      var n = s.split('=')[0].trim();
      if (del.some(function (r) { return r.test(n); })) {
        [host, root, ''].forEach(function (d) {
          document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
        });
      }
    });
  }

  function revoke() {
    try { localStorage.removeItem(CFG.storageKey); } catch (e) {}
    writeCookie(null);
    var h = load(CFG.historyKey, []);
    h.unshift({ ts: new Date().toISOString(), action: 'ถอนความยินยอม', analytics: false, marketing: false });
    save(CFG.historyKey, h.slice(0, 30));
    window.jiaConsent = null;
    clearCookies(null);
    apply(null);
    showBanner();
  }

  // ---------- UI ----------
  var css = '\
#jc-root{--jc:' + CFG.color + ';--jc-on:' + CFG.onColor + ';font-family:"Sarabun","Noto Sans Thai",system-ui,sans-serif;font-size:15px;color:#1f2937}\
#jc-root *{box-sizing:border-box}\
.jc-fab{position:fixed;bottom:20px;' + CFG.position + ':20px;width:56px;height:56px;border-radius:50%;border:0;background:var(--jc);color:var(--jc-on);box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .2s,background .2s}\
.jc-fab:active{transform:scale(.94)}\
.jc-fab.open{background:#fff;color:#111}\
.jc-menu{position:fixed;bottom:88px;' + CFG.position + ':20px;display:flex;flex-direction:column;gap:10px;align-items:' + (CFG.position === 'left' ? 'flex-start' : 'flex-end') + ';z-index:2147483000;pointer-events:none}\
.jc-menu button{pointer-events:auto;background:#fff;border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:600;box-shadow:0 3px 12px rgba(0,0,0,.18);cursor:pointer;opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s}\
.jc-menu.show button{opacity:1;transform:none}\
.jc-menu.show button:nth-child(2){transition-delay:.04s}.jc-menu.show button:nth-child(1){transition-delay:.08s}\
.jc-banner{position:fixed;left:12px;right:12px;bottom:' + CFG.bannerBottom + 'px;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.22);z-index:2147483001}\
.jc-banner h3,.jc-modal h3{margin:0 0 6px;font-size:17px}\
.jc-banner p{margin:0 0 14px;line-height:1.5;color:#4b5563}\
.jc-banner a{color:inherit;text-decoration:underline}\
.jc-row{display:flex;gap:8px;flex-wrap:wrap}\
.jc-btn{flex:1;min-width:110px;padding:11px 14px;border-radius:10px;border:1px solid #d1d5db;background:#fff;font:inherit;font-weight:600;cursor:pointer}\
.jc-btn.pri{background:var(--jc);border-color:var(--jc);color:var(--jc-on)}\
.jc-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483002;display:flex;align-items:flex-end;justify-content:center}\
.jc-modal{background:#fff;width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:18px 18px 0 0;padding:20px}\
@media(min-width:640px){.jc-ov{align-items:center}.jc-modal{border-radius:18px}}\
.jc-cat{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #eee}\
.jc-cat small{display:block;color:#6b7280;margin-top:3px;line-height:1.4}\
.jc-sw{position:relative;width:46px;height:26px;flex:none}\
.jc-sw input{opacity:0;width:0;height:0}\
.jc-sw span{position:absolute;inset:0;background:#d1d5db;border-radius:26px;transition:.2s;cursor:pointer}\
.jc-sw span:before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}\
.jc-sw input:checked+span{background:var(--jc)}\
.jc-sw input:checked+span:before{transform:translateX(20px)}\
.jc-sw input:disabled+span{opacity:.55;cursor:not-allowed}\
.jc-h{padding:10px 0;border-bottom:1px solid #eee;line-height:1.5}\
.jc-h b{display:block}.jc-h small{color:#6b7280}\
.jc-links{display:flex;justify-content:center;gap:6px;margin-top:12px;color:#9ca3af;font-size:13px}\
.jc-links button,.jc-links a{background:none;border:0;font:inherit;color:#6b7280;text-decoration:underline;cursor:pointer;padding:2px}' + (CFG.compact ? '\
.jc-fab{width:40px;height:40px;bottom:' + (CFG.fabBottom || 14) + 'px;' + CFG.position + ':14px;opacity:.85}.jc-fab svg{width:20px;height:20px}\
.jc-menu{bottom:' + ((CFG.fabBottom || 14) + 50) + 'px;' + CFG.position + ':14px}.jc-menu button{padding:9px 14px;font-size:14px}\
.jc-banner.sm{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-radius:999px;max-width:420px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.2)}\
.jc-banner.sm span{flex:1;line-height:1.3}.jc-banner.sm a{color:inherit;text-decoration:underline}\
.jc-banner.sm button{border:0;background:none;font:inherit;font-weight:600;color:#6b7280;padding:7px 8px;cursor:pointer;white-space:nowrap}\
.jc-banner.sm button.pri{background:var(--jc);color:var(--jc-on);border-radius:999px;padding:7px 14px}' : '');

  var FP = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 11c0 3.5-.5 6.5-1.8 9"/><path d="M8.5 4.8A7 7 0 0 1 19 11c0 1.6-.1 3.2-.4 4.7"/><path d="M5 8.5A7 7 0 0 0 5 14"/><path d="M15.4 11c0 2.8-.3 5.4-1.1 7.8"/><path d="M8.6 11a3.4 3.4 0 0 1 6.8 0"/><path d="M8.6 11c0 2-.3 4-.9 5.8"/><path d="M17.5 19.5c.3-.9.6-1.9.8-2.9"/></svg>';
  var X = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var root, fab, menu, banner;
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function fmt(ts) { try { return new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ts; } }

  function toggleMenu(force) {
    var open = typeof force === 'boolean' ? force : !menu.classList.contains('show');
    menu.classList.toggle('show', open);
    fab.classList.toggle('open', open);
    fab.innerHTML = open ? X : FP;
    fab.setAttribute('aria-expanded', open);
  }

  function showBanner() {
    if (banner) return;
    fab.style.display = 'none';
    if (CFG.compact) {
      banner = el('<div class="jc-banner sm" role="dialog" aria-label="การใช้คุกกี้"><span>🍪 ' + CFG.compactText + ' <a href="' + CFG.policyUrl + '">อ่านเพิ่ม</a></span><button data-a="deny">ไม่</button><button class="pri" data-a="all">ยอมรับ</button></div>');
    } else banner = el('<div class="jc-banner" role="dialog" aria-label="การใช้คุกกี้">\
<h3>' + CFG.bannerTitle + '</h3>\
<p>' + CFG.bannerText + ' <a href="' + CFG.policyUrl + '">นโยบายความเป็นส่วนตัว</a></p>\
' + (CFG.simple
  ? '<div class="jc-row"><button class="jc-btn" data-a="deny">ไม่ยอมรับ</button><button class="jc-btn pri" data-a="all">ยอมรับ</button></div>'
  : '<div class="jc-row"><button class="jc-btn" data-a="set">ตั้งค่า</button><button class="jc-btn" data-a="deny">ปฏิเสธ</button><button class="jc-btn pri" data-a="all">ยอมรับทั้งหมด</button></div>') + '</div>');
    banner.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'set') return openSettings();
      setConsent(a === 'all', a === 'all', a === 'all' ? 'ยอมรับทั้งหมด' : 'ปฏิเสธทั้งหมด');
      hideBanner();
    });
    root.appendChild(banner);
  }
  function hideBanner() { if (banner) { banner.remove(); banner = null; } if (CFG.fab) fab.style.display = ''; }

  function modal(inner) {
    var ov = el('<div class="jc-ov"><div class="jc-modal" role="dialog">' + inner + '</div></div>');
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.getAttribute('data-close') !== null) ov.remove(); });
    root.appendChild(ov); return ov;
  }

  var LINKS = '<div class="jc-links"><button data-l="hist">ดูประวัติ</button>·<button data-l="revoke">ถอนความยินยอม</button>·<a href="' + CFG.policyUrl + '">นโยบาย</a></div>';
  function bindLinks(ov) {
    ov.addEventListener('click', function (e) {
      var l = e.target.getAttribute('data-l'); if (!l) return;
      ov.remove(); if (l === 'hist') openHistory(); else revoke();
    });
  }
  function openSettings() {
    toggleMenu(false);
    var c = getConsent() || { analytics: false, marketing: false };
    function cat(id, t, d, on, dis) {
      return '<div class="jc-cat"><div><b>' + t + '</b><small>' + d + '</small></div><label class="jc-sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span></span></label></div>';
    }
    if (CFG.simple) {
      var sv = modal('<h3>ตั้งค่าความเป็นส่วนตัว</h3>' +
        cat('jc-n', 'คุกกี้ที่จำเป็น', 'ให้เว็บทำงานได้ เช่น เข้าสู่ระบบ ปิดไม่ได้', true, true) +
        cat('jc-all', 'วัดผลและปรับปรุงเว็บ', 'ช่วยให้เรารู้ว่าเนื้อหาไหนมีประโยชน์ และวัดผลโฆษณา (Google, Meta, TikTok, ChatGPT)', c.analytics || c.marketing) +
        '<div class="jc-row" style="margin-top:16px"><button class="jc-btn pri" data-a="save">บันทึก</button></div>' + LINKS);
      bindLinks(sv);
      sv.addEventListener('click', function (e) {
        if (e.target.getAttribute('data-a') !== 'save') return;
        var on = sv.querySelector('#jc-all').checked;
        setConsent(on, on, on ? 'ยินยอม' : 'ไม่ยินยอม');
        sv.remove(); hideBanner();
      });
      return;
    }
    var ov = modal('<h3>ตั้งค่าความเป็นส่วนตัว</h3>' +
      cat('jc-n', 'คุกกี้ที่จำเป็น', 'ทำให้เว็บไซต์ทำงานได้ เช่น ตะกร้าสินค้า การเข้าสู่ระบบ ปิดไม่ได้', true, true) +
      cat('jc-a', 'คุกกี้เพื่อการวิเคราะห์', 'Google Analytics ช่วยให้เราเข้าใจการใช้งานเว็บ', c.analytics) +
      cat('jc-m', 'คุกกี้เพื่อการตลาด', 'Google Ads, Meta Pixel ใช้วัดผลและแสดงโฆษณาที่เกี่ยวข้อง', c.marketing) +
      CFG.extra.map(function (x) { return cat('jc-x-' + x.id, x.title, x.desc || '', c[x.id]); }).join('') +
      '<div class="jc-row" style="margin-top:16px"><button class="jc-btn" data-a="deny">ปฏิเสธทั้งหมด</button><button class="jc-btn pri" data-a="save">บันทึก</button></div>' + LINKS);
    bindLinks(ov);
    ov.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'deny') setConsent(false, false, 'ปฏิเสธทั้งหมด');
      else {
        var ex = {};
        CFG.extra.forEach(function (x) { ex[x.id] = ov.querySelector('#jc-x-' + x.id).checked; });
        setConsent(ov.querySelector('#jc-a').checked, ov.querySelector('#jc-m').checked, 'บันทึกการตั้งค่า', ex);
      }
      ov.remove(); hideBanner();
    });
  }

  function openHistory() {
    toggleMenu(false);
    var h = load(CFG.historyKey, []);
    var yn = function (b) { return b ? '✅' : '❌'; };
    var list = h.length ? h.map(function (x) {
      return '<div class="jc-h"><b>' + x.action + '</b><small>' + fmt(x.ts) + ' · วิเคราะห์ ' + yn(x.analytics) + ' · การตลาด ' + yn(x.marketing) + CFG.extra.map(function (e) { return ' · ' + (e.short || e.title) + ' ' + yn(x[e.id]); }).join('') + '</small></div>';
    }).join('') : '<p style="color:#6b7280">ยังไม่มีประวัติ</p>';
    modal('<h3>ประวัติการตั้งค่าความเป็นส่วนตัว</h3>' + list + '<div class="jc-row" style="margin-top:16px"><button class="jc-btn" data-close>ปิด</button></div>');
  }

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'jc-root'; document.body.appendChild(root);
    menu = el('<div class="jc-menu"><button data-m="hist">ประวัติการตั้งค่า</button><button data-m="revoke">ถอนความยินยอม</button><button data-m="set">เปลี่ยนการตั้งค่า</button></div>');
    fab = el('<button class="jc-fab" aria-label="ตั้งค่าคุกกี้" aria-expanded="false">' + FP + '</button>');
    fab.addEventListener('click', function () { toggleMenu(); });
    menu.addEventListener('click', function (e) {
      var m = e.target.getAttribute('data-m');
      if (m === 'hist') openHistory();
      else if (m === 'revoke') { toggleMenu(false); revoke(); }
      else if (m === 'set') openSettings();
    });
    root.appendChild(menu); root.appendChild(fab);
    if (!CFG.fab) { fab.style.setProperty('display', 'none', 'important'); menu.style.display = 'none'; }
    var c = getConsent();
    if (c) { if (!c.analytics || !c.marketing) clearCookies(c); apply(c); } else showBanner();
  }

  window.JiaConsent = { open: openSettings, revoke: revoke, history: openHistory, get: getConsent };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
