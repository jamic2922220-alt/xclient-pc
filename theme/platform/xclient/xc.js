/* X CLIENT — o'yin ichidagi bosh menyu logikasi. Faqat ES5 (CEF1 / Chrome 17).
 * O'yin:   nextclient.exec / getCvarValue / matchmaking / console / gameUi / connect hodisalari
 * Akkaunt: xc_api.php (shu papkada) — login, profil, bulut, do'stlar, TOP hafta, turnirlar */
(function () {
'use strict';

/* ============================================================ Promise (CEF1 da yo'q) */
if (typeof window.Promise !== 'function') {
  var P = function (fn) {
    var self = this; self._s = 0; self._v = undefined; self._cb = [];
    function settle(st, v) {
      if (self._s) return;
      if (st === 1 && v && typeof v.then === 'function') { v.then(function (x) { settle(1, x); }, function (e) { settle(2, e); }); return; }
      self._s = st; self._v = v;
      var cbs = self._cb; self._cb = [];
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    }
    try { fn(function (v) { settle(1, v); }, function (e) { settle(2, e); }); } catch (e) { settle(2, e); }
  };
  P.prototype.then = function (onF, onR) {
    var self = this;
    return new P(function (res, rej) {
      function run() {
        setTimeout(function () {
          var h = self._s === 1 ? onF : onR;
          if (typeof h !== 'function') { (self._s === 1 ? res : rej)(self._v); return; }
          try { res(h(self._v)); } catch (e) { rej(e); }
        }, 0);
      }
      if (self._s) run(); else self._cb.push(run);
    });
  };
  P.prototype['catch'] = function (onR) { return this.then(null, onR); };
  window.Promise = P;
}

/* ============================================================ yordamchilar */
function $(id) { return document.getElementById(id); }
function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function now() { return new Date().getTime(); }
function closest(el, attr) { while (el && el !== document) { if (el.getAttribute && el.getAttribute(attr) != null) return el; el = el.parentNode; } return null; }
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function q(v) { return '"' + String(v).replace(/"/g, '') + '"'; }
var DEBUG = /[?&]debug=1/.test(location.search);
function dbg(m) { if (!DEBUG) return; var d = $('dbg'); d.style.display = 'block'; d.innerHTML = esc(m) + '<br>' + d.innerHTML.slice(0, 2000); }

var NC = window.nextclient || null;
/* Oddiy brauzerda (o'yindan tashqarida) ochilsa - yuklab olish sahifasiga. O'yin brauzeri CEF1 (Chrome 17), ?menu - tekshirish uchun */
(function () {
  var ua = navigator.userAgent || '', m = /Chrome\/(\d+)/.exec(ua);
  var modern = m ? +m[1] >= 50 : /Firefox|Safari|Edge/.test(ua);
  if (!NC && modern && !/[?#&]menu/.test(location.href)) location.replace('https://cssborka.uz/xclient/index.html');
})();
function hasApi() { return !!(NC && typeof NC.exec === 'function'); }
function hasMM() { return !!(NC && NC.matchmaking && NC.matchmaking.getServerInfo); }
function canRead() { return !!(NC && typeof NC.getCvarValue === 'function'); }
function ncHas(cv) { if (!canRead()) return true; var v = readCvar(cv); return v != null && v !== ''; }   // NextClient 2.5 da yo'q, 2.6 da bor sozlamalar
function radarNC() { return ncHas('hud_radar_scale'); }   // xaritali radar sozlamalari o'yinda bormi
function readCvar(n) { if (!canRead()) return null; try { var v = NC.getCvarValue(n); return v == null ? null : String(v); } catch (e) { return null; } }
function cmd(c) {
  dbg('exec: ' + c);
  try {
    if (hasApi()) {
      /* serverga ulanishdan OLDIN menyu musiqasini o'chiramiz: xarita yuklanayotganda mp3 chalinsa o'yin qotib,
       * ovoz takrorlanib qoladi va ba'zan yuklanish tugamaydi ('connect' hodisasi kech yoki manzilsiz kelishi mumkin) */
      if (/^(connect|retry|reconnect)\b/.test(c)) { if (DEMO_PLAY) demoEnd('menyu: ' + c); NC.exec('host_framerate 0\n'); NC.exec('mp3 stop\n'); NC.exec('stopsound\n'); MUSIC_ON = false; }
      /* demo paytida menyu yuborgan har bir buyruq konsolda ko'rinsin - demo nima sababdan yopilganini topish uchun */
      if (DEMO_PLAY && !/^(echo|play |xcd_|alias xcd|bind F[6-9]|unbind F[6-9])/.test(c)) NC.exec('echo [X CLIENT menyu] ' + c.replace(/["\n]/g, ' ') + '\n');
      NC.exec(c + '\n'); return true;
    }
  } catch (e) { dbg('exec xato ' + e); }
  return false;
}
function toast(msg, ms) {
  var t = $('toast'); t.innerHTML = esc(msg); t.style.display = 'block'; t.removeAttribute('data-ip'); t.removeAttribute('data-frprof'); t.className = '';
  clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.style.display = 'none'; }, ms || 2800);
}
/* bosiladigan xabar: do'st serverga kirdi -> bosilsa o'sha serverga ulanadi */
function toastAct(msg, attr, val, ms) { toast(msg, ms || 8000); var t = $('toast'); t.setAttribute(attr, val); t.className = 'act'; }
function normIp(ip) {
  ip = String(ip || '').replace(/\s+/g, '');
  if (!/^[\w.\-]+(:\d{1,5})?$/.test(ip)) return '';
  if (ip.indexOf(':') < 0) ip += ':27015';
  return ip;
}
function clean(v) { return String(v || '').replace(/[\u0000-\u001f\u007f-\u009f\ufffd\u2580-\u259f]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, ''); }

/* ============================================================ til */
var LANG = window.XC_LANG || { uz: {} };
var L = LANG.uz, CUR_LANG = 'uz';
var LFALL = { ua: 'ru', kz: 'ru', kg: 'ru', tj: 'ru', tr: 'en', az: 'en', tm: 'en' };
function T(k) {
  if (L && L[k] != null) return L[k];
  var f = LANG[LFALL[CUR_LANG]];
  if (f && f[k] != null) return f[k];
  return LANG.uz[k] != null ? LANG.uz[k] : k;
}
function fmtShort(sec) {                       // o'yinchilar ro'yxati uchun qisqa: 1:04 yoki 26'
  sec = Math.max(0, Math.round(sec || 0));
  var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? h + ':' + (m < 10 ? '0' : '') + m : m + "'";
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  if (CUR_LANG === 'ru' || LFALL[CUR_LANG] === 'ru') return h ? h + ' \u0447 ' + m + ' \u043c\u0438\u043d' : m + ' \u043c\u0438\u043d';
  if (CUR_LANG === 'en') return h ? h + ' h ' + m + ' min' : m + ' min';
  return h ? h + ' soat ' + m + ' daq' : m + ' daq';
}
function fmtTime(ts) {
  var d = new Date(ts), n = new Date();
  var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  if (d.toDateString() === n.toDateString()) return hm;
  var y = new Date(n.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return (CUR_LANG === 'ru' ? '\u0432\u0447\u0435\u0440\u0430 ' : CUR_LANG === 'en' ? 'yesterday ' : 'kecha ') + hm;
  return d.getDate() + '.' + (d.getMonth() + 1) + ' ' + hm;
}
function applyLang() {
  each(document.querySelectorAll('[data-t]'), function (el) { el.innerHTML = esc(T(el.getAttribute('data-t'))); });
  if (typeof renderTop2 === 'function') renderTop2();
  $('srvSearch').setAttribute('placeholder', T('search'));
  renderLoginForm();
  renderAll();
}
var LANGS = [['uz', 'UZ', "O'zbekcha", '#1eb53a'], ['ru', 'RU', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', '#0039a6'], ['en', 'EN', 'English', '#012169'],
  ['ua', 'UA', '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', '#0057b7'], ['tr', 'TR', 'T\u00fcrk\u00e7e', '#e30a17'], ['kz', 'KZ', '\u049a\u0430\u0437\u0430\u049b\u0448\u0430', '#00afca'],
  ['kg', 'KG', '\u041a\u044b\u0440\u0433\u044b\u0437\u0447\u0430', '#e8112d'], ['tj', 'TJ', '\u0422\u043e\u04b7\u0438\u043a\u04e3', '#006600'], ['az', 'AZ', 'Az\u0259rbaycanca', '#0092bc'], ['tm', 'TM', 'T\u00fcrkmen\u00e7e', '#28ae66']];
/* bayroqlar (ichki SVG - internet kerak emas, har o'lchamda tiniq) */
var FLAGS = {"uz": "<rect width=\"30\" height=\"20\" fill=\"#1eb53a\"/><rect width=\"30\" height=\"13.6\" fill=\"#ce1126\"/><rect width=\"30\" height=\"13.2\" fill=\"#fff\"/><rect width=\"30\" height=\"6.8\" fill=\"#ce1126\"/><rect width=\"30\" height=\"6.4\" fill=\"#0099b5\"/><circle cx=\"5\" cy=\"3.2\" r=\"2.2\" fill=\"#fff\"/><circle cx=\"5.9\" cy=\"3.2\" r=\"1.9\" fill=\"#0099b5\"/>", "ru": "<rect width=\"30\" height=\"20\" fill=\"#d52b1e\"/><rect width=\"30\" height=\"13.3\" fill=\"#0039a6\"/><rect width=\"30\" height=\"6.7\" fill=\"#fff\"/>", "en": "<rect width=\"30\" height=\"20\" fill=\"#012169\"/><path d=\"M0 0L30 20M30 0L0 20\" stroke=\"#fff\" stroke-width=\"4\"/><path d=\"M0 0L30 20M30 0L0 20\" stroke=\"#c8102e\" stroke-width=\"1.4\"/><rect x=\"12\" width=\"6\" height=\"20\" fill=\"#fff\"/><rect y=\"7\" width=\"30\" height=\"6\" fill=\"#fff\"/><rect x=\"13.3\" width=\"3.4\" height=\"20\" fill=\"#c8102e\"/><rect y=\"8.3\" width=\"30\" height=\"3.4\" fill=\"#c8102e\"/>", "ua": "<rect width=\"30\" height=\"20\" fill=\"#ffd700\"/><rect width=\"30\" height=\"10\" fill=\"#0057b7\"/>", "tr": "<rect width=\"30\" height=\"20\" fill=\"#e30a17\"/><circle cx=\"11\" cy=\"10\" r=\"5\" fill=\"#fff\"/><circle cx=\"12.3\" cy=\"10\" r=\"4\" fill=\"#e30a17\"/><polygon points=\"19.6,10 17.3,10.8 17.9,13.1 16.4,11.2 14.1,11.9 15.5,10 14.1,8.1 16.4,8.8 17.9,6.9 17.3,9.2\" fill=\"#fff\"/>", "kz": "<rect width=\"30\" height=\"20\" fill=\"#00afca\"/><circle cx=\"16\" cy=\"9\" r=\"3.4\" fill=\"#fec50c\"/><rect x=\"2\" width=\"1.6\" height=\"20\" fill=\"#fec50c\"/>", "kg": "<rect width=\"30\" height=\"20\" fill=\"#e8112d\"/><circle cx=\"15\" cy=\"10\" r=\"5\" fill=\"#ffef00\"/><circle cx=\"15\" cy=\"10\" r=\"2.6\" fill=\"#e8112d\"/>", "tj": "<rect width=\"30\" height=\"20\" fill=\"#006600\"/><rect width=\"30\" height=\"14.3\" fill=\"#fff\"/><rect width=\"30\" height=\"5.7\" fill=\"#cc0000\"/><circle cx=\"15\" cy=\"10\" r=\"1.7\" fill=\"#f8c300\"/>", "az": "<rect width=\"30\" height=\"20\" fill=\"#509e2f\"/><rect width=\"30\" height=\"13.3\" fill=\"#ef3340\"/><rect width=\"30\" height=\"6.7\" fill=\"#00b5e2\"/><circle cx=\"14\" cy=\"10\" r=\"2.6\" fill=\"#fff\"/><circle cx=\"14.8\" cy=\"10\" r=\"2.1\" fill=\"#ef3340\"/><circle cx=\"17.6\" cy=\"10\" r=\"0.9\" fill=\"#fff\"/>", "tm": "<rect width=\"30\" height=\"20\" fill=\"#00843d\"/><rect x=\"4\" width=\"5\" height=\"20\" fill=\"#d22630\"/><circle cx=\"21\" cy=\"5\" r=\"2.6\" fill=\"#fff\"/><circle cx=\"22.1\" cy=\"4.5\" r=\"2.3\" fill=\"#00843d\"/>"};
function langFlag(c) { return FLAGS[c] ? '<svg viewBox="0 0 30 20" width="30" height="20" preserveAspectRatio="none">' + FLAGS[c] + '</svg>' : ''; }
function langBox(o) { return '<b class="flb" style="background:' + o[3] + '">' + (FLAGS[o[0]] ? langFlag(o[0]) : o[1]) + '</b>'; }
/* kichik ikonkalar: emoji o'yin brauzerida (CEF) kvadrat bo'lib chiqadi - SVG ishlatamiz */
function ico(n) {
  var P = { chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>', pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
    rew: '<polygon points="11 19 2 12 11 5 11 19" fill="currentColor"/><polygon points="22 19 13 12 22 5 22 19" fill="currentColor"/>', ff: '<polygon points="13 19 22 12 13 5 13 19" fill="currentColor"/><polygon points="2 19 11 12 2 5 2 19" fill="currentColor"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>', folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    stop: '<rect x="5" y="5" width="14" height="14" fill="currentColor"/>', film: '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/>', user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' };
  return '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + (P[n] || '') + '</svg>';
}
function agoText(ts) {
  if (!ts) return T('ago_long');
  var d = Math.max(0, Math.floor(now() / 1000) - ts);
  if (d < 120) return T('ago_now');
  if (d < 3600) return T('ago_m').replace('{n}', Math.floor(d / 60));
  if (d < 86400) return T('ago_h').replace('{n}', Math.floor(d / 3600));
  return T('ago_d').replace('{n}', Math.floor(d / 86400));
}
function setLang(code) {
  var map = { uzbek: 'uz', russian: 'ru', ukrainian: 'ua', english: 'en', turkish: 'tr', kazakh: 'kz', kyrgyz: 'kg', tajik: 'tj', azerbaijani: 'az', turkmen: 'tm' };
  code = String(code || '').toLowerCase();
  CUR_LANG = LANG[code] ? code : (map[code] || 'uz');
  L = LANG[CUR_LANG] || LANG.uz;
  applyLang();
}

/* ============================================================ mahalliy saqlash */
var DB = { fav: [], hist: [], set: null, binds: null, lang: '', token: '', guest: 0, device: '', autosave: 1, cloudt: 0 };
function load() {
  try { var x = JSON.parse(localStorage.getItem('xclient') || '{}'); for (var k in x) if (x.hasOwnProperty(k)) DB[k] = x[k]; } catch (e) {}
  if (!DB.fav || !DB.fav.length) DB.fav = [];
  if (!DB.hist || !DB.hist.length) DB.hist = [];
  if (!DB.device) { DB.device = ''; for (var i = 0; i < 16; i++) DB.device += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36)); }
}
function persist() { try { localStorage.setItem('xclient', JSON.stringify(DB)); } catch (e) {} if (typeof statePush === 'function') statePush(); }

/* ============================================================ ekranga moslash (1600x900 dizayn) */
function fit() {
  var w = window.innerWidth || document.documentElement.clientWidth || 1600;
  var h = window.innerHeight || document.documentElement.clientHeight || 900;
  var z = Math.min(w / 1600, h / 900);
  var app = $('app');
  /* Kichik ekranda (z < 1) "zoom" bilan o'yin brauzeri matnni kichraytirmaydi (eng kichik shrift chegarasi) -
   * yozuvlar kattalashib, oynadan chiqib ketardi. Shuning uchun kichraytirish transform bilan: hammasi bir xil
   * nisbatda kichrayadi. Katta ekranda (z >= 1) zoom - matn tiniq qoladi. */
  if (z < 1) {
    app.style.zoom = 1;
    app.style.webkitTransformOrigin = '0 0'; app.style.transformOrigin = '0 0';
    app.style.webkitTransform = 'scale(' + z + ')'; app.style.transform = 'scale(' + z + ')';
  } else {
    app.style.webkitTransform = ''; app.style.transform = '';
    app.style.zoom = z;
  }
  var W = Math.round(w / z), H = Math.round(h / z);
  app.style.width = W + 'px'; app.style.height = H + 'px';
  each(document.querySelectorAll('.modal'), function (m) { m.style.width = W + 'px'; m.style.height = H + 'px'; });
  each(document.querySelectorAll('.win'), function (m) {
    var small = m.className.indexOf('sm') >= 0, mw = small ? 760 : 1180, mh = small ? 620 : 780;
    m.style.left = Math.round((W - mw) / 2) + 'px'; m.style.top = Math.max(10, Math.round((H - 52 - mh) / 2)) + 'px';
  });
  var ask = document.querySelector('.ask'); ask.style.left = Math.round((W - 480) / 2) + 'px'; ask.style.top = Math.round((H - 230) / 2) + 'px';
  $('toast').style.left = Math.round((W - 440) / 2) + 'px';
  $('loginBox').style.left = Math.max(620, W - 740) + 'px';
  // markazdagi X CLIENT: chap menyu bilan o'ng ustun o'rtasida
  var st = $('stage'), mid = Math.round((480 + (W - 450)) / 2);
  st.style.left = (mid - 300) + 'px'; st.style.top = Math.max(40, Math.round((H - 52 - 600) / 2)) + 'px';
}

/* ============================================================ yengil animatsiya
 * O'yin brauzeri (CEF1) har kadrni protsessorda chizadi - shuning uchun faqat kichik maydon,
 * sekundiga ~12 marta: halqa sekin aylanadi, nur "nafas oladi", logo ozgina suzadi. */
var INTRO_TM = 0;
function intro() {
  var r = document.querySelector('#stage .r1'), g = document.querySelector('#stage .glow'), x = document.querySelector('#stage .xl2'), t = document.querySelector('#stage .ttl');
  if (!r || !g || !x || !t) return;
  clearInterval(INTRO_TM);
  var f = 0, N = lowFx() ? 1 : 16;                      // ~1.2 soniya, keyin to'xtaydi (yengil menyuda - darhol)
  INTRO_TM = setInterval(function () {
    f++;
    var p = f / N, e = 1 - Math.pow(1 - p, 3);          // ease-out
    r.style.webkitTransform = 'rotate(' + Math.round(-120 + 120 * e) + 'deg)';
    g.style.opacity = e.toFixed(2);
    x.style.opacity = e.toFixed(2);
    x.style.webkitTransform = 'scale(' + (0.82 + 0.18 * e).toFixed(3) + ')';
    t.style.opacity = Math.max(0, (p - 0.4) / 0.6).toFixed(2);
    if (f >= N) clearInterval(INTRO_TM);
  }, 75);
}
/* uchqunlar: 14 ta kichik <i> (3x3 px) sekundiga ~11 marta siljiydi - faqat o'sha kichik nuqtalar qayta chiziladi.
 * O'yin paytida (menyu yopiq), oyna ochiq bo'lsa yoki Tizim'da o'chirilsa - hech narsa qilmaydi.
 * Kompyuter sekin bo'lsa (taymer kechiksa) o'zi o'chadi. */
var FX = { tm: 0, p: [], last: 0, slow: 0, off: 0, n: 0 };
/* Yengil menyu: effektlar (uchqun, porlash, halqa, soyalar) o'chiq - ESC bosilganda o'yin FPS'i tushmasin */
/* funksiya tugmalari (admin panel > Funksiyalar): o'chirilgani menyuda ko'rinmaydi. html ga "nf-<nom>" klassi qo'yiladi */
var FEAT = {};
function feat(k) { return FEAT[k] !== 0; }
function loadFeat() {
  api('feat', {}, function (r) {
    if (!r.ok || !r.f) return;
    FEAT = r.f; window.XC_BETA = r.beta; var h = document.documentElement;
    h.className = (h.className || '').replace(/(^|\s)nf-\w+/g, '');
    for (var k in FEAT) if (FEAT.hasOwnProperty(k) && FEAT[k] === 0) h.className += ' nf-' + k;
    if (typeof applyBg === 'function') applyBg();
  });
}
/* o'yin menyusi ko'rinib turibdimi: NextClient 'show'/'hide' hodisalari bo'yicha (gameUi.shown xususiyati har versiyada bo'lmasligi mumkin) */
var UI_VIS = true;
function uiShown() { try { if (NC && NC.gameUi && typeof NC.gameUi.shown === 'boolean') return NC.gameUi.shown; } catch (e) {} return UI_VIS; }
/* serverda o'ynalayotganda (ESC menyusi o'yin ustida) - effektlarsiz: aks holda o'yin FPS'i tushadi */
function lowFx() { return DB.fx === 0 || !!FX.off || !!CONNECTED; }
function fxClass() { var h = document.documentElement; h.className = (h.className || '').replace(/(^|\s)lowfx(?=\s|$)/g, '') + (lowFx() ? ' lowfx' : ''); }
function fxVisible() {
  if (curModal || document.webkitHidden) return false;
  return uiShown();
}
/* menyu foni (rang) va zarrachalar: uchqun / qor / yo'q. Bayramlarda o'zi bezanadi (Yangi yil - qor, Navro'z, Mustaqillik) */
var BGS = { def: '', blue: '#0d2a4a 0%, #0b1526 30%, #080c16 60%, #05070c 100%', purple: '#3a0d4a 0%, #1f0b2a 30%, #110a18 60%, #08060c 100%',
  green: '#0d3a1e 0%, #0b1f12 30%, #0a120d 60%, #060a07 100%', dark: '#1a1a1f 0%, #111114 30%, #0b0b0d 60%, #060607 100%', sand: '#4a3410 0%, #2a1e0b 30%, #16100a 60%, #0a0806 100%' };
function holiday() {
  if (DB.hol === 0 || !feat('holiday')) return null;
  var d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 1220 || md <= 107) return { id: 'ny', ptc: 'snow' };
  if (md >= 318 && md <= 325) return { id: 'nav', ptc: 'nav' };
  if (md >= 828 && md <= 903) return { id: 'ind', ptc: 'ind' };
  return null;
}
function ptcMode() { var h = holiday(); return DB.ptc === 'none' || !feat('particles') ? 'none' : (h && DB.ptc !== 'spark' ? h.ptc : (DB.ptc || 'spark')); }
function applyBg() {
  var b = $('bg'); if (!b) return;
  var g = BGS[DB.bgs || 'def'];
  b.style.background = g && !isDay() ? '-webkit-radial-gradient(55% 45%, circle cover, ' + g + ')' : '';
  var hb = $('holBar'), h = holiday();
  if (h) { if (!hb) { hb = document.createElement('div'); hb.id = 'holBar'; (document.getElementById('app') || document.body).appendChild(hb); } hb.className = 'hol ' + h.id; hb.innerHTML = esc(T('hd_' + h.id)); hb.style.display = ''; }
  else if (hb) hb.style.display = 'none';
  var m = ptcMode(), st = $('stage'); if (st) st.className = 'pt-' + m;
  if (FX.mode !== m) { FX.mode = m; each(FX.p, function (p) { sparkReset(p, true); }); sparks(); }
}
function sparkReset(p, first) {
  if (FX.mode === 'snow') {
    p.x = Math.random() * 600; p.y = first ? Math.random() * 600 : -10; p.vx = (Math.random() - 0.5) * 0.6; p.vy = 1 + Math.random() * 1.6;
    p.max = 400; p.life = 400; return;
  }
  p.x = 150 + Math.random() * 300; p.y = first ? 200 + Math.random() * 380 : 470 + Math.random() * 110;
  p.vx = (Math.random() - 0.5) * 2.4; p.vy = -(1.6 + Math.random() * 3.2);
  p.max = 22 + Math.floor(Math.random() * 26); p.life = first ? Math.floor(Math.random() * p.max) : p.max;
}
function sparks() {
  var st = $('stage'); if (!st) return;
  if (!FX.p.length) {
    for (var i = 0; i < 14; i++) {
      var d = document.createElement('i'); d.className = 'spk' + (i % 3 ? '' : ' s2'); st.appendChild(d);
      var p = { el: d }; sparkReset(p, true); FX.p.push(p);
    }
  }
  clearInterval(FX.tm);
  var on = DB.fx !== 0 && !FX.off && ptcMode() !== 'none';
  fxClass();
  each(FX.p, function (q) { q.el.style.display = on ? '' : 'none'; });
  if (!on) return;
  FX.last = +new Date();
  FX.tm = setInterval(sparkTick, 90);
}
function sparkTick() {
  var t = +new Date(), dt = t - FX.last; FX.last = t;
  if (!fxVisible()) return;
  if (dt > 260 && dt < 3000) { if (++FX.slow >= 12) { FX.off = 1; sparks(); return; } } else if (FX.slow > 0 && dt < 140) FX.slow -= 0.25;
  each(FX.p, function (p) {
    p.life--; if (p.life <= 0) sparkReset(p);
    p.x += p.vx; p.y += p.vy; p.vx += (Math.random() - 0.5) * (FX.mode === 'snow' ? 0.1 : 0.4);
    if (FX.mode === 'snow' && p.y > 620) sparkReset(p);
    var s = p.el.style;
    s.left = Math.round(p.x) + 'px'; s.top = Math.round(p.y) + 'px'; s.opacity = FX.mode === 'snow' ? '0.85' : (p.life / p.max).toFixed(2);
  });
  // kirmaganlarga akkaunt kartasi sekin "nafas oladi"
  if (!ME && !DB.acx && !DB.dnd && ++FX.n % 11 === 0) { var a = $('acct'); if (a) a.className = 'card acct' + (FX.n % 22 ? ' hi' : ''); }
}
function fxLoop() {
  intro(); sparks();
  try { if (NC && NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('show', intro); } catch (e) {}
}
/* ============================================================ XClient.exe bilan aloqa
 * XClient.exe bosh menyu manziliga ?xc=<kompyuter id>&v=<versiya>&c=<kesh MB> qo'shadi.
 * Tizim sozlamalari (beta, Windows bilan ishga tushish, ekran, kesh, fayllarni tekshirish)
 * xc_api.php ga yoziladi va XClient.exe ularni keyingi ishga tushishda bajaradi. */
function qparam(k) { var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search || ''); return m ? decodeURIComponent(m[1]) : ''; }
var PCID = /^[a-z0-9]{8,40}$/.test(qparam('xc')) ? qparam('xc') : '';   // kompyuter id (DB.pcid) va uning maxfiy kaliti (DB.pck) load() dan keyin olinadi
var HW = null, OPTS = { beta: 0, auto: 1, start: 0, res: '', win: 0, clean: 0, verify: 0, prio: 0, shots: 0, packs: '', hud: 100, vq: 'mid', dmf: null, vids: null, mic: 0, rb: 1 }, CACHE_MB = parseInt(qparam('c'), 10) || 0;
var OPTS_TRY = 0;
/* To'liq X CLIENT menyusi faqat XCLauncher.exe orqali ochilganda. Menyu saytda turadi va boshqa boost-top sborkalari ham
 * uni ochadi - ularda "sodda rejim": tezkor o'yin, serverlar, sozlamalar + X CLIENT ni yuklab olish kartasi.
 * Sayt javobigacha ('gate') akkaunt/do'stlar/vazifalar yashirin turadi; javob kelmasa 8 s dan keyin to'liq menyu ochiladi. */
var LITE = null;
/* xc.html ni faqat X CLIENT o'rnatgan o'yin ochadi (launcher bosh sahifani shunga almashtiradi) - u yerda o'yin
 * launchersiz (eski boost-top yorlig'idan, 10 daqiqadan keyin yoki IP almashgan holda) ochilsa ham to'liq menyu */
var ON_XC = /(^|\/)xc\.html$/i.test(location.pathname || '');
function setLite(on) {
  if (on && ON_XC) on = false;
  if (LITE === on) return;
  LITE = on;
  var h = document.documentElement;
  h.className = (h.className || '').replace(/(^|\s)(gate|lite)(?=\s|$)/g, '') + (on ? ' lite' : '');
  if (on && curModal === 'mdLogin') closeModal();
}
document.documentElement.className += ' gate';
setTimeout(function () { if (LITE === null) setLite(false); }, 8000);
function openPromo() {
  var h = '<div class="xpro"><img src="logo_big.png" alt=""><b>' + esc(T('lp_t')) + '</b><p>' + esc(T('lp_s')) + '</p><ul>';
  each(['lp_1', 'lp_2', 'lp_3', 'lp_4', 'lp_5'], function (k) { h += '<li>' + esc(T(k)) + '</li>'; });
  openSide('promo', 'X CLIENT', h + '</ul><div class="xurl">cssborka.uz/xclient</div><small class="mut">' + esc(T('lp_how')) + '</small></div>');
}
function loadOpts() {
  // id berilmasa server shu IP dan oxirgi ulangan XClient.exe ni topadi
  if (!PCID && DB.pcid && DB.pck) PCID = DB.pcid;
  api('opts', PCID ? { d: PCID } : {}, function (r) {
    if (!r.ok && r.err === 'nolaunch' && PCID) { PCID = ''; DB.pcid = DB.pck = ''; persist(); return loadOpts(); }   // kalit eskirgan
    if (r.ok) setLite(!r.o);                     // o: null - bu kompyuterda XCLauncher.exe ochilmagan (oddiy boost-top launcheri)
    if (!r.ok || !r.o) return;
    if (r.d) PCID = r.d;
    if (r.k) { DB.pcid = r.d; DB.pck = r.k; persist(); }
    for (var k in r.o) if (r.o.hasOwnProperty(k) && OPTS.hasOwnProperty(k)) OPTS[k] = r.o[k];
    if (r.o.ver && !qparam('v')) { VERSION = r.o.ver; renderBar(); }
    if (r.o.cachemb != null && !qparam('c')) CACHE_MB = r.o.cachemb;
    if (r.o.hw) { HW = r.o.hw; if (DB.fx == null && hwClass() === 'weak') { DB.fx = 0; persist(); sparks(); } }   // kuchsiz kompyuter - yengil menyu
    if (!DB.lang && /^(ru|uz|en)$/.test(r.o.ilang || '')) { DB.lang = r.o.ilang; setLang(DB.lang); persist(); }   // o'rnatishda tanlangan til
    stateSync();
    if (curModal === 'mdSettings' && (setTab === 'pro' || setTab === 'cont')) showSetTab(setTab);
    if (curModal === 'mdSettings' && (setTab === 'system' || setTab === 'video')) showSetTab(setTab);
  });
}
/* Menyu holati kompyuter (XCLauncher.exe) bo'yicha saytda ham saqlanadi: o'yin brauzeri localStorage ni har doim ham
 * saqlab qolmaydi (o'yin yopilganda yo'qoladi) - kirish ("Eslab qolish"), sevimlilar, tarix, tugmalar, til qayta tiklanadi. */
var STATE_SYNCED = false, STATE_TM = 0;
function stateData() {
  var h = [];
  each((DB.hist || []).slice(0, 50), function (x) { h.push({ ip: x.ip, name: x.name, map: x.map, t: x.t, d: x.d, k: x.k, x: x.x }); });
  return { token: DB.forget ? '' : (DB.token || ''), fav: DB.fav.slice(0, 100), hist: h, binds: DB.binds || null, binds2: DB.binds2 || null, lang: DB.lang || '', wnSeen: DB.wnSeen || '', dnd: DB.dnd ? 1 : 0, acx: DB.acx ? 1 : 0, pxx: DB.pxx || 0, demos: (DB.demos || []).slice(0, 40) };
}
function statePush() {
  if (!PCID || !STATE_SYNCED) return;
  clearTimeout(STATE_TM);
  STATE_TM = setTimeout(function () { api('dstate', { d: PCID, set: JSON.stringify(stateData()) }, function () {}); }, 1500);
}
function stateSync() {
  if (!PCID || STATE_SYNCED) return;
  api('dstate', { d: PCID }, function (r) {
    if (!r.ok) return;
    var st = r.st || {}, ch = false;
    each(st.fav || [], function (ip) { if (DB.fav.indexOf(ip) < 0) { DB.fav.push(ip); ch = true; } });
    if ((!DB.hist || !DB.hist.length) && st.hist && st.hist.length) { DB.hist = st.hist; ch = true; }
    if (!DB.binds && st.binds) { DB.binds = st.binds; DB.binds2 = st.binds2 || null; loadBinds(); applyBinds(); ch = true; }
    if (!DB.lang && st.lang) { DB.lang = st.lang; setLang(st.lang); ch = true; }
    if (!DB.wnSeen && st.wnSeen) { DB.wnSeen = st.wnSeen; ch = true; }
    if (DB.dnd == null && st.dnd) { DB.dnd = 1; ch = true; }
    if (!DB.acx && st.acx) { DB.acx = 1; ch = true; }
    if (!DB.pxx && st.pxx) { DB.pxx = st.pxx; ch = true; }
    if ((!DB.demos || !DB.demos.length) && st.demos && st.demos.length) { DB.demos = st.demos; ch = true; }   // demolar ro'yxati qayta kirganda yo'qolmasin
    STATE_SYNCED = true;
    if (!DB.token && st.token) {
      DB.token = st.token;
      api('me', {}, function (m) {
        if (m.ok) { setMe(m.me); loadFriends(); pingPresence(); }
        else if (m.err === 'auth') DB.token = '';
        persist();
      });
    }
    if (ch) { persist(); renderSoon(); } else statePush();
  });
}
/* IP nusxalash: o'yin brauzerida (CEF1) clipboard API yo'q - maydonni belgilab execCommand('copy');
 * bo'lmasa IP belgilangan holda qoladi va "Ctrl+C" deb aytamiz */
function copyIp(ip, inp) {
  var ok = false;
  try {
    if (!inp) { inp = document.createElement('input'); inp.value = ip; inp.style.cssText = 'position:absolute;left:-999px;top:0'; document.body.appendChild(inp); }
    inp.focus(); inp.select();
    ok = document.execCommand && document.execCommand('copy');
  } catch (e) { ok = false; }
  toast(ok ? T('ip_copied') + ' ' + ip : T('ip_ctrlc'), 3000);
}
function saveOpts(msg) {
  if (!PCID) { toast(T('sy_nolaunch'), 4000); return; }
  api('opts_set', { d: PCID, o: JSON.stringify(OPTS) }, function (r) { toast(r.ok ? (msg || T('sy_next')) : (r.msg || 'Xato'), 3500); });
}

/* ============================================================ akkaunt API (xc_api.php) */
var ME = null, FRIENDS = [], WEEK = [];
function api(a, params, cb) {
  var body = 'a=' + encodeURIComponent(a) + '&device=' + DB.device + (DB.token ? '&token=' + DB.token : '') + (params && params.d && params.d === PCID && DB.pck ? '&k=' + DB.pck : '');
  for (var k in params) if (params.hasOwnProperty(k)) body += '&' + k + '=' + encodeURIComponent(params[k]);
  var x;
  try { x = new XMLHttpRequest(); x.open('POST', 'xc_api.php', true); x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); }
  catch (e) { if (cb) cb({ ok: false, err: 'net', msg: T('lg_neterr') }); return; }
  var done = false;
  var tm = setTimeout(function () { if (!done) { done = true; try { x.abort(); } catch (e) {} if (cb) cb({ ok: false, err: 'net', msg: T('lg_neterr') }); } }, 12000);
  x.onreadystatechange = function () {
    if (x.readyState !== 4 || done) return;
    done = true; clearTimeout(tm);
    var r = null;
    try { r = JSON.parse(x.responseText); } catch (e) {}
    if (!r) r = { ok: false, err: 'net', msg: T('lg_neterr') };
    if (r.err === 'auth') { DB.token = ''; ME = null; persist(); renderAll(); }
    if (r.msg && window.SRVMSG && SRVMSG[r.msg] && CUR_LANG !== 'uz') {   // sayt xabarlari o'zbekcha - tanlangan tilga
      var li = CUR_LANG === 'en' || LFALL[CUR_LANG] === 'en' ? 1 : 0;
      r.msg = SRVMSG[r.msg][li];
    }
    if (cb) cb(r);
  };
  try { x.send(body); } catch (e) { done = true; clearTimeout(tm); if (cb) cb({ ok: false, err: 'net', msg: T('lg_neterr') }); }
}
function setMe(me) { var was = !!ME; ME = me; renderAll(); if (me && !was) { setTimeout(pollNotif, 3000); setTimeout(statBackfill, 5000); setTimeout(claimDaily, 6000); } }
/* kunlik kirish mukofoti: har kuni birinchi kirishda o'zi olinadi (ketma-ket kunlar - ko'proq XP, 7-kuni +200) */
function claimDaily() {
  if (!ME || LITE || !feat('daily')) return;
  api('daily', {}, function (r) {
    if (!r.ok || !r.got || !ME) return;
    ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar();
    if (r.newach && r.newach.length) { ME.ach = (ME.ach || []).concat(r.newach); setTimeout(function () { achToast(r.newach); }, 7500); }
    if (r.chests != null) { ME.chests = r.chests; renderBar(); }
    if (r.yday && !DB.dnd) setTimeout(function () { if (!curModal) showYesterday(r.yday); }, 2500);
    if (!DB.dnd) { toast(T('dl_ok').replace('{n}', r.got).replace('{d}', r.streak), 7000); sfx('save'); }
  });
}
/* jang statistikasi qo'shilgunga qadar o'ynalgan o'yinlar (shu kompyuter tarixidan) - akkauntga BIR MARTA qo'shiladi */
function statBackfill() {
  if (!ME || ME.bf) return;
  var g = [];
  each((DB.hist || []).slice(0, 100), function (x) { if (x && x.ip && x.t && x !== CUR && (x.k || x.x)) g.push({ t: x.t, ip: x.ip, n: x.name || '', k: x.k || 0, d: x.x || 0, dur: x.d || 0 }); });
  api('stat_bf', { g: JSON.stringify(g) }, function (r) { if (r.ok && ME) { ME.bf = 1; ME.st = r.st; ME.ach = r.ach; achToast(r.newach); renderAll(); } });
}
function afterLogin(r) {
  DB.token = r.token; DB.guest = 0; persist();
  setMe(r.me);
  closeModal();
  // yangi kompyuterda: bulutdagi sozlamalarni olamiz, bo'lmasa shu kompyuterdagisini bulutga yuboramiz
  if (r.me.cloud && (!DB.set || r.me.cloudt > (DB.cloudt || 0))) restoreCloud(r.me.cloud, true);
  else cloudSave(true);
  loadFriends();
}
/* ---- jang statistikasi (akkaunt): shu o'yinning jami kill/o'lim/qurollari yuboriladi, sayt farqini qo'shadi ---- */
var STAT_LAST = '';
function sendStat(g, done) {
  g = g || CUR;
  if (!ME || !g || !g.t || !g.ip) { if (done) done(); return; }
  var dur = Math.round(((CONNECTED && g === CUR) ? now() - g.t : (g.d || 0) * 1000) / 1000);
  var key = g.t + ':' + (g.k || 0) + ':' + (g.x || 0) + ':' + Math.floor(dur / (done ? 1 : 300));
  if (key === STAT_LAST) { if (done) done(); return; }
  STAT_LAST = key;
  api('stat', { sid: g.t, ip: g.ip, name: g.name || '', map: g.map || '', k: g.k || 0, d: g.x || 0, dur: dur, w: JSON.stringify(g.w || {}) }, function (r) { if (done) done(); if (r.ok && ME) { ME.st = r.st; ME.ach = r.ach; if (r.xp != null) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); } achToast(r.newach); } });
}
function fmtHours(sec) { var h = Math.floor((sec || 0) / 3600), m = Math.floor((sec || 0) % 3600 / 60); return h ? h + T('ks_h') + ' ' + m + T('ks_m') : m + T('ks_m'); }
function kdOf(st) { return st && st.d ? (st.k / st.d).toFixed(2) : String(st && st.k || 0); }
function statBox(st) {
  st = st || {};
  var c = function (v, l) { return '<div><b>' + esc(String(v)) + '</b><span>' + esc(T(l)) + '</span></div>'; };
  return '<div class="stbox">' + c(st.k || 0, 'ks_k') + c(st.d || 0, 'ks_d') + c(kdOf(st), 'ks_kd') + c(st.g || 0, 'ks_g') + '</div>';
}
function openStats() {
  var st = (ME && ME.st) || {}, w = '', sv = '';
  for (var wn in st.wpn || {}) if (st.wpn.hasOwnProperty(wn)) w += '<div class="kv"><span>' + esc(wn) + '</span><b>' + st.wpn[wn] + '</b></div>';
  for (var ip in st.srv || {}) if (st.srv.hasOwnProperty(ip)) { var x = st.srv[ip]; sv += '<div class="kv"><span>' + esc(x.n || ip) + '</span><b>' + x.k + ' / ' + x.d + '</b></div>'; }
  var h = statBox(st) +
    '<div class="stmore"><div class="kv"><span>' + esc(T('ks_best')) + '</span><b>' + (st.best || 0) + '</b></div><div class="kv"><span>' + esc(T('ks_time')) + '</span><b>' + esc(fmtHours(st.t)) + '</b></div>' +
    '<div class="kv"><span>' + esc(T('ks_week')) + '</span><b>' + (st.wk || 0) + '</b></div></div>' +
    '<div class="ph2 m">' + esc(T('ac_title')) + ' (' + ((ME && ME.ach) || []).length + '/' + ACH.length + ')</div>' + achBadges(ME && ME.ach, true) +
    '<div class="ph2 m">' + esc(T('ks_wpn')) + '</div>' + (w || '<div class="mut">' + esc(T('ks_none')) + '</div>') +
    '<div class="ph2 m">' + esc(T('ks_srv')) + '</div>' + (sv || '<div class="mut">' + esc(T('ks_none')) + '</div>') +
    '<div class="ph2 m">' + esc(T('ks_top')) + '</div><div id="topkList" class="mut">...</div><small class="mut">' + esc(T('ks_note')) + '</small>';
  h = rankCard(ME) + statBox(st) + wkChart(ME && ME.wkst) + h.slice(statBox(st).length) + myGames() + '<div class="ph2 m">' + esc(T('rk_top')) + '</div><div id="rpTop" class="mut">...</div>';
  openSide('stats', T('ks_title'), h);
  api('toprp', {}, function (r) {
    var el = $('rpTop'); if (!el) return; var t = '';
    each((r.ok && r.top) || [], function (x, i) { t += '<div class="kv"><span>' + (i + 1) + '. ' + nickHtml(x) + ' ' + rankBadge(x) + '</span><b>' + x.rp + ' RP</b></div>'; });
    el.innerHTML = t || esc(T('ks_none')); el.className = '';
  });
  api('topk', {}, function (r) {
    var el = $('topkList'); if (!el) return;
    var t = '';
    each((r.ok && r.top) || [], function (x, i) { t += '<div class="kv"><span>' + (i + 1) + '. ' + esc(x.name) + (x.vip ? ' <em class="vipb">VIP</em>' : '') + '</span><b>' + x.k + ' kill · K/D ' + x.kd + '</b></div>'; });
    el.innerHTML = t || esc(T('ks_none')); el.className = '';
  });
}
/* haftalar bo'yicha grafik: ustun - kill, ostida K/D (oxirgi 12 hafta) */
function wkChart(ws) {
  var keys = []; for (var k in ws || {}) if (ws.hasOwnProperty(k)) keys.push(k);
  keys.sort(); if (!keys.length) return '';
  var mx = 1; each(keys, function (k) { mx = Math.max(mx, ws[k].k); });
  var h = '<div class="ph2 m">' + esc(T('wk_title')) + '</div><div class="wkc">';
  each(keys, function (k, i) {
    var x = ws[k], kd = x.d ? (x.k / x.d).toFixed(2) : String(x.k), prev = i ? ws[keys[i - 1]] : null, pk = prev ? (prev.d ? prev.k / prev.d : prev.k) : null, ck = x.d ? x.k / x.d : x.k;
    h += '<div class="wkb"><em>' + x.k + '</em><i style="height:' + Math.max(3, Math.round(110 * x.k / mx)) + 'px"></i><b class="' + (pk === null ? '' : ck >= pk ? 'up' : 'dn') + '">' + kd + '</b><small>' + esc(k.replace(/^\d{4}-/, '')) + '-' + esc(T('wk_w')) + '</small></div>';
  });
  return h + '</div><small class="mut">' + esc(T('wk_note')) + '</small>';
}
/* oxirgi o'yinlar: har o'yin - sana, server, xarita, vaqt, kill/o'lim */
function myGames() {
  var l = (DB.hist || []).slice(0, 30); if (!l.length) return '';
  var h = '<div class="ph2 m">' + esc(T('mg_title')) + '</div><table class="mgt"><tr><th>' + esc(T('mg_date')) + '</th><th>' + esc(T('mg_srv')) + '</th><th>' + esc(T('mg_map')) + '</th><th>' + esc(T('mg_time')) + '</th><th>K</th><th>D</th><th>K/D</th></tr>';
  each(l, function (x) {
    var k = x.k || 0, d = x.x || 0;
    h += '<tr><td>' + esc(fmtTime(x.t)) + '</td><td data-ip="' + esc(x.ip) + '" class="lnk">' + esc(x.name || x.ip) + '</td><td>' + esc(x.map || '\u2014') + '</td><td>' + esc(fmtHours(x.d || 0)) + '</td><td><b>' + k + '</b></td><td>' + d + '</td><td class="' + (d && k / d >= 1 ? 'gr' : '') + '">' + (d ? (k / d).toFixed(2) : k) + '</td></tr>';
  });
  return h + '</table>';
}
/* ---- do'st bilan solishtirish ---- */
function openCompare(login) {
  var f = null; each(FRIENDS, function (x) { if (x.login === login) f = x; });
  if (!f || !ME) return;
  var a = ME.st || {}, b = f.st || {};
  var rows = [['ks_k', a.k || 0, b.k || 0], ['ks_d', a.d || 0, b.d || 0, 1], ['ks_kd', +kdOf(a), +kdOf(b)], ['ks_g', a.g || 0, b.g || 0],
    ['ks_best', a.best || 0, b.best || 0], ['ks_week', a.wk || 0, b.wk || 0], ['ks_time', a.t || 0, b.t || 0], ['cmp_lvl', ME.level || 1, f.level || 1],
    ['ac_title', (ME.ach || []).length, (f.ach || []).length]];
  var me = 0, him = 0, h = '<div class="cmp"><div class="cmh"><b>' + crown(ME) + esc(ME.name) + '</b><span>VS</span><b>' + crown(f) + esc(f.name) + '</b></div>';
  each(rows, function (r) {
    var lowWin = r[3], x = r[1], y = r[2], wx = lowWin ? x < y : x > y, wy = lowWin ? y < x : y > x;
    if (wx) me++; if (wy) him++;
    var fmt = function (v) { return r[0] === 'ks_time' ? fmtHours(v) : String(v); };
    h += '<div class="cmr"><span class="' + (wx ? 'w' : '') + '">' + esc(fmt(x)) + '</span><em>' + esc(T(r[0])) + '</em><span class="' + (wy ? 'w' : '') + '">' + esc(fmt(y)) + '</span></div>';
  });
  h += '<div class="cmres">' + esc(me > him ? T('cmp_win') : me < him ? T('cmp_lose').replace('{n}', f.name) : T('cmp_draw')) + ' (' + me + ':' + him + ')</div></div>';
  openSide('cmp', T('cmp_title'), h);
}
/* ---- klan ---- */
var CLAN = null;
function openClan() {
  if (!ME) return openLogin();
  api('clan_info', {}, function (r) { if (r.ok) { CLAN = r.clan; ME.clan = r.clan ? { id: r.clan.id, tag: r.clan.tag, name: r.clan.name } : null; } renderClan(); });
  renderClan();
}
function renderClan() {
  var h = '';
  if (!CLAN) {
    h = '<div class="empty" style="padding:10px 0 16px">' + esc(T('cl_none')) + '</div><a class="btn red" data-act="clancreate">' + esc(T('cl_create')) + '</a> <a class="btn" data-act="clanjoin">' + esc(T('cl_join')) + '</a>';
  } else {
    h = '<div class="clh"><b>[' + esc(CLAN.tag) + '] ' + esc(CLAN.name) + '</b><small>' + esc(T('cl_week').replace('{k}', CLAN.wk)) + ' \u00b7 ' + CLAN.members.length + '/10</small></div>' +
      '<div class="ph2 m">' + esc(T('cl_code')) + '</div><div class="avurl"><input class="ipin" readonly value="' + esc(CLAN.code) + '"><a class="cpy" data-copyip="' + esc(CLAN.code) + '">' + esc(T('ip_copy')) + '</a></div>' +
      '<div class="ph2 m">' + esc(T('cl_members')) + '</div>';
    each(CLAN.members, function (m) {
      h += '<div class="tr" style="cursor:default">' + frAv(m) + '<div class="nm">' + (m.login === CLAN.owner ? ico('flag') + ' ' : '') + crown(m) + esc(m.name) + '</div><div class="mt">' + m.wk + ' kill \u00b7 K/D ' + kdOf(m.st) + '</div>' +
        (CLAN.boss && m.login !== CLAN.owner ? '<div class="fra"><a data-clkick="' + esc(m.login) + '">' + esc(T('cl_kick')) + '</a></div>' : '') + '</div>';
    });
    h += '<a class="btn out" data-act="clanleave" style="margin-top:10px">' + esc(T('cl_leave')) + '</a>';
  }
  h += '<div class="ph2 m">' + esc(T('cl_top')) + '</div><div id="clTop" class="mut">...</div>';
  openSide('clan', T('cl_title'), h);
  api('clan_top', {}, function (r) {
    var el = $('clTop'); if (!el) return; var t = '';
    each((r.ok && r.top) || [], function (c, i) { t += '<div class="kv"><span>' + (i + 1) + '. [' + esc(c.tag) + '] ' + esc(c.name) + ' <small class="mut">' + c.n + '</small></span><b>' + c.k + ' kill</b></div>'; });
    el.innerHTML = t || esc(T('ks_none')); el.className = '';
  });
}
function clanCall(a, p) { api(a, p || {}, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); CLAN = r.clan; ME.clan = r.clan ? { id: r.clan.id, tag: r.clan.tag, name: r.clan.name } : null; renderClan(); }); }
/* ---- taklif kodi va ulashiladigan profil kartasi ---- */
function openRef() {
  if (!ME) return openLogin();
  var url = 'mmb.boost-top.com/u.php?u=' + String(ME.login).toLowerCase();
  var h = '<div class="ph2">' + esc(T('rf_code')) + '</div><div class="avurl"><input class="ipin" readonly value="' + esc(ME.login) + '"><a class="cpy" data-copyip="' + esc(ME.login) + '">' + esc(T('ip_copy')) + '</a></div>' +
    '<div class="mut small" style="margin:6px 0 14px">' + esc(T('rf_how')) + '</div>' +
    '<div class="ph2 m">' + esc(T('rf_card')) + '</div><div class="avurl"><input class="ipin" readonly value="' + esc(url) + '"><a class="cpy" data-copyip="' + esc(url) + '">' + esc(T('ip_copy')) + '</a></div>' +
    '<div class="mut small" style="margin:6px 0 14px">' + esc(T('rf_card2')) + '</div>' +
    '<div class="kv"><span>' + esc(T('rf_count')) + '</span><b>' + (ME.refs || 0) + '</b></div>';
  if (!ME.refby && ME.created && now() / 1000 - ME.created < 7 * 86400) h += '<a class="btn red" data-act="refset" style="margin-top:14px">' + esc(T('rf_enter')) + '</a>';
  else if (ME.refby) h += '<div class="kv"><span>' + esc(T('rf_by')) + '</span><b>' + esc(ME.refby) + '</b></div>';
  openSide('ref', T('rf_title'), h);
}
function histCompact(list, n) {                // tarix: akkauntga oxirgi 50 ta o'yin (boshqa kompyuterda ham chiqadi)
  var h = [];
  each((list || []).slice(0, n), function (x) { if (x && x.ip) h.push({ ip: x.ip, name: x.name, map: x.map, t: x.t, d: x.d, k: x.k, x: x.x }); });
  return h;
}
function cloudData() { return { set: DB.set, binds: DB.binds, binds2: DB.binds2, fav: DB.fav, lang: DB.lang, hist: histCompact(DB.hist, 50), pw: DB.pw || [], theme: DB.theme || '', day: DB.day || 0, look: { bgs: DB.bgs || '', ptc: DB.ptc || '', fs: DB.fs || 1, hol: DB.hol === 0 ? 0 : 1, mtrack: DB.mtrack || '' } }; }
function mergeHist(add) {                      // ikki kompyuter tarixini birlashtirish: bir xil o'yin (ip + vaqt) bir marta
  var seen = {}, out = [];
  each((DB.hist || []).concat(add || []), function (x) { var k = x.ip + '|' + Math.round((x.t || 0) / 60000); if (!seen[k]) { seen[k] = 1; out.push(x); } });
  out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
  DB.hist = out.slice(0, 300);
}
var cloudTm = 0;
function cloudSave(force) {
  if (!ME || (!DB.autosave && !force)) return;
  clearTimeout(cloudTm);
  cloudTm = setTimeout(function () {
    api('save', { cloud: JSON.stringify(cloudData()) }, function (r) {
      if (!r.ok || !ME) return;
      ME.cloudt = r.cloudt; ME.devices = r.devices; DB.cloudt = r.cloudt; persist(); renderBar();
      if (curModal === 'mdSettings' && setTab === 'account') showSetTab('account');
    });
  }, force ? 0 : 1500);
}
function restoreCloud(c, silent) {
  if (!c) return;
  if (c.set) { DB.set = c.set; loadSettings(); applySettings(S); }
  if (c.binds) { DB.binds = c.binds; if (c.binds2) DB.binds2 = c.binds2; loadBinds(); applyBinds(); }
  if (c.fav && c.fav.length) each(c.fav, function (ip) { if (DB.fav.indexOf(ip) < 0) DB.fav.push(ip); });
  if (c.lang) { DB.lang = c.lang; setLang(c.lang); }
  if (c.hist && c.hist.length) mergeHist(c.hist);
  if (c.pw && c.pw.length) DB.pw = c.pw;
  if (c.look) { DB.bgs = c.look.bgs; DB.ptc = c.look.ptc; DB.fs = c.look.fs || 1; DB.hol = c.look.hol; DB.mtrack = c.look.mtrack; applyBg(); }
  if ((c.theme && c.theme !== DB.theme) || (c.day != null && c.day !== (DB.day || 0))) { if (c.theme) DB.theme = c.theme; if (c.day != null) DB.day = c.day; applyTheme(DB.theme || 'red'); }
  DB.cloudt = ME ? ME.cloudt : 0; persist();
  if (!silent) toast(T('a_restored'));
  renderAll();
}
function loadFriends() {
  if (!ME) { FRIENDS = []; renderHome(); return; }
  api('friends', {}, function (r) {
    if (!r.ok) return;
    var before = {};
    each(FRIENDS, function (f) { before[f.login] = f.server; });
    FRIENDS = r.friends || []; FR_REQ = r.req || []; FR_SENT = r.sent || [];
    each(FRIENDS, function (f) {                                   // do'st sevimli serverga kirdi
      if (f.server && before[f.login] !== undefined && before[f.login] !== f.server && f.server !== CONNECTED && DB.notifyFr !== 0 && !DB.dnd)
        toastAct(f.name + T('fr_joined') + (srv(f.server).name || f.server) + ' \u2014 ' + T('fr_joinq'), 'data-ip', f.server, 9000);
      if (f.server) query(f.server);
    });
    renderHome();
    if (curModal === 'mdServers' && srvTab === 'friends') renderServers();
    if (curModal === 'mdSide' && sideMode === 'friends') openFriends();
    frBadge();
  });
}
/* bosh menyu: "Hafta qotillari" TOP-3 (jang statistikasidan) + o'tgan hafta chempioni */
var CHAMP = null;
function loadWeek() { api('topk', {}, function (r) { if (r.ok) { WEEK = r.top || []; CHAMP = r.champ || null; renderHome(); } }); }
function crown(u) { return (u && (u.champ || (CHAMP && CHAMP.login && u.login && CHAMP.login === String(u.login).toLowerCase()))) ? '<span class="crown" title="' + esc(T('chp_title')) + '">\u265b</span>' : ''; }
/* ---- yutuqlar ---- */
var ACH = [['k100', ico('swords')], ['k1000', ico('swords')], ['k5000', ico('swords')], ['best30', '\u2605'], ['g100', '\u25b6'], ['t10h', ico('clock')], ['t50h', ico('clock')],
  ['awp100', '\u25ce'], ['ak500', '\u25ce'], ['knife10', '\u2020'], ['deagle100', '\u25ce'], ['fr5', '\u263a'], ['ref3', '\u2709'], ['champ', '\u265b'], ['clan', ico('flag')],
  ['k10000', ico('swords')], ['best50', '\u2605'], ['g500', '\u25b6'], ['t100h', ico('clock')], ['fr20', '\u263a'], ['streak7', '\u2600'], ['srv10', '\u25ce'], ['wall10', '\u270e']];
function achBadges(list, all) {
  var h = '';
  each(ACH, function (a) {
    var got = (list || []).indexOf(a[0]) >= 0;
    if (!got && !all) return;
    h += '<span class="ach' + (got ? ' on' : '') + '" title="' + esc(T('ac_' + a[0] + '_d')) + '"><i>' + a[1] + '</i>' + esc(T('ac_' + a[0])) + '</span>';
  });
  return h ? '<div class="achs">' + h + '</div>' : '';
}
function achToast(ids) { each(ids || [], function (id, i) { setTimeout(function () { toast('\u2605 ' + T('ac_new') + ': ' + T('ac_' + id) + ' (+100 XP)', 5000); sfx('save'); }, 600 + i * 5200); }); }
/* do'stdan taklif: "X sizni serverga chaqiryapti" -> Kirish */
function showInvite(iv) {
  var ip = normIp(iv.ip); if (!ip || ip === CONNECTED) return;
  if ($('mdAsk') && /(^|\s)on(\s|$)/.test($('mdAsk').className)) return setTimeout(function () {
    if (DB.dnd || !ME || (iv.t && now() / 1000 - iv.t > 600)) return;   // kutib turganda eskirgan taklif chiqmasin
    showInvite(iv);
  }, 5000);   // ochiq so'rov (parol, nom...) ustiga yozmaymiz
  var s = srv(ip); query(ip);
  ask(T('iv_title').replace('{n}', iv.from || iv.login).replace('{s}', s.name || ip), function () { closeModal(); connect(ip); }, false, false, true);
}
function pingPresence() {
  if (!ME) return;
  var s = CONNECTED ? srv(CONNECTED) : null;
  api('ping', { server: CONNECTED || '', map: (s && s.map) || '' }, function (r) {
    if (r.ok && ME) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); }
    if (r.ok && r.inv && r.inv.length && !DB.dnd) showInvite(r.inv[r.inv.length - 1]);
    if (r.ok && r.msgs && r.msgs.length) showAdminMsgs(r.msgs);
  });
}

/* ============================================================ serverlar */
var PINNED = ['157.22.130.26:27015'];       // X CLIENT o'z serverlari
var SRV = {}, MASTER = [], TOP = [];
var queue = [], running = 0, MAXQ = 12;
function srv(ip) { if (!SRV[ip]) SRV[ip] = { ip: ip }; return SRV[ip]; }
function query(ip, force) {
  if (!ip) return;
  // serverda o'ynayotganda orqa fonda so'rov yubormaymiz: bitta IP'dan ham o'ynash, ham serverlarni tinmay so'rash
  // himoyalar (DProto/ReChecker) nazarida "FakePlayers" kabi ko'rinadi. Ulangan serverning o'zini umuman so'ramaymiz.
  if (CONNECTED && normIp(ip) === CONNECTED) return queryViaSite(ip, force);   // o'zimiz o'ynayotgan server - faqat sayt orqali (o'yinchi IP'sidan so'rov ketmaydi)
  if (CONNECTED && !(force || (curModal === 'mdServers' && uiShown()))) return;
  var s = srv(ip);
  if (!force && s.ts && now() - s.ts < 20000) return;
  if (s.q) return;
  s.q = 1; queue.push(ip); pump();
}
function queryViaSite(ip, force) {
  var s = srv(ip);
  if (s.q || (!force && s.ts && now() - s.ts < 20000)) return;
  s.q = 1;
  srvq(ip, function (r) {
    s.q = 0; s.ts = now();
    if (r && r.ok) { s.ok = true; s.fail = false; s.name = clean(r.name) || s.name || ip; s.map = clean(r.map); s.pl = r.pl || 0; s.max = r.max || 0; s.bots = r.bots || 0;
      if (r.players) setPlayers(ip, r.players.map(function (x) { return { name: x.name, score: x.score, timePlayedSeconds: x.time }; })); }
    renderSoon();
  });
}
function pump() {
  while (running < MAXQ && queue.length) {
    (function (ip) {
      running++;
      var s = srv(ip), t0 = now(), done = false;
      function fin() { if (done) return; done = true; running--; s.q = 0; s.ts = now(); onSrvUpdate(s); renderSoon(); pump(); }
      /* NextClient javob ololmasa - sayt (srvq.php) orqali qayta so'raymiz: ba'zi serverlar so'rovlarni cheklaydi */
      function viaSite() {
        srvq(ip, function (r) {
          if (done) return;
          if (r && r.ok) {
            s.prevPl = s.ok ? s.pl : null; s.ok = true; s.fail = false; s.ping = s.ping || 0;
            s.name = clean(r.name) || ip; s.map = clean(r.map); s.pl = r.pl || 0; s.max = r.max || 0; s.bots = r.bots || 0;
            if (r.players) PLAYERS[ip] = r.players.map(function (x) { return { name: x.name, score: x.score, timePlayedSeconds: x.time }; });
          } else { s.ok = false; s.fail = true; }
          fin();
        });
      }
      var tm = setTimeout(function () { if (!done) viaSite(); }, 6000);
      if (!hasMM()) { clearTimeout(tm); viaSite(); return; }
      try {
        NC.matchmaking.getServerInfo(ip).then(function (r) {
          clearTimeout(tm);
          r = r || {};
          s.prevPl = s.ok ? s.pl : null; s.ok = true; s.fail = false; s.ping = now() - t0;
          s.name = clean(r.hostname) || ip; s.map = clean(r.map);
          s.pl = r.playersOnline || 0; s.max = r.playersMax || 0; s.bots = r.botsOnline || 0; s.pass = !!r.isPasswordProtected;
          fin();
        }, function () { clearTimeout(tm); viaSite(); });
      } catch (e) { clearTimeout(tm); viaSite(); }
    })(queue.shift());
  }
}
function isX(s) { return PINNED.indexOf(s.ip) >= 0 || /x\s*client/i.test(s.name || ''); }
function isFavIp(ip) { return DB.fav.indexOf(ip) >= 0; }
function isFull(s) { return !!(s.ok && s.max && s.pl >= s.max); }
function modeOf(s) {
  var m = (s.map || '').toLowerCase(), n = (s.name || '').toLowerCase();
  if (/^zm_|zombie/.test(m) || /zombie|\bzm\b/.test(n)) return 'zm';
  if (/^gg_/.test(m) || /gungame|gun game/.test(n)) return 'gg';
  if (/^(jail_|jb_|ba_jail)/.test(m) || /jail/.test(n)) return 'jail';
  if (/^(kz_|bhop_|surf_|kzra_)/.test(m) || /\bkz\b|surf|bhop|climb/.test(n)) return 'kz';
  if (/^awp_/.test(m) || /\bawp\b/.test(n)) return 'awp';
  if (/^(aim_|fy_|35hp_)/.test(m)) return 'aim';
  if (/deathmatch|\bdm\b|csdm/.test(n)) return 'dm';
  if (/^(de_|cs_|as_)/.test(m)) return 'classic';
  return 'other';
}
var rTimer = 0;
function renderSoon() { if (rTimer) return; rTimer = setTimeout(function () { rTimer = 0; renderAll(); }, 250); }

function loadMaster() {
  setMaster(window.XC_MASTER && window.XC_MASTER.length ? window.XC_MASTER : []);
  try {
    var x = new XMLHttpRequest();
    x.open('GET', 'http://mmb.boost-top.com/ms.php?q=/v1/servers/cstrike&t=' + now(), true);
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || !x.responseText) return;
      var out = [], re = /(?:^|\n)\s*(?:gs|ip)\s+([\d.]+:\d+)/g, m;
      while ((m = re.exec(x.responseText))) out.push(m[1]);
      if (out.length) setMaster(out);
    };
    x.send(null);
  } catch (e) {}
}
function setMaster(list) {
  var seen = {}; MASTER = [];
  each(PINNED.concat(list), function (ip) { ip = normIp(ip); if (ip && !seen[ip]) { seen[ip] = 1; MASTER.push(ip); } });
  if (MASTER.length > 400) MASTER.length = 400;
  if (curModal === 'mdServers' && srvTab === 'internet') each(MASTER, function (ip) { query(ip); });
  renderSoon();
}
function loadScript(src, ok, fail) {
  var done = false, el = document.createElement('script');
  el.src = src;
  var rm = function () { if (el.parentNode) el.parentNode.removeChild(el); };   // har 10 daqiqada yangi teg - eskilari qolib ketmasin
  el.onload = function () { if (!done) { done = true; ok(); } rm(); };
  el.onerror = function () { if (!done) { done = true; fail(); } rm(); };
  setTimeout(function () { if (!done) { done = true; fail(); } }, 6000);
  document.getElementsByTagName('head')[0].appendChild(el);
}
/* boost-top reklama ro'yxatlari.
 * top.php -> window.BOOST_TOP = [{ip, title, type?}, ...]  (TOP tarif; type 'fav'/'gm' bo'lsa - Sevimlilar tarifi)
 * fav.php -> window.BOOST_FAV = [...]  (ixtiyoriy: Sevimlilar tarifini olganlar)
 * Avval nisbiy yo'l (sahifa mmb.boost-top.com dan ochiladi) - o'yin brauzeri zamonaviy https ni ocholmasligi mumkin. */
var PROMO_FAV = [], SVC = {}, SORT_USER = false;
var SVC_ORDER = [['top', 'TOP'], ['boost', 'BOOST'], ['vip', 'VIP']];
function svcAny() { for (var i = 0; i < SVC_ORDER.length; i++) if ((SVC[SVC_ORDER[i][0]] || []).length) return true; return false; }
function svcIps() { var o = []; each(SVC_ORDER, function (g) { each(SVC[g[0]] || [], function (ip) { if (o.indexOf(ip) < 0) o.push(ip); }); }); return o; }
function svcBadges(ip) {
  var h = '';
  each(SVC_ORDER, function (g) { if ((SVC[g[0]] || []).indexOf(ip) >= 0) h += '<span class="svb ' + g[0] + '">' + g[1] + '</span>'; });
  if (srvTab !== 'favs' && PROMO_FAV.indexOf(ip) >= 0) h += '<span class="svb gm">\u2605</span>';
  return h;
}
function setSvc(o) {
  SVC = {};
  for (var k in o) if (o.hasOwnProperty(k) && o[k] && o[k].length != null) { SVC[k] = []; each(o[k], function (ip) { ip = normIp(ip); if (ip && SVC[k].indexOf(ip) < 0) SVC[k].push(ip); }); }
  each(svcIps(), function (ip) { query(ip); });
  renderSoon();
}
function loadList(urls, varName, cb) {
  var n = 0;
  function next() {
    if (n >= urls.length) { cb(null); return; }
    window[varName] = null;
    loadScript(urls[n++] + (urls[n - 1].indexOf('?') < 0 ? '?' : '&') + 't=' + now(), function () {
      if (window[varName] && window[varName].length != null) cb(window[varName]); else next();
    }, next);
  }
  next();
}
/* admin paneldagi "Reklama" serverlari: TOP ro'yxati tepasida ★ bilan, tezkor o'yin ham ularni afzal ko'radi */
var PROMO = [];
function loadPromo() {
  api('promo', {}, function (r) {
    if (!r.ok) return;
    PROMO = [];
    each(r.list || [], function (x) { var ip = itemIp(x); if (!ip) return; PROMO.push(ip); if (x.title) srv(ip).name = srv(ip).name || x.title; if (PINNED.indexOf(ip) < 0) PINNED.push(ip); query(ip); });
    renderSoon();
  });
}
function loadTop() {
  loadPromo();
  loadList(['top.php', 'http://boost-top.com/mmb/top.php', 'https://boost-top.com/mmb/top.php'], 'BOOST_TOP', function (l) { setTop(l || []); });
  loadList(['fav.php'], 'BOOST_FAV', function (l) { if (window.BOOST_SVC) setSvc(window.BOOST_SVC); if (l) setPromoFav(l); });
}
function itemIp(it) { if (typeof it === 'string') it = { ip: it }; var ip = normIp(it && (it.ip || it.addr || it.address)); if (ip && it.title && !srv(ip).name) srv(ip).name = it.title; return ip; }
/* ---- serverlar davlati (geo.php -> ip-api.com) va bayroq (saytdagi media/flags) ---- */
var GEO = {}, GEO_PEND = [], GEO_ASKED = {}, GEO_TM = 0;
try { GEO = JSON.parse(localStorage.getItem('xc_geo') || '{}') || {}; } catch (e) { GEO = {}; }
function hostOf(ip) { return String(ip || '').replace(/:\d+$/, ''); }
function flagOf(ip) {
  var cc = GEO[hostOf(ip)];
  if (!cc || !/^[a-z]{2}$/.test(cc)) { needGeo([ip]); return ''; }
  return '<img class="flg" src="geo.php?flag=' + cc + '" alt="" title="' + cc.toUpperCase() + '">';
}
function needGeo(ips) {
  each(ips, function (ip) { var h = hostOf(ip); if (h && !GEO[h] && !GEO_ASKED[h]) { GEO_ASKED[h] = 1; GEO_PEND.push(h); } });
  if (!GEO_PEND.length || GEO_TM) return;
  GEO_TM = setTimeout(function () {
    GEO_TM = 0;
    var list = GEO_PEND.splice(0, 300), x;
    try { x = new XMLHttpRequest(); x.open('POST', 'geo.php', true); x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); } catch (e) { return; }
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var r = null; try { r = JSON.parse(x.responseText); } catch (e) {}
      if (!r) return;
      var n = 0;
      for (var h in r) if (r.hasOwnProperty(h) && /^[a-z]{2}$/.test(r[h])) { GEO[h] = r[h]; n++; }
      if (n) { try { localStorage.setItem('xc_geo', JSON.stringify(GEO)); } catch (e) {} renderSoon(); }
      if (GEO_PEND.length) needGeo([]);
    };
    x.send('ips=' + encodeURIComponent(list.join(',')));
  }, 400);
}
/* server qatori: bayroq + nom (kerak bo'lsa "...") + belgilar */
function c1row(s, name, badges) {
  var w = 300, re = /<span class="(?:svb|vb|xb)[^"]*">([^<]*)<\/span>/g, m;   // har belgi: ~9px harf + chekka
  while ((m = re.exec(badges))) w -= m[1].length * 9 + 16;
  return '<span class="c1">' + flagOf(s.ip) + '<span class="snm" style="max-width:' + Math.max(110, w) + 'px">' + esc(name) + '</span>' + badges + '</span>';
}
function setTop(list) {
  TOP = []; var fav = [];
  each(list || [], function (it) {
    var ip = itemIp(it); if (!ip) return;
    if (it && /^[a-z]{2}$/i.test(it.cc || '')) GEO[hostOf(ip)] = String(it.cc).toLowerCase();
    var tp = String((it && (it.type || it.tariff || it.t)) || '').toLowerCase();
    if (/fav|sevim|gm|izbr/.test(tp)) fav.push(ip); else TOP.push(ip);
  });
  if (fav.length) setPromoFav(fav, true);
  each(TOP, function (ip) { query(ip); });
  renderSoon();
}
function setPromoFav(list, already) {
  PROMO_FAV = [];
  each(list, function (it) { var ip = already ? it : itemIp(it); if (ip && PROMO_FAV.indexOf(ip) < 0) PROMO_FAV.push(ip); });
  each(PROMO_FAV, function (ip) { query(ip); });
  renderSoon();
}

/* sevimli serverda joy bo'shashi + navbat */
var QUEUE_IP = '', QUEUE_TM = 0;
function onSrvUpdate(s) {
  if (QUEUE_IP === s.ip && s.ok && !isFull(s)) { var ip = QUEUE_IP; stopQueue(); toast(T('queue_free')); sfx('save'); doConnect(ip); }
  else if (QUEUE_IP === s.ip) queueBar();
  if (isFavIp(s.ip) && DB.notifyFav !== 0 && s.prevPl != null && s.max && s.prevPl >= s.max && s.pl < s.max && CONNECTED !== s.ip)
    toast(T('fav_free') + s.name, 5000);
}
function startQueue(ip) {
  stopQueue(); QUEUE_IP = ip; toast(T('queue'), 6000);
  var qn = 0;
  QUEUE_TM = setInterval(function () { if (!playing() || ++qn % 4 === 0) query(QUEUE_IP, true); }, 4000);   // o'yin paytida 16 s da bir (so'rov o'yinni qotiradi)
  queueBar();
}
function stopQueue() { QUEUE_IP = ''; clearInterval(QUEUE_TM); queueBar(); }
/* navbat ko'rinib tursin: pastda "Navbatda: server - 32/32 - Bekor qilish" */
function queueBar() {
  var b = $('qbar');
  if (!QUEUE_IP) { if (b) b.style.display = 'none'; return; }
  if (!b) { b = document.createElement('div'); b.id = 'qbar'; (document.getElementById('app') || document.body).appendChild(b); }
  var s = srv(QUEUE_IP);
  b.innerHTML = ico('clock') + ' ' + esc(T('q_wait')) + ' <b>' + esc(s.name || QUEUE_IP) + '</b>' + (s.ok ? ' \u00b7 ' + s.pl + '/' + s.max : '') + ' <a data-act="qstop">' + esc(T('q_stop')) + '</a>';
  b.style.display = 'block';
}

/* ============================================================ ulanish, tarix, K/D */
var CONNECTED = '', CUR = null;                 // CUR: joriy o'yin (tarix yozuvi)
function connect(ip) {
  ip = normIp(ip);
  if (!ip) return;
  if (S.queue && isFull(srv(ip))) { startQueue(ip); return; }
  stopQueue();
  doConnect(ip);
}
/* server parollari (VIP/admin, setinfo _pw): akkauntda saqlanadi, faqat SHU serverga ulanishdan oldin qo'yiladi.
 * Boshqa serverga ulanganda maydon tozalanadi - parol begona serverlarga yuborilmasin */
var PW_SET = {};
function srvPw(ip) { var r = null; each(DB.pw || [], function (x) { if (x.ip === ip) r = x; }); return r; }
function applyPw(ip) {
  var p = srvPw(ip);
  for (var f in PW_SET) if (PW_SET.hasOwnProperty(f) && (!p || p.f !== f)) { cmd('setinfo ' + f + ' ""'); delete PW_SET[f]; }
  if (p) { cmd('setinfo ' + p.f + ' ' + q(p.pw)); PW_SET[p.f] = 1; }
}
function doConnect(ip) {
  applyPw(ip);
  toast(T('connecting') + (srv(ip).name || ip));
  if (!cmd('connect ' + ip)) toast(T('no_api'));
  else startGame(ip);
}
function startGame(ip) {
  var h = DB.hist[0];
  if (h && h.ip === ip && now() - h.t < 90000) { CUR = h; return; }
  var s = srv(ip);
  CUR = { ip: ip, name: s.name || ip, map: s.map || '', t: now(), d: 0, k: 0, x: 0 };
  XP0 = ME ? ME.xp : null;
  DB.hist.unshift(CUR);
  if (DB.hist.length > 300) DB.hist.length = 300;
  persist(); renderSoon(); cloudSave();
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
/* Demo yozish: o'yinchi serverga to'liq kirgach ('putinserver') boshlanadi - ulanish/yuklanish paytida
 * "record" ishlamaydi. Ro'yxatga faqat konsolda "Recording to ..." chiqqanda qo'shiladi (konsol API bo'lmasa - darhol). */
var REC = '', REC_TM = 0;
function demoName() { var d = new Date(); return 'xc_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }
function demoAdd(nm) {
  if (!nm || (DB.demos && DB.demos[0] && DB.demos[0].n === nm)) return;
  var sv = srv(CONNECTED);
  DB.demos = [{ n: nm, s: sv.name || CONNECTED, m: sv.map || '', t: now() }].concat(DB.demos || []).slice(0, 30); persist();
}
function startRecord(delay) {
  clearTimeout(REC_TM);
  REC_TM = setTimeout(function () {
    if (!S.demo || !CONNECTED || REC) return;
    REC = demoName();
    cmd('record ' + REC);
    var nm = REC; setTimeout(function () { if (REC === nm) demoAdd(nm); }, 8000);   // konsol javobi kelmasa ham (xato yo'q bo'lsa) ro'yxatga
  }, delay);
}
/* mikrofon: birinchi bosishda o'yin ovoz yozish qurilmasini ochadi - ba'zi kompyuterlarda 2-3 soniya qotadi.
 * Serverga kirgach (xarita yuklangach) qurilmani bir marta oldindan ochib qo'yamiz - gapirganda qotmaydi. */
function voiceWarm() {
  if (!S || S.voice === 0 || S.micwarm === 0) return;
  setTimeout(function () { if (CONNECTED && !uiShown()) { cmd('+voicerecord'); setTimeout(function () { cmd('-voicerecord'); }, 120); } else if (CONNECTED) setTimeout(voiceWarm, 15000); }, 20000);
}
/* Demo ko'rish boshqaruvi: F6 pauza, F7 sekinroq, F8 tezroq, F9 oddiy tezlik. Tezlik host_framerate bilan
 * (har kadr demo vaqtini belgilangan miqdorda suradi; 1/fps_max = oddiy tezlik). Tugmalar faqat demo paytida bog'lanadi,
 * tugagach (yoki serverga ulanganda) host_framerate 0 va o'yinchining tugmalari qaytariladi - onlayn o'yinga ta'sir qilmasin. */
var DEMO_END_T = 0, DEMO_PLAY = false, DEMO_KEYS = ['F6', 'F7', 'F8', 'F9'], DEMO_CUR = '', DEMO_SPD = 2, DEMO_PAUSE = false;
var DEMO_SP = [0.25, 0.5, 1, 2, 4, 8];
function demoPlay(nm) {
  nm = String(nm || '').replace(/[^\w\-]/g, '');
  if (!nm) return;
  var f = 1 / Math.max(30, Math.min(1000, Number(S && S.fps) || 100)), sp = DEMO_SP, vol = S && S.vol != null ? S.vol : 0.8;
  for (var i = 0; i < sp.length; i++) {
    var hf = sp[i] === 1 ? 0 : Math.round(f * sp[i] * 1e6) / 1e6;
    /* 1x dan boshqa tezlikda ovoz o'chiriladi: o'yin ovozi vaqtga bog'langan - pauza/sekinda oxirgi tovush takrorlanib qoladi */
    var snd = sp[i] === 1 ? 'volume ' + vol : 'volume 0; stopsound';
    cmd('alias xcd_' + i + ' "host_framerate ' + hf + '; ' + snd + '; alias xcd_up xcd_' + Math.min(i + 1, sp.length - 1) + '; alias xcd_dn xcd_' + Math.max(i - 1, 0) +
      '; alias xcd_p xcd_pz; alias xcd_back xcd_' + i + '; echo X CLIENT demo: ' + sp[i] + 'x"');
  }
  cmd('alias xcd_pz "host_framerate 0.000001; volume 0; stopsound; alias xcd_p xcd_back; echo X CLIENT demo: pauza (F6 - davom)"');
  cmd('xcd_2');
  cmd('bind F6 xcd_p'); cmd('bind F7 xcd_dn'); cmd('bind F8 xcd_up'); cmd('bind F9 xcd_2');
  if (QUEUE_IP) stopQueue();                         // navbat demo paytida serverga ulab yubormasin
  cmd('cl_filterstuffcmd 1');                        // demo ichiga yozilgan server buyruqlari (connect/retry/disconnect) demoni yopmasin
  DB.dplay = { n: nm, t: now() }; persist();         // menyu sahifasi demo paytida qayta yuklansa ham holat saqlansin
  DEMO_PLAY = true; DEMO_CUR = nm; DEMO_SPD = 2; DEMO_PAUSE = false;
  cmd('echo X CLIENT demo: F6 pauza, F7 sekinroq, F8 tezroq, F9 oddiy tezlik, F10 video yozish');
  cmd('mp3 stop'); MUSIC_ON = false;
  cmd('playdemo ' + nm);
}
function demoEnd(why) {
  if (DEMO_PLAY) cmd('echo [X CLIENT] demo tugadi: ' + (why || '?'));
  cmd('host_framerate 0');
  if (!DEMO_PLAY) return;
  cmd('volume ' + (S && S.vol != null ? S.vol : 0.8));
  DEMO_PLAY = false; DEMO_PAUSE = false; DEMO_END_T = now();
  if (DB.dplay) { DB.dplay = null; persist(); }
  for (var i = 0; i < DEMO_KEYS.length; i++) cmd('unbind ' + DEMO_KEYS[i]);
  applyBinds();
  setTimeout(musicSync, 1500);
}
/* F10 videolari ro'yxati saytdan (launcher har video saqlanganda va har ochilishda yangilaydi) */
var VIDS_T = 0;
function vidsRefresh() {
  if (!PCID || now() - VIDS_T < 4000) return;
  VIDS_T = now();
  api('opts', { d: PCID }, function (r) {
    if (!r.ok || !r.o) return;
    OPTS.vids = r.o.vids || [];
    if (curModal === 'mdSettings' && setTab === 'demo') $('setBody').innerHTML = PANES.demo();
  });
}
function vidCmd(c, n, extra, quiet) {
  if (!PCID) { if (!quiet) toast(T('sy_nolaunch'), 4000); return; }
  var prm = { d: PCID, c: c, n: n || '' };
  if (extra) for (var ek in extra) if (extra.hasOwnProperty(ek)) prm[ek] = extra[ek];
  api('vcmd', prm, function (r) {
    if (!r.ok) { if (!quiet) toast(r.msg || 'Xato', 3500); return; }
    if (r.vids) OPTS.vids = r.vids;
    if (c === 'trim') { setTimeout(function () { VIDS_T = 0; vidsRefresh(); }, 8000); setTimeout(function () { VIDS_T = 0; vidsRefresh(); }, 20000); }
    if (!quiet) toast(T({ del: 'vd_deleted', open: 'vd_opening', folder: 'vd_opening2', trim: 'vd_trimming', opt: 'vb_saved', edit: 'vd_editing', share: 'vs_wait' }[c] || 'saved'), c === 'share' ? 7000 : 5000);
    if (curModal === 'mdSettings' && setTab === 'demo') $('setBody').innerHTML = PANES.demo();
  });
}
/* avtomatik klip: 12 soniya ichida 3+ kill - launcher buferidan oxirgi 30 soniya saqlanadi (launcher buyruqni 4 soniyada oladi) */
var KILLT = [], ACL_T = 0;
function autoClipKill() {
  var t = now();
  KILLT.push(t); while (KILLT.length && t - KILLT[0] > 12000) KILLT.shift();
  if (KILLT.length < 3 || DB.acl === 0 || !(OPTS && OPTS.rb) || !PCID || t - ACL_T < 25000) return;
  ACL_T = t; KILLT = [];
  setTimeout(function () { vidCmd('clip', '', null, true); }, 3000);   // kill'dan keyingi lahzalar ham tushsin
}
function mmss(v) { var m = /^\s*(\d+)(?::(\d{1,2}))?\s*$/.exec(String(v || '')); return m ? (m[2] != null ? +m[1] * 60 + +m[2] : +m[1]) : -1; }
/* demolar ro'yxati: launcher haqiqiy fayllarni beradi (OPTS.dmf) - o'chirilganlar chiqmaydi, menyu yozib ulgurmaganlari ham ko'rinadi.
 * Launcher eski bo'lsa (dmf yo'q) - menyu o'zi eslab qolgan ro'yxat */
var MENU_T0 = now(), DEMO_SEL = '';
function demoItems() {
  var db = DB.demos || [], f = OPTS && OPTS.dmf;
  if (!f || typeof f.length !== 'number') return db;
  var by = {}, out = [], seen = {};
  each(db, function (d) { by[d.n] = d; });
  each(f, function (n) {
    if (seen[n]) return; seen[n] = 1;
    var m = /^xc_(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)$/.exec(n);
    out.push(by[n] || { n: n, s: 'Demo', m: '', t: m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0 });
  });
  each(db, function (d) { if (!seen[d.n] && d.t >= MENU_T0 - 60000) { out.unshift(d); seen[d.n] = 1; } });   // shu safar yozilgan - launcher hali bilmaydi
  out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
  return out;
}
/* Demo bo'limidagi pult: menyu tugmalari F6-F9 bilan bir xil aliaslarni chaqiradi */
function demoCtl(c) {
  if (!DEMO_PLAY) {                                  // to'xtatilgan: ▶ - tanlangan (yoki eng yangi) demoni ochadi
    var it = demoItems(), nm = DEMO_SEL || (it[0] && it[0].n);
    if ((c === 'n' || c === 'p') && nm) { closeModal(); demoPlay(nm); return; }
    toast(T(it.length ? 'dm_first' : 'dm_none'), 3500); return;
  }
  if (c === 'stop') { demoEnd('stop tugmasi'); cmd('disconnect'); }
  else if (c === 'p') { cmd('xcd_p'); DEMO_PAUSE = !DEMO_PAUSE; }
  else if (c === 'dn') { DEMO_SPD = Math.max(0, DEMO_SPD - 1); DEMO_PAUSE = false; cmd('xcd_' + DEMO_SPD); }
  else if (c === 'up') { DEMO_SPD = Math.min(DEMO_SP.length - 1, DEMO_SPD + 1); DEMO_PAUSE = false; cmd('xcd_' + DEMO_SPD); }
  else if (c === 'n') { DEMO_SPD = 2; DEMO_PAUSE = false; cmd('xcd_2'); }
  if (curModal === 'mdSettings' && setTab === 'demo') showSetTab('demo');
}
function stopRecord() { clearTimeout(REC_TM); if (REC) { cmd('stop'); REC = ''; } }
function onConnectEvt(addr, inGame) {
  addr = normIp(addr);
  if (!addr) return;
  /* demo ham "ulanish" hodisasini beradi (yozilgan server manzili bilan) - bu o'yin emas: statistika, demo yozish, musiqa o'chirish kerak emas */
  if (DEMO_PLAY) return;
  cmd('host_framerate 0');          // demo o'zi ham ulanish hodisasini berishi mumkin - demo paytida tegmaymiz (serverga ulanish 'Connecting to' bilan ushlanadi)
  if (QUEUE_IP && addr !== QUEUE_IP && addr !== CONNECTED) stopQueue();   // hozirgi serverning o'z hodisalari (xarita almashishi) bekor qilmaydi   // boshqa serverga (konsol, o'yin ro'yxati) kirildi - navbat bekor
  if (addr !== CONNECTED) { CONNECTED = addr; MUSIC_ON = null; if (!inGame) applyPw(addr); startGame(addr); musicSync();   // serverda mp3 chalinmasin: o'yin ovozlarini bo'g'adi
    pingPresence(); renderAll(); sparks(); voiceWarm(); }
  if (S.demo) startRecord(inGame ? 1500 : 25000);   // 'connect' dan keyin 'putinserver' kelmasa ham 25 soniyadan so'ng urinamiz
}
function onDisconnectEvt() {
  var was = CONNECTED;
  setTimeout(musicSync, 500);
  if (CUR) { CUR.d = Math.round((now() - CUR.t) / 1000); persist(); cloudSave(); sendStat(CUR); }
  stopRecord();
  var fin = CUR;
  if (fin && !DEMO_PLAY) { VIDS_T = 0; setTimeout(vidsRefresh, 2000); }
  if (fin && !DEMO_PLAY) setTimeout(function () { if (!CONNECTED && !DEMO_PLAY) gameSummary(fin); }, 5000);   // qayta ulanish bo'lmasa - xulosa
  CUR = null;                                        // demo ko'rganda konsoldagi kill'lar oxirgi o'yinga qo'shilmasin
  CONNECTED = ''; renderAll(); pingPresence(); sparks();
  // o'yinchi o'zi menyudan chiqmagan bo'lsa (menyu yopiq) - qayta ulanamiz
  var shown = false;
  shown = uiShown();
  /* demo ochilganda ham o'yin serverdan uziladi - bu tarmoq uzilishi emas: qayta ulanmaymiz (aks holda 3 soniyada demo yopilardi) */
  var demo = DEMO_PLAY || now() - DEMO_END_T < 8000;
  if (S.reconn && was && !shown && !demo) setTimeout(function () { if (!CONNECTED && !DEMO_PLAY) cmd('retry'); }, 3000);
}
/* konsoldan o'ldirish/o'lish hisobi: "Player1 killed Player2 with ak47" */
var MYNAME = '', CONLOG = [];
function onConsole(txt) {
  txt = String(txt || '');
  CONLOG.push(txt); if (CONLOG.length > 400) CONLOG.shift();
  var r = /Recording to (\S+?)(?:\.dem)?\.?\s*$/i.exec(txt);
  if (r && REC && r[1].indexOf(REC) === 0) demoAdd(REC);
  else if (REC && /(can'?t|cannot|not) record|must be connected/i.test(txt)) { REC = ''; if (S.demo && CONNECTED) startRecord(10000); }   // erta bo'ldi - keyinroq qayta
  /* demo tugadi yoki serverga ulanyapti - oddiy tezlik. Faqat aniq qatorlar: "Couldn't open file overviews/..." (radar xaritasi) demo xatosi emas */
  if (DEMO_PLAY) { var dm = /^\s*Completed demo|^\s*ERROR: couldn'?t open\.?\s*$|^\s*Connecting to/i.exec(txt); if (dm) demoEnd(dm[0]); }
  if (/\b(wrote|writing|saved)\b.*\.(bmp|tga|jpg|png)\b/i.test(txt)) toast(T('sh_saved'), 2500);   // F5: skrinshot saqlandi
  if (!CUR || !MYNAME) return;
  /* "A killed B with ak47", "*** A killed B with a headshot from ak47 ***", "A + C killed B with m4a1" (C - yordam bergan) */
  var m = /^(.+?) killed (.+?) with (a headshot from )?([\w\-]+)/.exec(txt.replace(/^\s*(\*\*\*\s*)?/, ''));
  if (!m) return;
  var kp = m[1].split(' + '), killer = kp.length === 2 && kp[0] !== MYNAME && m[1] !== MYNAME ? kp[0] : m[1];
  if (m[1] !== MYNAME && kp.length === 2 && kp[0] === MYNAME) killer = MYNAME;
  if (killer === MYNAME && m[2] !== MYNAME) { autoClipKill();
    CUR.k = (CUR.k || 0) + 1; CUR.w = CUR.w || {}; CUR.w[m[4]] = (CUR.w[m[4]] || 0) + 1;
    if (m[3]) CUR.h = (CUR.h || 0) + 1;
    CUR.s = (CUR.s || 0) + 1; if (CUR.s > (CUR.bs || 0)) CUR.bs = CUR.s; persist(); }
  else if (m[2] === MYNAME) { CUR.x = (CUR.x || 0) + 1; CUR.s = 0; persist(); }
  else if (kp.length === 2 && kp[1] === MYNAME) { CUR.a = (CUR.a || 0) + 1; persist(); }
}
function bestServer() {
  var best = null;
  // do'stlar o'ynayotgan server, past ping va o'yinchi ko'pligi ustun
  function score(s) { return (isX(s) ? 1000 : 0) + friendsAt(s.ip).length * 300 + Math.min(s.pl || 0, 28) * 10 - (s.ping || 300) / 4; }
  for (var ip in SRV) {
    var s = SRV[ip];
    if (!s.ok || s.pass || isFull(s)) continue;
    if (!best || score(s) > score(best)) best = s;
  }
  return best;
}
function quick() { var b = bestServer(); if (b) connect(b.ip); else toast(T('no_srv')); }

/* ============================================================ bosh ekran */
function pbar(s) { var p = s.max ? Math.min(100, Math.round(s.pl * 100 / s.max)) : 0; return '<span class="pbar"><i style="width:' + p + '%"></i></span>'; }
function renderHome() {
  var b = CONNECTED ? srv(CONNECTED) : bestServer();
  // turnir kartasi
  // X TOP serverlar
  var html = '', list = PROMO.concat((TOP.length ? TOP : PINNED).filter(function (ip) { return PROMO.indexOf(ip) < 0; }));
  each(list.slice(0, 5), function (ip, i) {
    var s = srv(ip);
    var meta = s.ok ? pbar(s) + s.pl + '/' + s.max + ' \u00b7 ' + esc(s.map) : (s.fail ? T('offline') : esc(ip));
    html += '<div class="tr' + (i === 0 ? ' r1' : '') + '" data-ip="' + esc(ip) + '"><div class="rk">' + (i + 1) + '</div>' +
      '<div class="nm">' + (PROMO.indexOf(ip) >= 0 ? '<span class="crown">\u2605</span>' : '') + flagOf(ip) + esc(s.name || ip) + '</div><div class="mt">' + meta + '</div>' +
      '<div class="go">' + esc(T('join')) + '</div></div>';
  });
  $('topList').innerHTML = html || '<div class="empty">' + esc(T('no_top')) + '</div>';
  // TOP hafta
  var wk = '';
  each(WEEK.slice(0, 3), function (u, i) {
    wk += '<div class="tr' + (i === 0 ? ' r1' : '') + '" data-act="stats"><div class="rk">' + (i + 1) + '</div>' +
      '<div class="nm one">' + crown(u) + esc(u.name) + '</div>' +
      '<div class="sc">' + u.k + ' <small>kill \u00b7 K/D ' + u.kd + '</small></div></div>';
  });
  if (CHAMP && CHAMP.name) wk += '<div class="mut" style="font-size:12px;padding:6px 2px 0">\u265b ' + esc(T('ch_last').replace('{n}', CHAMP.name).replace('{k}', CHAMP.k)) + '</div>';
  $('weekList').innerHTML = wk || '<div class="empty">' + esc(T('no_week')) + '</div>';
  // do'stlar onlayn
  var fr = '', on = 0;
  each(FRIENDS, function (f) {
    if (!f.online) return;
    on++;
    if (on > 3) return;
    var s = f.server ? srv(f.server) : null;
    fr += '<div class="tr"' + (f.server ? ' data-ip="' + esc(f.server) + '"' : ' style="cursor:default"') + '><div class="rk c av2" style="' + avStyle(f) + '">' + avInner(f, f.name) + '</div>' +
      '<div class="nm">' + crown(f) + esc(f.name) + '</div><div class="mt"><span class="gm">\u25cf</span> ' + esc(f.server ? ((s && s.name) || f.server) + (f.map ? ' \u00b7 ' + f.map : '') : T('fr_menu')) + '</div>' +
      (f.server ? '<div class="go">' + esc(T('join')) + '</div>' : '') + '</div>';
  });
  $('frList').innerHTML = fr || '<div class="empty">' + (ME ? esc(T('no_fr')) : '<a data-act="login">' + esc(T('no_fr_login')) + '</a>') + '</div>';
  $('acct').style.display = ME || DB.acx ? 'none' : ''; var xp = $('xpromo'); if (xp) xp.style.display = DB.pxx && now() - DB.pxx < 7 * 864e5 ? 'none' : ''; $('frCard').style.display = ME ? '' : 'none';
  $('frCnt').innerHTML = on ? on : '';
  $('mFriends').innerHTML = on ? esc(T('fr_on').replace('{n}', on)) : '';
  renderBar();
}
/* avatar: rasm bo'lsa rasm, bo'lmasa ism harfi + tanlangan rang */
function avStyle(u) { return u && /^#[0-9a-fA-F]{6}$/.test(u.avc || '') ? 'background:' + u.avc + ';' : ''; }
function avInner(u, name) {
  if (u && u.av) return '<img src="' + esc(u.av) + '" alt="">';
  return esc(String(name || (u && u.name) || 'X').charAt(0).toUpperCase() || 'X');
}
/* ---- admin paneldagi e'lonlar: bosh menyuning o'ng ustuni tepasida ---- */
var ANN = [];
function loadAnn() { api('news', {}, function (r) { ANN = r.ok && r.ann ? r.ann : []; renderAnn(); }); }
function renderAnn() {
  var el = $('ann'); if (!el) return;
  var hid = DB.annHide || [], a = null;
  each(ANN, function (x) { if (!a && hid.indexOf(x.id) < 0) a = x; });
  if (!a) { el.style.display = 'none'; return; }
  el.className = 'card ann ' + (/^(info|warn|promo)$/.test(a.type) ? a.type : 'info');
  el.innerHTML = '<div class="anh">' + esc(T('an_title')) + '<a class="anx" data-annx="' + esc(a.id) + '">✕</a></div><div class="ant">' + esc(a.text) + '</div>';
  el.style.display = '';
}
function renderBar() {
  each(['miResume', 'miPlist', 'miDisc'], function (id) { var e = $(id); if (e) e.style.display = CONNECTED ? '' : 'none'; });   // serverda: o'yinga qaytish, o'yinchilar, chiqish - menyuning tepasida
  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('bOnline').innerHTML = on; $('bServers').innerHTML = cnt || MASTER.length;
  var nm = ME ? ME.name : ((S && S.name) || T('guest_name'));
  $('meName').innerHTML = ME ? nickHtml(ME, nm) : esc(nm);
  var mc = $('mChest'); if (mc) { var cn = ME && ME.chests ? ME.chests : 0; mc.innerHTML = cn ? String(cn) : ''; mc.style.display = cn ? 'inline-block' : 'none'; }
  $('meAv').innerHTML = avInner(ME, nm); $('meAv').style.cssText = avStyle(ME); $('meAv').className = 'av' + frameCls(ME);
  $('meLvl').innerHTML = ME ? esc(T('lvl').replace('{n}', ME.level)) : '';
  $('meXp').style.width = ME ? Math.round(ME.lvlxp * 100 / (ME.lvlmax || 1000)) + '%' : '0';
  $('meVip').style.display = ME && ME.vip ? '' : 'none';
  $('bCloud').innerHTML = !ME && !CONNECTED ? '<a class="lgin" data-act="login">' + esc(T('ac_short')) + ' \u2192</a>' : esc(CONNECTED ? T('st_in') + (srv(CONNECTED).name || CONNECTED) : (ME.cloudt ? T('b_saved') : ''));
  $('bVer').innerHTML = esc((VERSION ? 'v' + VERSION + ' \u00b7 ' : '') + 'X CLIENT');
}

/* ============================================================ KIRISH ekrani */
var lgReg = false;
function openLogin() { openModal('mdLogin'); renderLoginForm(); setTimeout(function () { try { $('lgLogin').focus(); } catch (e) {} }, 50); }
function renderLoginForm() {
  $('lgTitle').innerHTML = esc(T(lgReg ? 'lg_reg' : 'lg_title'));
  $('lgGo').innerHTML = esc(T(lgReg ? 'lg_regbtn' : 'lg_go'));
  $('lgSwitch').innerHTML = esc(T(lgReg ? 'lg_tolog' : 'lg_toreg'));
  $('lgEmail').style.display = $('lgEmailL').style.display = lgReg ? '' : 'none';
  $('lgErr').innerHTML = '';
}
function doLogin() {
  var lg = $('lgLogin').value.replace(/^\s+|\s+$/g, ''), pw = $('lgPass').value;
  $('lgErr').innerHTML = esc(T('lg_wait'));
  api(lgReg ? 'register' : 'login', lgReg ? { login: lg, pass: pw, email: $('lgEmail').value } : { login: lg, pass: pw }, function (r) {
    if (!r.ok) { $('lgErr').innerHTML = esc(r.msg || 'Xato'); return; }
    $('lgPass').value = '';
    DB.forget = $('lgRemember').className.indexOf('on') >= 0 ? 0 : 1;
    afterLogin(r);
  });
}

/* parolni tiklash: login/email -> emailga kod -> kod + yangi parol */
function forgot() {
  ask(T('rs_ask'), function (who) {
    who = String(who || '').replace(/^\s+|\s+$/g, '');
    if (!who) return;
    toast(T('lg_wait'));
    api('reset_req', { login: who }, function (r) {
      if (!r.ok) return toast(r.msg || 'Xato', 7000);
      toast(T('rs_sent').replace('{e}', r.email), 7000);
      ask(T('rs_code').replace('{e}', r.email), function (code, np) {
        api('reset_do', { login: r.login, code: code, newpass: np }, function (r2) {
          if (!r2.ok) return toast(r2.msg || 'Xato', 6000);
          DB.forget = 0;
          afterLogin(r2);
          toast(T('rs_ok'), 5000);
        });
      }, true, false, false, true);
    });
  });
}

/* ============================================================ SERVERLAR oynasi */
var srvTab = 'internet', srvSel = '', srvSort = 'pl', srvDesc = true;
var FLT = { ping: false, notempty: false, notfull: false };
function openServers(tab) { openModal('mdServers'); setSrvTab(tab || 'internet'); each(tabIps(), function (ip) { query(ip, true); }); }
function setSrvTab(tab) {
  if (tab !== srvTab) SORT_USER = false;
  srvTab = tab;
  each(document.querySelectorAll('#srvTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  if (tab === 'friends') loadFriends();
  var ips = tabIps();
  each(ips, function (ip) { query(ip); });
  if (!srvSel || ips.indexOf(srvSel) < 0) srvSel = ips[0] || '';
  if (srvSel) loadPlayers(srvSel);
  renderServers();
}
function tabIps() {
  if (srvTab === 'favs') { var fv = PROMO_FAV.slice(); each(DB.fav, function (ip) { if (fv.indexOf(ip) < 0) fv.push(ip); }); return fv; }
  if (srvTab === 'top') return TOP.slice();
  if (srvTab === 'friends') { var o = []; each(FRIENDS, function (f) { if (f.server && o.indexOf(f.server) < 0) o.push(f.server); }); return o; }
  if (srvTab === 'history') { var seen = {}, out = []; each(DB.hist, function (h) { if (!seen[h.ip]) { seen[h.ip] = 1; out.push(h.ip); } }); return out; }
  var net = svcIps(); each(MASTER, function (ip) { if (net.indexOf(ip) < 0) net.push(ip); }); return net;
}
function histOf(ip) { for (var i = 0; i < DB.hist.length; i++) if (DB.hist[i].ip === ip) return DB.hist[i]; return null; }
function friendsAt(ip) { var n = []; each(FRIENDS, function (f) { if (f.server === ip) n.push(f.name); }); return n; }
/* ---- o'z dropdown'imiz ---- */
var FMAP = '', FMODE = '', DD = null;
function ddItems(kind) {
  var out = [], maps = {}, keys = [], ip, m;
  if (kind === 'map') {
    for (ip in SRV) if (SRV[ip].ok && SRV[ip].map) maps[SRV[ip].map] = 1;
    for (m in maps) keys.push(m);
    keys.sort();
    out.push(['', T('f_map')]);
    each(keys, function (mp) { out.push([mp, mp]); });
  } else if (kind === 'mode') {
    out.push(['', T('f_mode')]);
    each(['classic', 'zm', 'awp', 'aim', 'dm', 'gg', 'jail', 'kz', 'other'], function (k) { out.push([k, T('md_' + k)]); });
  } else if (kind === 'xpre') {
    each(XPRE, function (p) { out.push([p[0], T(p[1])]); });
  } else if (kind === 'xsz') {
    each(SZ, function (z, i) { out.push([z, 'x' + (i + 1)]); });
  } else if (kind === 'res') {
    out.push(['', T('sy_res_auto')]);
    var sw = screen.width || 1920, sh = screen.height || 1080, seen = {};
    each([sw + 'x' + sh, '1920x1080', '1680x1050', '1600x900', '1440x900', '1366x768', '1280x1024', '1280x960', '1280x720', '1024x768', '800x600'], function (r) {
      if (!seen[r]) { seen[r] = 1; out.push([r, r.replace('x', ' \u00d7 ')]); }
    });
  }
  return out;
}
function ddValue(kind) { return kind === 'map' ? FMAP : kind === 'mode' ? FMODE : kind === 'xpre' ? E.xp : kind === 'xsz' ? E.xs : OPTS.res || ''; }
function ddLabel(kind) {
  var v = ddValue(kind), items = ddItems(kind);
  for (var i = 0; i < items.length; i++) if (items[i][0] === v) return items[i][1];
  return v || items[0][1];
}
function ddOpen(el) {
  var kind = el.getAttribute('data-dd'), list = $('ddList'), h = '', v = ddValue(kind);
  if (DD === kind && list.style.display === 'block') { ddClose(); return; }
  DD = kind;
  each(ddItems(kind), function (it) { h += '<a class="' + (it[0] === v ? 'on' : '') + '" data-ddv="' + esc(it[0]) + '">' + esc(it[1]) + '</a>'; });
  list.innerHTML = h;
  // joylashuv: element ostida (#app koordinatalarida)
  var x = 0, y = 0, n = el;
  while (n && n.id !== 'app') { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  list.style.left = x + 'px'; list.style.top = (y + el.offsetHeight + 2) + 'px'; list.style.width = Math.max(170, el.offsetWidth) + 'px';
  list.style.display = 'block';
}
function ddClose() { DD = null; $('ddList').style.display = 'none'; }
function ddPick(v) {
  var kind = DD; ddClose();
  if (kind === 'map') { FMAP = v; renderServers(); }
  else if (kind === 'mode') { FMODE = v; renderServers(); }
  else if (kind === 'res') { OPTS.res = v; saveOpts(); showSetTab(setTab); }
  else if (kind === 'xpre') { each(XPRE, function (p) { if (p[0] === v) { E.xp = v; E.xt = p[2]; E.xs = p[3]; } }); showSetTab('hud'); }
  else if (kind === 'xsz') { E.xs = v; E.xp = presetOf(E); showSetTab('hud'); }
}
function fillSelects() {
  $('fMap').getElementsByTagName('span')[0].innerHTML = esc(ddLabel('map'));
  $('fMode').getElementsByTagName('span')[0].innerHTML = esc(ddLabel('mode'));
}
function renderServers() {
  if (curModal !== 'mdServers') return;
  var isHist = srvTab === 'history', isFav = srvTab === 'favs', isFr = srvTab === 'friends', isNet = srvTab === 'internet';
  $('favCnt').innerHTML = DB.fav.length ? '(' + DB.fav.length + ')' : '';
  $('h5').innerHTML = esc(isHist || isFav ? T('h_last') : isFr ? T('h_friend') : '');
  $('h6').innerHTML = esc(isHist ? T('h_res') : '');
  $('quickBtn').style.display = isNet ? '' : 'none';
  $('addIpBtn').style.display = isFav ? '' : 'none';
  $('favNote').style.display = isFav && ME ? '' : 'none';
  $('clearHist').style.display = isHist ? '' : 'none';
  $('fMap').style.display = $('fMode').style.display = isNet ? '' : 'none';
  each(document.querySelectorAll('#srvTools .chip'), function (c) { c.style.display = isFav || isHist ? 'none' : ''; c.className = 'chip' + (FLT[c.getAttribute('data-flt')] ? ' on' : ''); });
  fillSelects();
  var extraH = isHist ? 80 : isFav ? 150 : 0;
  $('srvList').style.bottom = (10 + extraH) + 'px';
  $('srvExtra').style.height = extraH ? (extraH - 10) + 'px' : '0';

  var qs = ($('srvSearch').value || '').toLowerCase(), fmap = FMAP, fmode = FMODE;
  var rows = [];
  each(tabIps(), function (ip) {
    var s = srv(ip);
    if (isNet && !s.ok) return;
    if (qs && ((s.name || '') + ' ' + ip + ' ' + (s.map || '')).toLowerCase().indexOf(qs) < 0) return;
    if (isNet && fmap && s.map !== fmap) return;
    if (isNet && fmode && modeOf(s) !== fmode) return;
    if (!isFav && !isHist) {
      if (FLT.ping && !(s.ok && s.ping < 50)) return;
      if (FLT.notempty && !(s.pl > 0)) return;
      if (FLT.notfull && isFull(s)) return;
    }
    rows.push(s);
  });
  if (!isHist) {
    rows.sort(function (a, b) {
      if (isFav) { var pa = PROMO_FAV.indexOf(a.ip) >= 0, pb = PROMO_FAV.indexOf(b.ip) >= 0; if (pa !== pb) return pa ? -1 : 1; }
      if (srvTab === 'top') return TOP.indexOf(a.ip) - TOP.indexOf(b.ip);   // reklama tartibi saqlanadi
      if (isX(a) !== isX(b)) return isX(a) ? -1 : 1;
      var va = a[srvSort], vb = b[srvSort];
      if (srvSort === 'name' || srvSort === 'map') { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); return (va < vb ? -1 : va > vb ? 1 : 0) * (srvDesc ? -1 : 1); }
      va = va == null ? 9999 : va; vb = vb == null ? 9999 : vb;
      return (va - vb) * (srvDesc ? -1 : 1);
    });
  }
  var html = '';
  function rowHtml(s) {
    var html = '';
    var pc = s.ping < 50 ? 'g' : s.ping < 100 ? 'y' : 'r', h = (isHist || isFav) ? histOf(s.ip) : null, c5 = '', c6 = '';
    if (h) c5 = isHist ? fmtTime(h.t) + (h.d ? ' \u00b7 ' + fmtDur(h.d) : '') : fmtTime(h.t);
    if (isFr) c5 = esc(friendsAt(s.ip).join(', '));
    if (isHist && h) c6 = (h.k || h.x) ? (h.k || 0) + ' / ' + (h.x || 0) : '\u2014';
    html += '<div class="sr' + (s.ip === srvSel ? ' on' : '') + '" data-ip="' + esc(s.ip) + '">' +
      '<span class="c0' + (isFavIp(s.ip) ? ' f' : '') + '" data-fav="' + esc(s.ip) + '">\u2605</span>' +
      c1row(s, (s.name || (h && h.name) || s.ip), s.pass ? '<span class="vb">PW</span>' : '') +
      '<span class="c2">' + (s.ok ? pbar(s) + s.pl + '/' + s.max : (s.fail ? '<span class="rd">' + T('offline') + '</span>' : '...')) + '</span>' +
      '<span class="c3">' + esc(s.map || (h && h.map) || '') + '</span>' +
      '<span class="c4">' + (s.ok ? '<i class="dot ' + pc + '"></i>' + s.ping : '') + '</span>' +
      '<span class="c5">' + c5 + '</span><span class="c6">' + c6 + '</span></div>';
    return html;
  }
  if (isNet && !SORT_USER && svcAny()) {
    // saytdagi kabi: avval TOP, keyin BOOST, keyin VIP xizmatini olganlar (sayt tartibida), so'ng qolganlari
    var used = {};
    each(SVC_ORDER, function (g) {
      var part = '';
      each(SVC[g[0]] || [], function (ip) { for (var i = 0; i < rows.length; i++) if (rows[i].ip === ip) { part += rowHtml(rows[i]); used[ip] = 1; break; } });
      if (part) html += '<div class="sgh"><b class="svb ' + g[0] + '">' + g[1] + '</b>' + esc(T('sv_' + g[0])) + '</div>' + part;
    });
    var rest = '';
    each(rows, function (s) { if (!used[s.ip]) rest += rowHtml(s); });
    if (rest) html += (html ? '<div class="sgh">' + esc(T('sv_other')) + '</div>' : '') + rest;
  } else each(rows, function (s) { html += rowHtml(s); });
  var emptyMsg = isFav ? T('empty_favs') : isHist ? T('empty_hist') : isFr ? (ME ? T('empty_frsrv') : T('no_fr_login')) : (isNet && running ? T('loading') : T('empty_list'));
  var lst = $('srvList'), st = lst.scrollTop;
  lst.innerHTML = html || '<div class="empty">' + esc(emptyMsg) + '</div>';
  lst.scrollTop = st;

  if (isHist) renderHistStats();
  else if (isFav) $('srvExtra').innerHTML = '<div class="tip">' + T('fav_tip') + '</div>' +
      '<div class="tgl">' + esc(T('fav_n1')) + '<div class="tg' + (DB.notifyFav !== 0 ? ' on' : '') + '" data-dbtg="notifyFav"><i></i></div></div>' +
      '<div class="tgl">' + esc(T('fav_n2')) + '<div class="tg' + (DB.notifyFr !== 0 ? ' on' : '') + '" data-dbtg="notifyFr"><i></i></div></div>';
  else $('srvExtra').innerHTML = '';
  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('srvFoot').innerHTML = esc(isFav ? DB.fav.length + ' \u2605' : T('srv_count').replace('{n}', cnt).replace('{p}', on));
  $('favBtn').innerHTML = '\u2605 ' + esc(isFavIp(srvSel) ? T('from_favs') : T('to_favs'));
  renderInfo();
}
function renderHistStats() {
  var today = new Date().toDateString(), tSec = 0, kills = 0, k = 0, x = 0, cnt = {}, best = '', bestN = 0;
  each(DB.hist, function (h) {
    var d = h.d || (h === CUR && CONNECTED ? Math.round((now() - h.t) / 1000) : 0);
    if (new Date(h.t).toDateString() === today) { tSec += d; kills += h.k || 0; }
    k += h.k || 0; x += h.x || 0;
    cnt[h.ip] = (cnt[h.ip] || 0) + d + 1;
    if (cnt[h.ip] > bestN) { bestN = cnt[h.ip]; best = h.ip; }
  });
  var bn = best ? (srv(best).name || (histOf(best) || {}).name || best) : '-';
  var box = function (i, key, v) { return '<div class="hs" style="left:' + (i * 216) + 'px"><small>' + esc(T(key)) + '</small><b>' + esc(v) + '</b></div>'; };
  $('srvExtra').innerHTML = box(0, 'hs_today', fmtDur(tSec)) + box(1, 'hs_kills', String(kills)) + box(2, 'hs_most', bn) + box(3, 'hs_kd', x ? (k / x).toFixed(2) : (k ? k.toFixed(2) : '-'));
}
var PLAYERS = {};
function srvq(ip, cb) {                          // sayt orqali server so'rovi (srvq.php): {ok,name,map,pl,max,bots,players:[{name,score,time}]}
  try {
    var x = new XMLHttpRequest(), done = false;
    x.open('GET', 'srvq.php?ip=' + encodeURIComponent(ip), true);
    x.onreadystatechange = function () { if (x.readyState !== 4 || done) return; done = true; var r = null; try { r = JSON.parse(x.responseText); } catch (e) {} cb(r); };
    setTimeout(function () { if (!done) { done = true; try { x.abort(); } catch (e) {} cb(null); } }, 9000);
    x.send(null);
  } catch (e) { cb(null); }
}
function setPlayers(ip, list) {
  list = list || [];
  list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
  PLAYERS[ip] = list; if (ip === srvSel) renderInfo();
}
function loadPlayers(ip) {
  if (CONNECTED && normIp(ip) === CONNECTED) return queryViaSite(ip, true);
  /* NextClient ro'yxat bermasa (yoki server o'yinchi bor desa-yu ro'yxat bo'sh kelsa) - sayt orqali */
  var site = function () {
    srvq(ip, function (r) {
      if (r && r.ok) {                           // NextClient "0" degan bo'lsa ham - sayt ko'rgan sonni qo'yamiz
        var s = srv(ip); s.ok = true; s.fail = false; s.pl = r.pl || 0; s.max = r.max || s.max; if (r.map) s.map = clean(r.map); renderSoon();
      }
      setPlayers(ip, r && r.ok && r.players ? r.players.map(function (x) { return { name: x.name, score: x.score, timePlayedSeconds: x.time }; }) : []);
    });
  };
  if (!NC || !NC.matchmaking || !NC.matchmaking.getPlayersInfo) return site();
  try {
    NC.matchmaking.getPlayersInfo(ip).then(function (list) {
      if (!list || !list.length) return site();   // bo'sh ro'yxat - saytdan tekshiramiz (ba'zi serverlarni NextClient noto'g'ri o'qiydi)
      setPlayers(ip, list);
    }, site);
  } catch (e) { site(); }
}
/* ---- serverning soatlar bo'yicha gavjumligi ---- */
var SHIST = {};
function histBars(ip) {
  var h = SHIST[ip];
  if (!h || now() - h.at > 600000) {
    if (!h || !h.busy) { SHIST[ip] = { at: now(), busy: 1, h: h && h.h }; api('srvhist', { ip: ip }, function (r) { SHIST[ip] = { at: now(), h: r.ok ? r.h : null, max: r.max || 32, now: r.now }; if (srvSel === ip) renderInfo(); }); }
  }
  if (!h || !h.h) return '';
  var any = false, mx = 1, bars = '';
  each(h.h, function (v) { if (v >= 0) { any = true; if (v > mx) mx = v; } });
  if (!any) return '';
  each(h.h, function (v, i) {
    var ht = v < 0 ? 2 : Math.max(2, Math.round(v / mx * 34));
    bars += '<i class="' + (i === h.now ? 'on' : '') + '" style="height:' + ht + 'px" title="' + i + ':00 — ' + (v < 0 ? '?' : v) + '"></i>';
  });
  return '<div class="ph">' + esc(T('hs_busy')) + '</div><div class="hbars">' + bars + '</div><div class="hbl"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>';
}
function sendStats() {
  var list = [], seen = {};
  each(svcIps().concat(TOP, PROMO_FAV, DB.fav, CONNECTED ? [CONNECTED] : []), function (ip) {
    var s = SRV[ip];
    if (seen[ip] || !s || !s.ok || list.length >= 40) return;
    seen[ip] = 1; list.push([ip, s.pl || 0, s.max || 32]);
  });
  if (list.length) api('srvstat', { s: JSON.stringify(list) });
}
function renderInfo() {
  var box = $('srvInfo');
  if (!srvSel) { box.innerHTML = '<div class="empty">' + esc(T('empty_list')) + '</div>'; return; }
  var s = srv(srvSel), pl = PLAYERS[srvSel], ph = '', h = histOf(srvSel);
  if (pl && pl.length) each(pl.slice(0, 40), function (p) { ph += '<div class="pl">' + esc(clean(p.name) || '...') + '<span>' + (p.score || 0) + ' \u00b7 ' + fmtShort(p.timePlayedSeconds) + '</span></div>'; });
  else ph = '<div class="empty" style="padding:8px 0">' + esc(pl ? T('no_players') : T('loading')) + '</div>';
  var pc = s.ping < 50 ? 'gr' : s.ping < 100 ? 'ye' : 'rd', mode = modeOf(s), fr = friendsAt(srvSel);
  var mapn = s.map || (h && h.map) || '';
  box.innerHTML = '<div class="mp' + (mode === 'zm' ? ' zm' : mode === 'awp' ? ' aw' : '') + '">' +
    (/^[\w\-.]{2,40}$/.test(mapn) ? '<img src="map.php?m=' + encodeURIComponent(mapn.toLowerCase()) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
    '<span>' + esc(mapn || '?') + '</span></div>' +
    '<h3>' + flagOf(srvSel) + esc(s.name || (h && h.name) || srvSel) + '</h3><div class="ip"><input class="ipin" readonly value="' + esc(srvSel) + '"><a class="cpy" data-copyip="' + esc(srvSel) + '">' + esc(T('ip_copy')) + '</a></div>' +
      '<a class="pwl" data-act="srvpw">' + esc(srvPw(srvSel) ? T('pw_set') : T('pw_add')) + '</a>' +
    '<div class="ln">' + esc(T('ph_players')) + ' <b>' + (s.ok ? s.pl + '/' + s.max : '-') + '</b><span class="r ' + pc + '">' + (s.ok ? '\u25cf ' + s.ping + ' ms' : esc(T('offline'))) + '</span></div>' +
    histBars(srvSel) +
    '<div class="ph">' + esc(T('ph_players')) + '</div><div class="pls">' + ph + '</div>' +
    (fr.length ? '<div class="fr3">' + esc(T('fr_here')) + '<span class="gr">' + esc(fr.join(', ')) + '</span></div>' : '') +
    (isX(s) ? '<div class="note">' + esc(T('vip_note')) + '</div>' : '');
}
function toggleFav(ip) {
  if (!ip) return;
  var i = DB.fav.indexOf(ip);
  if (i >= 0) { DB.fav.splice(i, 1); toast(T('removed')); } else { DB.fav.unshift(ip); query(ip); toast(T('added')); }
  persist(); cloudSave(); renderAll();
}

/* ============================================================ TURNIRLAR / DO'STLAR oynasi */
var sideMode = '';
function openSide(mode, title, body) {
  sideMode = mode;
  if (curModal !== 'mdSide') openModal('mdSide');
  $('sideTitle').innerHTML = esc(title); $('sideBody').innerHTML = body;
  layoutCheck('side/' + mode);
}
var SUGG = null;
var FR_REQ = [], FR_SENT = [], FR_Q = '', FR_SUG = null, FR_TM = 0, CHAT = null, CHAT_TM = 0, NOTIF_TM = 0, NOTIF_SEEN = {};
/* profil ramkasi: chempion - oltin, 20+ daraja - binafsha, 10+ - ko'k, 5+ - yashil */
/* reyting unvoni, rangli nik */
var RANKS = [['bronze', 0], ['silver', 400], ['gold', 900], ['plat', 1600], ['diamond', 2500], ['legend', 3600]];
function rankBadge(u) { var r = (u && u.rank) || 'bronze'; return '<span class="rkb rk-' + r + '">' + esc(T('rk_' + r)) + '</span>'; }
function nickHtml(u, name) { return '<span class="nk' + (u && u.nc ? ' nk-' + u.nc : '') + '">' + esc(name || (u && u.name) || '') + '</span>'; }
function frameCls(u) { if (!u) return ''; if (u.frame) return ' ' + u.frame; if (crown(u)) return ' fgold'; var l = u.level || 1; return l >= 20 ? ' fpurp' : l >= 10 ? ' fblue' : l >= 5 ? ' fgreen' : ''; }
function frAv(f) { return '<div class="rk c av2' + frameCls(f) + '" style="' + (f.online ? avStyle(f) : 'background:#4a4048') + '">' + avInner(f, f.name) + '</div>'; }
function openFriends() {
  if (!ME) { openLogin(); return; }
  var keep = $('frIn') ? $('frIn').value : FR_Q;
  var h = '<div class="addf"><input class="tx big" id="frIn" type="text" maxlength="20" autocomplete="off" placeholder="' + esc(T('fr_add')) + '" value="' + esc(keep) + '">' +
    '<a class="btn red" data-act="fradd">' + esc(T('fr_addb')) + '</a><div class="frsug" id="frSug"' + (FR_SUG ? '' : ' style="display:none"') + '>' + frSugHtml() + '</div></div>';
  h += '<div class="frtools"><a class="btn" data-act="clan">' + ico('flag') + ' ' + esc(T('cl_btn')) + (ME.clan ? ' [' + esc(ME.clan.tag) + ']' : '') + '</a><a class="btn" data-act="ref">\u2709 ' + esc(T('rf_btn')) + '</a></div>';
  if (SUGG && SUGG.list.length && !FR_Q) {
    h += '<div class="ph2 m">' + esc(T('sg_title')) + '</div><div class="sggl">';
    each(SUGG.list, function (x) {
      h += '<div class="sgg">' + frAv(x) + '<b data-frprof="' + esc(x.login) + '">' + esc(x.name) + '</b><small class="mut">' + esc(T('sg_with').replace('{s}', x.common)) + '</small><a class="btn" data-fradd2="' + esc(x.login) + '">' + esc(T('fr_add2')) + '</a></div>';
    });
    h += '</div>';
  }
  if (feat('suggest') && (!SUGG || now() - SUGG.t > 600000)) { SUGG = { t: now(), list: SUGG ? SUGG.list : [] }; api('suggest', {}, function (r) { if (r.ok) { SUGG.list = r.list || []; if (curModal === 'mdSide' && sideMode === 'friends' && SUGG.list.length) openFriends(); } }); }
  if (FR_REQ.length) {
    h += '<div class="ph2 m">' + esc(T('fr_req_t')) + ' (' + FR_REQ.length + ')</div>';
    each(FR_REQ, function (f) {
      h += '<div class="tr frq" style="cursor:default">' + frAv(f) + '<div class="nm">' + esc(f.name) + ' <span class="mut" style="font-weight:normal;font-size:12px">@' + esc(f.login) + '</span></div>' +
        '<div class="mt">' + esc(T('fr_wants')) + '</div><div class="fra"><a class="ok" data-fracc="' + esc(f.login) + '">' + esc(T('fr_acc')) + '</a><a data-frdec="' + esc(f.login) + '">' + esc(T('fr_dec')) + '</a></div></div>';
    });
    h += '<div class="ph2 m">' + esc(T('m_friends')) + '</div>';
  }
  each(FRIENDS, function (f) {
    var s = f.server ? srv(f.server) : null, un = f.unread ? '<b class="unb">' + f.unread + '</b>' : '';
    var offd = f.seen ? Math.floor((now() / 1000 - f.seen) / 86400) : 0;   // necha kundan beri kirmagan
    h += '<div class="tr" style="cursor:default">' + frAv(f) +
      '<div class="nm"><a class="frp" data-frprof="' + esc(f.login) + '">' + crown(f) + (f.clan ? '<span class="ctag">[' + esc(f.clan.tag) + ']</span> ' : '') + nickHtml(f) + '</a> ' + rankBadge(f) + ' <span class="mut" style="font-weight:normal;font-size:12px">' + esc(T('lvl').replace('{n}', f.level)) + '</span></div>' +
      '<div class="mt">' + (f.online ? '<span class="gm">●</span> ' + esc(f.server ? T('fr_in') + ((s && s.name) || f.server) : T('fr_menu')) : esc(f.seen ? T('fr_last').replace('{t}', agoText(f.seen)) : T('fr_off'))) + '</div>' +
      '<div class="fra">' + (!f.online && offd >= 3 ? '<a class="inv" data-mcall="' + esc(f.login) + '">' + esc(T('mc_btn')) + '</a>' : '') + '<a data-frcmp="' + esc(f.login) + '">VS</a><a class="ch" data-chat="' + esc(f.login) + '" data-chatn="' + esc(f.name) + '">' + ico('chat') + ' ' + esc(T('ch_btn')) + un + '</a>' +
      (f.online ? '<a class="ring" data-ring="' + esc(f.login) + '" title="' + esc(T('rg_btn')) + '">' + ico('phone') + '</a><a class="duel" data-duelp="' + esc(f.login) + '" data-dueln="' + esc(f.name) + '" title="' + esc(T('du_btn')) + '">' + ico('swords') + '</a>' : '') +
      (CONNECTED && f.online && f.server !== CONNECTED ? '<a class="inv" data-inv="' + esc(f.login) + '">' + esc(T('iv_btn')) + '</a>' : '') +
      (f.server ? '<a class="ok" data-ip="' + esc(f.server) + '">' + esc(T('join')) + '</a>' : '<a data-frdel="' + esc(f.login) + '">' + esc(T('fr_del')) + '</a>') + '</div></div>';
  });
  if (!FRIENDS.length && !FR_REQ.length) h += '<div class="empty">' + esc(T('fr_none')) + '</div>';
  openSide('friends', T('m_friends'), h);
  var i = $('frIn'); if (i && keep) { try { i.focus(); i.setSelectionRange(keep.length, keep.length); } catch (e) {} }
}
/* qidiruv: 2 ta harfdan keyin ostida variantlar ("li" -> limonchik ...) */
function frSugHtml() {
  if (!FR_SUG) return '';
  if (!FR_SUG.length) return '<div class="sg em">' + esc(T('fr_noresult')) + '</div>';
  var h = '';
  each(FR_SUG, function (f) {
    var b = f.st === 'friend' ? '<span class="sgs">' + esc(T('fr_isf')) + '</span>' : f.st === 'sent' ? '<span class="sgs">' + esc(T('fr_sent')) + '</span>' :
      f.st === 'req' ? '<a class="sgb" data-fracc="' + esc(f.login) + '">' + esc(T('fr_acc')) + '</a>' : '<a class="sgb" data-fradd2="' + esc(f.login) + '">' + esc(T('fr_add2')) + '</a>';
    h += '<div class="sg">' + frAv(f) + '<b>' + esc(f.name) + '</b><small>@' + esc(f.login) + ' · ' + esc(T('lvl').replace('{n}', f.level)) + '</small>' + b + '</div>';
  });
  return h;
}
function frSearch(v) {
  FR_Q = v; clearTimeout(FR_TM);
  v = String(v || '').replace(/\s+/g, '');
  if (v.length < 2) { FR_SUG = null; var b0 = $('frSug'); if (b0) b0.style.display = 'none'; return; }
  FR_TM = setTimeout(function () {
    api('user_search', { q: v }, function (r) {
      if (!r.ok || FR_Q.replace(/\s+/g, '') !== v) return;
      FR_SUG = r.list || []; var b = $('frSug'); if (b) { b.innerHTML = frSugHtml(); b.style.display = 'block'; }
    });
  }, 300);
}
function frAdd(login) {
  api('friend_add', { login: login }, function (r) {
    if (!r.ok) return toast(r.msg);
    toast(r.st === 'friend' ? T('fr_now') : T('fr_sent_t'), 3500);
    if (SUGG) { SUGG.list = SUGG.list.filter(function (x) { return x.login.toLowerCase() !== login.toLowerCase(); }); if (curModal === 'mdSide' && sideMode === 'friends') openFriends(); }
    if (FR_SUG) each(FR_SUG, function (f) { if (f.login.toLowerCase() === login.toLowerCase()) f.st = r.st; });
    loadFriends();
  });
}
/* yozishma */
function openChat(login, name) {
  CHAT = { login: login, name: name || login, list: [] };
  var h = '<div class="chh"><a class="btn" data-act="frback">' + esc(T('ch_back')) + '</a><b>' + esc(CHAT.name) + '</b></div>' +
    '<div class="chbox" id="chatBox"><div class="empty">' + esc(T('loading')) + '</div></div>' +
    '<div class="chin"><input class="tx big" id="chatIn" type="text" maxlength="300" autocomplete="off" placeholder="' + esc(T('ch_ph')) + '"><a class="btn red" data-act="chatsend">' + esc(T('ch_send')) + '</a></div>';
  openSide('chat', T('ch_title').replace('{n}', CHAT.name), h);
  try { $('chatIn').focus(); } catch (e) {}
  chatLoad();
}
function chatRender() {
  var b = $('chatBox'); if (!b || !CHAT) return;
  var me = ME ? ME.login.toLowerCase() : '', h = '';
  each(CHAT.list, function (m) {
    var d = new Date(m.t * 1000);
    h += '<div class="cm' + (m.f === me ? ' me' : '') + '"><span>' + esc(m.m) + '<i>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</i></span></div>';
  });
  b.innerHTML = h || '<div class="empty">' + esc(T('ch_empty')) + '</div>';
  b.scrollTop = b.scrollHeight;
}
function chatLoad() {
  clearTimeout(CHAT_TM);
  if (!CHAT || curModal !== 'mdSide' || sideMode !== 'chat') return;
  if (playing()) { CHAT_TM = setTimeout(chatLoad, 15000); return; }   // menyu yopiq, o'yindasiz - 4 s da so'ramaymiz
  var c = CHAT;
  api('msg_list', { login: c.login }, function (r) {
    var cbx = $('chatBox');
    if (CHAT !== c || !cbx) return;                 // chat yopilgan (ESC/X) - javob kelguncha oyna yo'q
    if (r.ok) { var n = (r.list || []).length; if (n !== c.list.length || !cbx.getElementsByTagName('div').length) { c.list = r.list || []; chatRender(); } }
    each(FRIENDS, function (f) { if (f.login.toLowerCase() === c.login.toLowerCase()) f.unread = 0; }); NOTIF_SEEN['m:' + c.login.toLowerCase()] = 0; frBadge();
    CHAT_TM = setTimeout(chatLoad, 4000);
  });
}
function chatSend() {
  var i = $('chatIn'); if (!i || !CHAT) return;
  var v = String(i.value || '').replace(/^\s+|\s+$/g, ''); if (!v) return;
  i.value = '';
  CHAT.list.push({ f: ME.login.toLowerCase(), m: v, t: Math.floor(now() / 1000) }); chatRender();
  api('msg_send', { login: CHAT.login, text: v }, function (r) { if (!r.ok) toast(r.msg); chatLoad(); });
}
/* bildirishnoma: 15 soniyada bir - yangi xabarlar va do'stlik so'rovlari */
var NOTIF = { unread: [], req: [] }, NOTIF_N = 0;
function frBadge() {
  var n = FR_REQ.length; each(NOTIF.unread, function (u) { if (!(CHAT && sideMode === 'chat' && curModal === 'mdSide' && CHAT.login.toLowerCase() === u.login)) n += u.n; });
  var e = $('mFrNew'); if (e) { e.innerHTML = n ? String(n) : ''; e.style.display = n ? 'inline-block' : 'none'; }
}
function pollNotif() {
  clearTimeout(NOTIF_TM);
  if (!ME) return;
  if (++NOTIF_N % 4 === 0 && !playing()) loadFriends();             // daqiqada bir: do'stlar qaysi serverga kirdi
  api('notif', {}, function (r) {
    NOTIF_TM = setTimeout(pollNotif, 15000);
    if (!r.ok) return;
    NOTIF = { unread: r.unread || [], req: r.req || [] };
    if (r.inv && r.inv.length && !DB.dnd) showInvite(r.inv[r.inv.length - 1]);   // do'st chaqirdi
    if (r.ring && !DB.dnd) showRing(r.ring);
    if (r.dinv && !DB.dnd) showDuelInv(r.dinv);
    DUEL = r.duel && r.duel.st === 'on' ? r.duel : null; duelBar();
    if (r.dres) duelResult(r.dres);
    if (r.wallnew && ME) toastAct(T('wl_new').replace('{n}', r.wallnew), 'data-frprof', ME.login, 8000);
    each(r.ringans || [], function (a) {
      toast((a.ok ? T('rg_yes') : T('rg_no')).replace('{n}', a.from), 7000);
      if (a.ok) openChat(a.login, a.from);
    });
    if (r.calls && r.calls.length) {                                   // "Sizni sog'indik" - uzoq kirmaganda do'stlar chaqirgan
      var nm = []; each(r.calls, function (c) { if (nm.indexOf(c.from) < 0) nm.push(c.from); });
      toast(T('mc_got').replace('{n}', nm.slice(0, 3).join(', ')), 9000);
    }
    var changed = (r.req || []).length !== FR_REQ.length;
    each(NOTIF.req, function (q) { if (!NOTIF_SEEN['r:' + q.login]) { NOTIF_SEEN['r:' + q.login] = 1; if (!DB.dnd) toast(T('fr_newreq').replace('{n}', q.name), 6000); changed = true; } });
    each(NOTIF.unread, function (u) {
      var k = 'm:' + u.login, inChat = CHAT && sideMode === 'chat' && curModal === 'mdSide' && CHAT.login.toLowerCase() === u.login;
      if (!inChat && (NOTIF_SEEN[k] || 0) < u.n) { if (!DB.dnd) toast(T('fr_newmsg').replace('{n}', u.name).replace('{c}', u.n), 6000); changed = true; }
      NOTIF_SEEN[k] = u.n;
    });
    if (changed) loadFriends(); else frBadge();
  });
}

/* profil rasmi: tayyor rasmlar + o'z rasmini brauzer orqali (mmb.boost-top.com/rasm.html) */
function openAvatars() {
  if (!ME) return openLogin();
  var h = '<div class="ph2">' + esc(T('av_pick')) + '</div><div class="avg">';
  for (var i = 1; i <= 12; i++) h += '<a data-avpre="' + i + '"><img src="av/p' + i + '.png" alt=""></a>';
  h += '</div><div class="ph2 m">' + esc(T('av_own')) + '</div><div class="avown">' + esc(T('av_own2')) +
    '<div class="avurl"><input class="ipin" readonly value="mmb.boost-top.com/rasm.html"><a class="cpy" data-copyip="mmb.boost-top.com/rasm.html">' + esc(T('ip_copy')) + '</a></div></div>' +
    (ME.av ? '<a class="btn" style="margin:16px 0 0" data-act="avdel">' + esc(T('av_del')) + '</a>' : '');
  openSide('avatars', T('av_title'), h);
}

/* ============================================================ SOZLAMALAR */
var DEF = {
  name: '', tag: 'X | ', net: 'fast', dl: 1, spray: 1, mp3off: 0, hand: 1, fastsw: 1, buykeys: 0, queue: 1, reconn: 1, demo: 0, dmig: 0, dmig2: 0,
  sens: 2.5, zoom: 1.2, raw: 1, filter: 0, inv: 0,
  vol: 0.8, mus: 0.4, voice: 1, vscale: 1, mute: 1, micwarm: 1, micfix: 0,
  fps: 100, showfps: 0, uisnd: 1, gamma: 2.5, fov: 90, vmfov: 90, hor: 1, vsync: 0, dyn: 1, decals: 1000,
  xp: 'pro', xt: 0, xs: 'small', xc: '255 59 59', xtr: 0, xdyn: 0, xthick: 1, xgap: 3, xout: 0, netg: 0, hs: 1, radar: 1, cid: 1, nover: 1, dmax: 5,
  rscale: 115, ropac: 100, rnames: 0, rhp: 0, rmode: 1, rround: 1, rrot: 1, rmap: 0.8,
  vmx: 0, vmy: 0, vmz: 0, vmshift: 0, bobst: 0, lagst: 0, camint: 0,
  roll: 0, rollspd: 200, bobv: 0.13, bobl: 0.32, boblow: 8, bobcam: 1, lagsc: 1, lagsp: 8, fovlerp: 0, camsc: 1,
  rtracks: 0, rfull: 1, rbg: 0, rallies: 1, rns: 0.8, rhs: 1, dtime: 6, drpc: 1, drpcs: 1, drpcj: 1, mmusic: 1,
  bob: 0.01, picmip: 0, detail: 0, shadows: 1, minm: 0, interp: 0.01, lw: 1, lc: 1, hisnd: 1, mixa: 0.1, loop: 0, saytm: 5, ngpos: 1, pro: 0, gfxc: '', xmig: 0, pmig: 0, gmig: 0,
  awps: 0, awpz: 1, awpxc: '0 230 255', awpxs: 'small'
};
var S = null, E = null;
var CVARS = { sens: 'sensitivity', zoom: 'zoom_sensitivity_ratio', raw: 'm_rawinput', filter: 'm_filter', vol: 'volume', vscale: 'voice_scale', voice: 'voice_enable',
  fps: 'fps_max', showfps: 'cl_showfps', gamma: 'gamma', fov: 'fov_angle', vmfov: 'viewmodel_fov', hor: 'fov_horplus', xt: 'cl_crosshair_type', xs: 'cl_crosshair_size',
  xc: 'cl_crosshair_color', xtr: 'cl_crosshair_translucent', xdyn: 'cl_dynamiccrosshair', hand: 'cl_righthand', fastsw: 'hud_fastswitch', dl: 'cl_allowdownload',
  spray: 'cl_allowupload', mute: 'snd_mute_losefocus', vsync: 'gl_vsync', dyn: 'r_dynamic', cid: 'hud_centerid', radar: 'cl_radartype', dmax: 'hud_deathnotice_max', decals: 'mp_decals',
  ropac: 'hud_radar_opacity', rnames: 'hud_radar_names', rhp: 'hud_radar_health', rmode: 'hud_radar_mode', rround: 'hud_radar_round', rrot: 'hud_radar_rotate', rmap: 'hud_radar_map_scale',
  vmx: 'viewmodel_offset_x', vmy: 'viewmodel_offset_y', vmz: 'viewmodel_offset_z', vmshift: 'viewmodel_disable_shift', bobst: 'cl_bobstyle', lagst: 'viewmodel_lag_style',
  roll: 'cl_rollangle', rollspd: 'cl_rollspeed', bobv: 'cl_bobamt_vert', bobl: 'cl_bobamt_lat', boblow: 'cl_bob_lower_amt', bobcam: 'cl_bob_camera',
  lagsc: 'viewmodel_lag_scale', lagsp: 'viewmodel_lag_speed', fovlerp: 'fov_lerp', camsc: 'camera_movement_scale',
  rtracks: 'hud_radar_tracks', rfull: 'hud_radar_fullmap', rbg: 'hud_radar_bg', rallies: 'hud_radar_allies', rns: 'hud_radar_name_size', rhs: 'hud_radar_health_size',
  dtime: 'hud_deathnotice_time', drpc: 'cl_discordrpc', drpcs: 'cl_discordrpc_server', drpcj: 'cl_discordrpc_join',
  bob: 'cl_bob', picmip: 'gl_picmip', detail: 'r_detailtextures', shadows: 'cl_shadows', minm: 'cl_minmodels', interp: 'ex_interp', lw: 'cl_lw', lc: 'cl_lc',
  hisnd: 'hisound', mixa: '_snd_mixahead', loop: 'voice_loopback', saytm: 'hud_saytext_time', ngpos: 'net_graphpos' };
function loadSettings() {
  S = copy(DEF);
  if (DB.set) for (var k in DB.set) if (DB.set.hasOwnProperty(k) && DEF.hasOwnProperty(k)) S[k] = DB.set[k];
  if (!(S.mixa >= 0.1)) S.mixa = 0.1;              // 0.05 (eski PRO CFG) - ovoz buferi juda kichik: FPS tushsa ovoz qotib takrorlanadi va uziladi
  /* pritsel otganda kattalashmaydi - hech qaysi CFG da (egasining talabi); saqlangan eski 1 lar ham 0 bo'ladi */
  S.xdyn = 0; cmd('cl_dynamiccrosshair 0');
  /* spray: o'zimiznikini yuborish va boshqalarnikini ko'rish doim yoqiq (X CLIENT spreyi hamma serverda ko'rinsin) */
  S.spray = 1; S.dl = 1; cmd('cl_allowupload 1'); cmd('cl_allowdownload 1');
  cmd('host_framerate 0');                         // demo tezligi oldingi ishga tushishdan qolib ketgan bo'lsa
  /* "Avto grafika" (bekor qilindi) grafikani pasaytirib yuborgan o'yinchilarda - to'liq grafikani qaytaramiz */
  /* eski PRO CFG soya va dinamik yorug'likni o'chirgan edi - bir marta qaytaramiz (yangi PRO CFG grafikaga tegmaydi) */
  if (!S.dmig2) { S.demo = 0; S.dmig = 1; S.dmig2 = 1; DB.set = S; }   // .dem avtomatik yozish o'chirildi: Demo bo'limida endi faqat F10 videolari (demo ko'rish NextClient ni yiqitardi)
  if (S.pro && !S.pmig) { S.shadows = 1; S.dyn = 1; S.pmig = 1; S.gfxc = ''; DB.set = S; }
  /* detal teksturalar (devorlarga naqsh) va baland gamma xaritalarni g'alati va og'ir ko'rsatdi - bir marta CS 1.6 holatiga */
  if (!S.gmig) {
    var gm = S.gamma > 2.6;
    S.detail = 0; if (gm) S.gamma = 2.5; S.gmig = 1; if (DB.set) DB.set = S;
    cmd('r_detailtextures 0'); if (gm) cmd('gamma 2.5');   // saqlangan sozlamasi yo'q o'yinchida ham o'yinga darhol
  }
  if (S.gfxc) {
    // CS 1.6 standarti: detal teksturalar o'chiq, soya va yorug'lik yoqiq
    var g = { detail: 0, shadows: 1, dyn: 1 };
    for (var gk in g) if (g.hasOwnProperty(gk)) S[gk] = g[gk];
    if (S.decals < 1000) S.decals = 1000; S.hisnd = 1; if (S.mixa > 0.1) S.mixa = 0.1;
    S.gfxc = ''; DB.set = S;
  }
}
function seedFromGame() {
  if (!canRead()) return;
  for (var k in CVARS) {
    if (!CVARS.hasOwnProperty(k)) continue;
    var v = readCvar(CVARS[k]);
    if (v == null || v === '') continue;
    if (typeof DEF[k] === 'number') { var n = parseFloat(v); if (!isNaN(n)) S[k] = Math.round(n * 100) / 100; } else S[k] = String(v).replace(/^\s+|\s+$/g, '');
  }
  for (var xk in XSUP) if (XSUP.hasOwnProperty(xk) && XSUP[xk]) { var xv = parseFloat(readCvar(XSUP[xk])); if (!isNaN(xv)) S[xk] = Math.round(xv * 10) / 10; }
  var pitch = parseFloat(readCvar('m_pitch')); if (!isNaN(pitch)) S.inv = pitch < 0 ? 1 : 0;
  var ng = parseFloat(readCvar('net_graph')); if (!isNaN(ng)) S.netg = ng > 0 ? 1 : 0;
  var old = parseFloat(readCvar('hud_deathnotice_old')); if (!isNaN(old)) S.hs = old > 0 ? 0 : 1;
  var dv = parseFloat(readCvar('scr_drawversion')); if (!isNaN(dv)) S.nover = dv > 0 ? 0 : 1;
  var rs = parseFloat(readCvar('hud_radar_scale')); if (!isNaN(rs)) S.rscale = Math.round(rs * 100);
  // eski NextClient "extra_small" ni katta (auto) qilib chizadi - eng kichigi "small"
  if (S.xs === 'auto') S.xs = 'large';
  if (SZ.indexOf(S.xs) < 0) S.xs = 'small';
  S.xc = String(S.xc).replace(/\s+/g, ' ');
  S.xp = presetOf(S);
  var nm = readCvar('name');
  if (nm) { MYNAME = nm; var tm = /^(X \| |\[[A-Za-z0-9]{2,5}\] )/.exec(nm); S.tag = tm ? tm[1] : ''; S.name = nm.slice(S.tag.length); }
}
var NETS = { slow: [25000, 60, 60], mid: [50000, 101, 101], fast: [100000, 101, 105] };
var BUY = [['F1', 'buy m4a1; buy ak47; buyammo1; buyammo1'], ['F2', 'buy awp; buyammo1; buyammo1'], ['F3', 'buy vesthelm; buy defuser'], ['F4', 'buy hegren; buy flash; buy flash; buy sgren']];
function fullName(s) { return ((s.tag || '') + s.name).slice(0, 31); }
function settingsCmds(s) {
  var n = NETS[s.net] || NETS.fast, c = [];
  if (s.name) c.push('name ' + q(fullName(s)));
  c.push('rate ' + n[0], 'cl_updaterate ' + n[1], 'cl_cmdrate ' + n[2]);
  c.push('cl_allowdownload 1', 'cl_allowupload 1', 'cl_righthand ' + s.hand, 'hud_fastswitch ' + s.fastsw);
  c.push('mp3volume ' + (s.mp3off ? 0 : s.mus));
  c.push('sensitivity ' + s.sens, 'zoom_sensitivity_ratio ' + s.zoom, 'm_rawinput ' + s.raw, 'm_filter ' + s.filter, 'm_pitch ' + (s.inv ? -0.022 : 0.022));
  c.push('volume ' + s.vol, 'voice_enable ' + s.voice, 'voice_scale ' + s.vscale, 'snd_mute_losefocus ' + s.mute, 'voice_dsound ' + (s.micfix ? 0 : 1));
  // fps_override 1 bo'lmasa NextClient FPS ni 100 da ushlab qoladi
  // cl_dlmax standart (512): 1024 ba'zi serverlar himoyasida (DProto/ReChecker) "FakePlayers" deb kick qilinishi mumkin
  c.push('fps_override ' + (s.fps > 100 ? 1 : 0), 'cl_showfps ' + s.showfps, 'cl_dlmax 512', 'm_customaccel 0');
  c.push('fps_max ' + s.fps, 'gamma ' + s.gamma, 'fov_angle ' + s.fov, 'viewmodel_fov ' + s.vmfov, 'fov_horplus ' + s.hor, 'gl_vsync ' + s.vsync, 'r_dynamic ' + s.dyn, 'mp_decals ' + Math.max(300, s.decals));   // kam bo'lsa spray o'q izlari orasida tez o'chib ketadi
  each(xhairCmds(s), function (x) { c.push(x); });
  // gl_picmip 0 va cl_minmodels 0 qotirilgan: aks holda serverning o'yinchi skinlari, qurollari va spray buziladi
  c.push('cl_bob ' + s.bob, 'gl_picmip 0', 'r_detailtextures ' + s.detail, 'cl_shadows ' + s.shadows, 'cl_minmodels 0',
    'ex_interp ' + s.interp, 'cl_lw ' + s.lw, 'cl_lc ' + s.lc, 'hisound ' + s.hisnd, '_snd_mixahead ' + s.mixa, 'voice_loopback ' + s.loop,
    'hud_saytext_time ' + s.saytm, 'net_graphpos ' + s.ngpos);
  c.push('net_graph ' + (s.netg ? 3 : 0), 'hud_deathnotice_old ' + (s.hs ? 0 : 1), 'hud_deathnotice_max ' + s.dmax, 'cl_radartype ' + s.radar, 'hud_centerid ' + s.cid, 'scr_drawversion ' + (s.nover ? 0 : 1));
  // PRO CFG qo'shimchasi: to'liq yugurish tezligi, eski ovoz tezlatkichlari o'chiq (qotish beradi), keraksiz effektlarsiz - yuqori va barqaror FPS
  if (s.pro) c.push('cl_forwardspeed 400', 'cl_sidespeed 400', 'cl_backspeed 400', 'cl_upspeed 400', 'cl_pitchup 89', 'cl_pitchdown 89',
    's_a3d 0', 's_eax 0', 'cl_weather 0', 'cl_showevents 0', 'cl_timeout 60');
  /* o'q tekkan joydagi tutun/chang va gilzalar - standart: ular o'q qayerga ketayotganini ko'rsatadi (otdachani boshqarish uchun).
   * 0 qilinganda o'yinchilar "qurol sochilib ketyapti" deyishdi */
  c.push('max_shells 120', 'max_smokepuffs 120');
  c.push('hud_radar_scale ' + (s.rscale / 100), 'hud_radar_opacity ' + s.ropac, 'hud_radar_names ' + s.rnames, 'hud_radar_health ' + s.rhp);
  c.push('hud_radar_mode ' + s.rmode, 'hud_radar_round ' + s.rround, 'hud_radar_rotate ' + s.rrot, 'hud_radar_map_scale ' + s.rmap);
  c.push('viewmodel_offset_x ' + s.vmx, 'viewmodel_offset_y ' + s.vmy, 'viewmodel_offset_z ' + s.vmz, 'viewmodel_disable_shift ' + s.vmshift,
    'cl_bobstyle ' + s.bobst, 'viewmodel_lag_style ' + s.lagst, 'camera_movement_interp ' + (s.camint ? 0.1 : 0));
  c.push('cl_rollangle ' + s.roll, 'cl_rollspeed ' + s.rollspd, 'cl_bobamt_vert ' + s.bobv, 'cl_bobamt_lat ' + s.bobl, 'cl_bob_lower_amt ' + s.boblow, 'cl_bob_camera ' + s.bobcam,
    'viewmodel_lag_scale ' + s.lagsc, 'viewmodel_lag_speed ' + s.lagsp, 'fov_lerp ' + s.fovlerp, 'camera_movement_scale ' + s.camsc);
  c.push('hud_radar_tracks ' + s.rtracks, 'hud_radar_fullmap ' + s.rfull, 'hud_radar_bg ' + s.rbg, 'hud_radar_allies ' + s.rallies, 'hud_radar_name_size ' + s.rns,
    'hud_radar_health_size ' + s.rhs, 'hud_deathnotice_time ' + s.dtime, 'cl_discordrpc ' + s.drpc, 'cl_discordrpc_server ' + s.drpcs, 'cl_discordrpc_join ' + s.drpcj);
  if (s.buykeys) each(BUY, function (b) { c.push('bind ' + b[0] + ' ' + q(b[1])); });
  return c;
}
function applySettings(s) { each(settingsCmds(s), function (c) { cmd(c); }); if (s.name) MYNAME = fullName(s); if (s === S) binAliases(); }

/* saqlashdan keyin o'yindan qayta o'qib tekshirish */
var LAST_CHECK = null;
function verifySettings(s) {
  if (!canRead()) { toast(T('saved')); return; }
  var exp = {}, bad = [], ok = 0;
  for (var k in CVARS) if (CVARS.hasOwnProperty(k)) exp[CVARS[k]] = s[k];
  for (var xk in XSUP) if (XSUP.hasOwnProperty(xk) && XSUP[xk]) exp[XSUP[xk]] = xextVal(xk, s);
  exp.m_pitch = s.inv ? -0.022 : 0.022; exp.net_graph = s.netg ? 3 : 0; exp.hud_deathnotice_old = s.hs ? 0 : 1; exp.hud_radar_scale = s.rscale / 100;
  if (s.name) exp.name = fullName(s);
  for (var c in exp) {
    if (!exp.hasOwnProperty(c)) continue;
    var got = readCvar(c);
    if (got == null) continue;                              // klientda bunday kvar yo'q
    var want = String(exp[c]), a = parseFloat(got), b = parseFloat(want);
    var same = (!isNaN(a) && !isNaN(b) && /^[-\d.]+$/.test(want)) ? Math.abs(a - b) < 0.011 : got.replace(/\s+/g, ' ').toLowerCase() === want.toLowerCase();
    if (same) ok++; else bad.push(c + ': ' + got + ' \u2192 ' + want);
  }
  LAST_CHECK = { ok: ok, bad: bad };
  if (bad.length) toast(T('chk_bad').replace('{n}', bad.length), 4000);
  else toast(T('chk_ok').replace('{n}', ok));
  if (curModal === 'mdSettings' && setTab === 'system') showSetTab('system');
}

/* pritsel tayyor ko'rinishlari (NextClient: tur 0-3, o'lcham small/medium/large/auto) */
var XPRE = [['classic', 'x_classic', 0, 'medium'], ['pro', 'x_pro', 0, 'small'], ['dot', 'x_dot', 3, 'small'], ['t', 'x_t', 1, 'small'], ['circle', 'x_circle', 2, 'medium'], ['big', 'x_big', 0, 'large']];
function presetOf(s) {
  var i;
  for (i = 0; i < XPRE.length; i++) if (Number(s.xt) === XPRE[i][2] && s.xs === XPRE[i][3]) return XPRE[i][0];
  for (i = 0; i < XPRE.length; i++) if (Number(s.xt) === XPRE[i][2]) return XPRE[i][0];
  return 'classic';
}
/* pritsel galereyasi: tayyor pritsellar, bir bosishda qo'yiladi */
var XGAL = [['xg_green', 'X-0-2-0-0-00FF00'], ['xg_pro', 'X-0-1-0-0-32FF32'], ['xg_cyandot', 'X-3-1-0-0-00FFFF'], ['xg_redt', 'X-1-1-0-0-FF2020'], ['xg_ycirc', 'X-2-2-0-0-FFFF00'],
  ['xg_white', 'X-0-0-0-0-FFFFFF'], ['xg_pink', 'X-0-1-0-0-FF00FF'], ['xg_awp', 'X-3-0-0-0-FF3030'], ['xg_dyn', 'X-0-2-0-1-00FF00'], ['xg_glass', 'X-0-1-1-0-00BFFF'], ['xg_big', 'X-0-3-0-0-00FF00'], ['xg_bluet', 'X-1-2-0-0-3B6CFF']];
function xGallery() {
  var h = '<div class="ph2 m">' + esc(T('xg_title')) + '</div><div class="xgal">';
  each(XGAL, function (g) { var c = g[1].slice(-6); h += '<a data-xgal="' + g[1] + '"><i style="background:#' + c + '"></i>' + esc(T(g[0])) + '</a>'; });
  return h + '</div>';
}
var SZ = ['extra_small', 'small', 'medium', 'large'];   // NextClient: large eng katta (auto ham shunday); qalinlik doim 1 piksel
function xcode(s) {
  var hex = '';
  each(String(s.xc).split(' '), function (v) { var h = (Number(v) || 0).toString(16).toUpperCase(); hex += h.length < 2 ? '0' + h : h; });
  return 'X-' + s.xt + '-' + Math.max(0, SZ.indexOf(s.xs)) + '-' + (s.xtr ? 1 : 0) + '-' + (s.xdyn ? 1 : 0) + '-' + hex;
}
function applyCode(code) {
  var m = /^X-([0-3])-([0-3])-([01])-([01])-([0-9A-F]{6})$/i.exec(String(code).replace(/\s+/g, ''));
  if (!m) { toast(T('x_badcode')); return false; }
  E.xt = Number(m[1]); E.xs = SZ[Number(m[2])] || 'large'; E.xtr = Number(m[3]); E.xdyn = 0;
  E.xc = parseInt(m[5].slice(0, 2), 16) + ' ' + parseInt(m[5].slice(2, 4), 16) + ' ' + parseInt(m[5].slice(4, 6), 16);
  E.xp = presetOf(E);
  return true;
}

var setTab = 'game', HSUB = 'main';
/* pritsel: o'yinga darhol qo'llanadi (Saqlash bosilmasa - oyna yopilganda qaytariladi).
 * Qalinlik / interval / kontur: NextClient versiyasida shunday kvar bo'lsa - ishlaydi, bo'lmasa kulrang. */
var XEXT = { xthick: ['cl_crosshair_thickness', 'cl_crosshairthickness', 'cl_crosshair_width'],
  xgap: ['cl_crosshair_gap', 'cl_crosshairgap'],
  xout: ['cl_crosshair_outline', 'cl_crosshair_drawoutline', 'cl_crosshair_outline_draw', 'cl_crosshair_outline_thickness'] };
var XSUP = {}, XLIVE = false;
function detectXext() {
  XSUP = {};
  for (var k in XEXT) {
    if (!XEXT.hasOwnProperty(k)) continue;
    XSUP[k] = '';
    for (var i = 0; i < XEXT[k].length; i++) { var v = readCvar(XEXT[k][i]); if (v != null && v !== '') { XSUP[k] = XEXT[k][i]; break; } }
  }
}
function xextVal(k, s) { return k === 'xout' && /draw/.test(XSUP[k] || '') ? (s.xout > 0 ? 1 : 0) : s[k]; }
function xhairCmds(s) {
  // rang qo'shtirnoq bilan: GoldSrc kvarga faqat 1-so'zni yozadi (cl_crosshair_color 255 0 0 -> "255")
  var c = ['cl_crosshair_type ' + s.xt, 'cl_crosshair_size ' + s.xs, 'cl_crosshair_color ' + q(String(s.xc).replace(/[^\d ]/g, '')), 'cl_crosshair_translucent ' + s.xtr, 'cl_dynamiccrosshair 0'];
  for (var k in XSUP) if (XSUP.hasOwnProperty(k) && XSUP[k]) c.push(XSUP[k] + ' ' + xextVal(k, s));
  return c;
}
function xLive() { if (!E) return; XLIVE = true; each(xhairCmds(E), function (x) { cmd(x); }); }
/* ---- profillar: 4 ta joy, har birida sozlamalar + tugmalar ---- */
function profSlots() {
  var p = DB.profiles || [], n = ['pf_n1', 'pf_n2', 'pf_n3', 'pf_n4'], out = [];
  for (var i = 0; i < 4; i++) out.push(p[i] || { n: T(n[i]), t: 0 });
  return out;
}
function profSave(i) {
  var p = DB.profiles || [], sl = profSlots()[i], set = copy(E);
  delete set.name; delete set.tag;
  p[i] = { n: sl.n, t: now(), s: set, b: copy(BINDS), b2: copy(BINDS2) };
  DB.profiles = p; persist(); cloudSave(); toast(T('pf_saved').replace('{n}', sl.n));
}
function profLoad(i) {
  var sl = (DB.profiles || [])[i]; if (!sl || !sl.s) return;
  for (var k in sl.s) if (sl.s.hasOwnProperty(k) && DEF.hasOwnProperty(k)) E[k] = sl.s[k];
  if (sl.b) { DB.binds = copy(sl.b); DB.binds2 = sl.b2 ? copy(sl.b2) : {}; loadBinds(); applyBinds(); persist(); }
  toast(T('pf_loaded').replace('{n}', sl.n), 4000);
}
/* ---- sezgirlik kalkulyatori (CS 1.6 m_yaw 0.022) ---- */
var CALC_G = [['cs2', 'CS2 / CS:GO', 1], ['val', 'Valorant', 3.181818], ['ow', 'Overwatch 2', 0.3], ['apex', 'Apex', 1]];
var CALC = 'cs2', CALC_V = '1';
function calcVal() {
  var v = parseFloat(String(CALC_V).replace(',', '.')), f = 1;
  each(CALC_G, function (g) { if (g[0] === CALC) f = g[2]; });
  return isNaN(v) ? 0 : Math.round(v * f * 100) / 100;
}
function calcOut() { var v = calcVal(); return v ? '= <b>' + v + '</b> CS 1.6' : ''; }
/* ---- tayyor uslublar (o'yin uslubi bo'yicha, haqiqiy o'yinchilar emas) ---- */
/* Tayyor CFG'lar - 4 guruh: [id, nom, izoh, qiymatlar, guruh]. Har biri to'liq: internet, interp, sezgirlik, pritsel, qurol ko'rinishi.
 * FPS 100 dan past bo'lsa - 100 (CS 1.6 fizikasi); grafika faqat "Kompyuter" guruhida o'zgaradi. */
var STYLES = [
  ['pro', 'st_pro', 'st_pro2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 2, zoom: 1, xt: 0, xs: 'small', xc: '50 250 50', xtr: 0, xdyn: 0, bob: 0, fastsw: 1, vmfov: 90, dmax: 5 }, 'top'],
  ['rifle', 'st_rifle', 'st_rifle2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 2.2, zoom: 1, xt: 0, xs: 'small', xc: '50 250 50', xtr: 0, xdyn: 0, bob: 0, fastsw: 1 }, 'top'],
  ['awp', 'st_awp', 'st_awp2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 1.8, zoom: 0.85, xt: 0, xs: 'small', xc: '0 230 255', xtr: 0, xdyn: 0, bob: 0, fastsw: 1, awps: 1.5, awpz: 0.85, awpxs: 'small' }, 'top'],
  ['entry', 'st_entry', 'st_entry2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 3.2, zoom: 1, xt: 0, xs: 'small', xc: '0 230 255', xtr: 0, xdyn: 0, bob: 0, fastsw: 1 }, 'top'],
  ['pistol', 'st_pistol', 'st_pistol2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 2.4, zoom: 1, xt: 0, xs: 'small', xc: '255 255 255', xtr: 0, xdyn: 0, bob: 0, fastsw: 1 }, 'top'],
  ['low', 'st_low', 'st_low2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 1.4, zoom: 0.9, xt: 0, xs: 'extra_small', xc: '255 255 255', xtr: 0, xdyn: 0, bob: 0 }, 'top'],
  ['high', 'st_high', 'st_high2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 4.5, zoom: 1.2, xt: 0, xs: 'medium', xc: '255 210 60', xtr: 0, xdyn: 0, bob: 0 }, 'top'],
  ['classic', 'st_classic', 'st_classic2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, sens: 2.5, zoom: 1.2, xt: 0, xs: 'medium', xc: '50 250 50', xtr: 0, xdyn: 0, bob: 0.01 }, 'top'],
  ['csgo', 'st_csgo', 'st_csgo2', { bobst: 2, bobv: 0.13, bobl: 0.32, boblow: 8, lagst: 2, lagsc: 1, fovlerp: 0.2, camint: 1, vmx: 1, vmy: 0, vmz: -1, vmfov: 90, xt: 0, xs: 'small', xc: '50 250 50', xdyn: 0 }, 'top'],
  ['new', 'st_new', 'st_new2', { sens: 3, zoom: 1.2, raw: 1, xt: 0, xs: 'medium', xc: '255 210 60', xdyn: 0, bob: 0.01 }, 'top'],
  ['clanwar', 'st_clanwar', 'st_clanwar2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, voice: 1, vscale: 1.2, mp3off: 1, mmusic: 0, saytm: 8, netg: 0, dmax: 6, hs: 1, cid: 1 }, 'sit'],
  ['zombie', 'st_zombie', 'st_zombie2', { sens: 3.5, xdyn: 0, xs: 'medium', vol: 0.9, dmax: 8, saytm: 8, decals: 1000 }, 'sit'],
  ['dmcfg', 'st_dm', 'st_dm2', { net: 'fast', interp: 0.01, lw: 1, lc: 1, raw: 1, filter: 0, vsync: 0, hisnd: 1, mixa: 0.1, dmax: 8, dtime: 4, saytm: 4, hs: 1, cid: 0, decals: 1000, fastsw: 1 }, 'sit'],
  ['stream', 'st_stream', 'st_stream2', { netg: 0, showfps: 0, nover: 1, dmax: 5, saytm: 6, decals: 2000 }, 'sit'],
  ['vis', 'st_vis', 'st_vis2', { gamma: 2.7, dyn: 0, detail: 0, hor: 1, fov: 90, vmfov: 90 }, 'pc'],
  ['lowpc', 'st_lowpc', 'st_lowpc2', { detail: 0, shadows: 0, dyn: 0, vsync: 0, decals: 300, fps: 100, hisnd: 1, mixa: 0.15 }, 'pc'],
  ['slownet', 'st_slownet', 'st_slownet2', { net: 'slow', interp: 0.1, lw: 1, lc: 1 }, 'pc'],
  ['midnet', 'st_midnet', 'st_midnet2', { net: 'mid', interp: 0.05, lw: 1, lc: 1 }, 'pc'],
  ['csdef', 'st_csdef', 'st_csdef2', { sens: 3, zoom: 1.2, raw: 1, filter: 0, xt: 0, xs: 'medium', xc: '50 250 50', xtr: 0, xdyn: 0, fps: 100, interp: 0.1, net: 'slow', bob: 0.01, gamma: 2.5, fov: 90, vmfov: 90 }, 'def']
];
function applyStyle(id) {
  each(STYLES, function (x) { if (x[0] === id) for (var k in x[3]) if (x[3].hasOwnProperty(k)) E[k] = x[3][k]; });
  if (!(E.fps >= 100)) E.fps = 100;
  E.xp = presetOf(E); showSetTab('tools'); toast(T('st_ok'), 4000);
}
/* ---- kompyuter quvvati (XClient.exe aniqlaydi) ---- */
function hwClass() {
  if (!HW) return 'mid';
  var weakGpu = /intel.*(hd|gma|uhd)|sis |via |radeon.*(hd [2-5]|x[0-9])|geforce (6|7|8|9|2[0-9]{2}) /i.test(HW.gpu || '');
  if (HW.ram < 3500 || HW.cpu <= 2 || (weakGpu && HW.ram < 6000)) return 'weak';
  if (HW.ram >= 8000 && HW.cpu >= 4 && !weakGpu) return 'strong';
  return 'mid';
}
function hwText() {
  if (!HW) return T('hw_none');
  return Math.round(HW.ram / 1024) + ' GB RAM · ' + HW.cpu + ' ' + T('hw_cores') + (HW.gpu ? ' · ' + HW.gpu : '');
}
/* kompyuter quvvatiga mos grafika: FPS 100 da barqaror tursin (FPS tushganda o'yin qotadi).
 * 100 dan baland FPS faqat kuchli kompyuterda qoladi; kuchsizda ovoz ham yengilroq (hisound 0, bufer 0.15) */
function gfxPreset(c, s) {
  if (c === 'weak') return { detail: 0, shadows: 0, dyn: 0, vsync: 0, decals: 300, fps: 100, hisnd: 0, mixa: 0.15 };
  if (c === 'mid') return { detail: 0, shadows: 1, dyn: 0, vsync: 0, decals: Math.min(s.decals || 1000, 1000), fps: Math.min(s.fps || 100, 144) };
  return { detail: 1, shadows: 1, dyn: 1, vsync: 0 };
}
function hwAuto() {
  var c = hwClass(), v = gfxPreset(c, E);
  for (var k in v) if (v.hasOwnProperty(k)) E[k] = v[k];
  showSetTab('pro'); toast(T('hw_done').replace('{c}', T('hw_' + c)), 5000);
}
/* ---- kontent paketlari (saytdagi mmb/packs) ---- */
var PACKS = null;
function loadPacks() {
  var x; try { x = new XMLHttpRequest(); x.open('GET', 'packs.php?t=' + now(), true); } catch (e) { return; }
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    var r = null; try { r = JSON.parse(x.responseText); } catch (e) {}
    PACKS = r && r.length != null ? r : [];
    if (curModal === 'mdSettings' && setTab === 'cont') showSetTab('cont');
  };
  x.send(null);
  PACKS = undefined;
}
/* ---- spray: rasm -> 112x112 -> 255 rangli tempdecal.wad (WAD3, "{LOGO"); 255-indeks shaffof ----
 * Palitra rasmning o'zidan (median cut) olinadi - qat'iy palitradagidek dog'lar bo'lmaydi.
 * GoldSrc spray uchun eng ko'pi 14336 piksel: 112x112 = 12544. */
var SPR = 112;
function sprayPalette(px) {
  var cols = [], i;
  for (i = 0; i < px.length; i += 4) if (px[i + 3] >= 128) cols.push([px[i], px[i + 1], px[i + 2]]);
  if (!cols.length) cols.push([0, 0, 0]);
  var boxes = [cols];
  while (boxes.length < 255) {
    var bi = -1, best = -1, ch = 0;
    for (i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      for (var c = 0; c < 3; c++) {
        var mn = 255, mx = 0;
        for (var k = 0; k < boxes[i].length; k++) { var v = boxes[i][k][c]; if (v < mn) mn = v; if (v > mx) mx = v; }
        if (mx - mn > best) { best = mx - mn; bi = i; ch = c; }
      }
    }
    if (bi < 0 || best <= 0) break;
    var bx = boxes[bi];
    bx.sort(function (p, q) { return p[ch] - q[ch]; });
    var mid = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, mid), bx.slice(mid));
  }
  var pal = [];
  for (i = 0; i < boxes.length; i++) {
    var r = 0, g = 0, b = 0, n = boxes[i].length;
    for (var j = 0; j < n; j++) { r += boxes[i][j][0]; g += boxes[i][j][1]; b += boxes[i][j][2]; }
    pal.push([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
  }
  while (pal.length < 255) pal.push([0, 0, 0]);
  pal.push([0, 0, 255]);
  return pal;
}
function sprayNear(pal, cache, r, g, b) {
  var key = (r << 16) | (g << 8) | b;
  if (cache[key] != null) return cache[key];
  var bi = 0, bd = 1e9;
  for (var i = 0; i < 255; i++) { var p = pal[i], d = (p[0] - r) * (p[0] - r) * 3 + (p[1] - g) * (p[1] - g) * 4 + (p[2] - b) * (p[2] - b) * 2; if (d < bd) { bd = d; bi = i; } }
  return (cache[key] = bi);
}
function sprayLevel(px, w, h, f, pal, cache) {   // f marta kichraytirish (o'rtacha rang), indekslar
  var ow = w / f, oh = h / f, out = new Array(ow * oh);
  for (var y = 0; y < oh; y++) for (var x = 0; x < ow; x++) {
    var r = 0, g = 0, b = 0, a = 0, n = 0;
    for (var yy = 0; yy < f; yy++) for (var xx = 0; xx < f; xx++) {
      var o = ((y * f + yy) * w + (x * f + xx)) * 4;
      if (px[o + 3] >= 128) { r += px[o]; g += px[o + 1]; b += px[o + 2]; n++; }
      a++;
    }
    out[y * ow + x] = n * 2 < a ? 255 : sprayNear(pal, cache, Math.round(r / n), Math.round(g / n), Math.round(b / n));
  }
  return out;
}
function makeWad(px, w, h) {
  var pal = sprayPalette(px), cache = {};
  var mips = [sprayLevel(px, w, h, 1, pal, cache), sprayLevel(px, w, h, 2, pal, cache), sprayLevel(px, w, h, 4, pal, cache), sprayLevel(px, w, h, 8, pal, cache)];
  var sum = 0; each(mips, function (m) { sum += m.length; });
  var lump = 40 + sum + 2 + 768 + 2, total = 12 + lump + 32, b = new Array(total), i;
  for (i = 0; i < total; i++) b[i] = 0;
  function u32(o, v) { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >> 24) & 255; }
  function str(o, t) { for (var k = 0; k < t.length; k++) b[o + k] = t.charCodeAt(k); }
  str(0, 'WAD3'); u32(4, 1); u32(8, 12 + lump);
  var m = 12; str(m, '{LOGO'); u32(m + 16, w); u32(m + 20, h);
  var off = 40; for (i = 0; i < 4; i++) { u32(m + 24 + i * 4, off); off += mips[i].length; }
  var o = m + 40;
  each(mips, function (mm) { for (var k = 0; k < mm.length; k++) b[o++] = mm[k]; });
  b[o] = 0; b[o + 1] = 1; o += 2;                   // 256 rang
  each(pal, function (c) { b[o++] = c[0]; b[o++] = c[1]; b[o++] = c[2]; });
  var d = 12 + lump; u32(d, 12); u32(d + 4, lump); u32(d + 8, lump); b[d + 12] = 0x43; str(d + 16, '{LOGO');
  var bin = ''; for (i = 0; i < total; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}
function sprayFrom(src) {
  if (!PCID) return toast(T('sy_nolaunch'), 5000);
  var im = new Image();
  im.onload = function () {
    var c = document.createElement('canvas'); c.width = SPR; c.height = SPR;
    var g = c.getContext('2d'), sz = Math.min(im.width, im.height);
    g.clearRect(0, 0, SPR, SPR);
    g.drawImage(im, Math.round((im.width - sz) / 2), Math.round((im.height - sz) / 2), sz, sz, 0, 0, SPR, SPR);
    var px; try { px = g.getImageData(0, 0, SPR, SPR).data; } catch (e) { return toast(T('a_photo_bad')); }
    var wad = makeWad(px, SPR, SPR);
    toast(T('lg_wait'));
    api('spray', { d: PCID, wad: wad }, function (r) {
      if (!r.ok) return toast(r.msg || 'Xato', 5000);
      try { DB.sprayPrev = c.toDataURL('image/png'); } catch (e) {}
      DB.sprayT = now(); persist();
      toast(T('sp_ok'), 6000);
      if (curModal === 'mdSettings' && setTab === 'cont') showSetTab('cont');
    });
  };
  im.onerror = function () { toast(T('a_photo_bad')); };
  im.src = src;
}
/* ---- mavzular: xc.css dagi qizil ranglarni boshqa rangga almashtiramiz ---- */
var THEMES = [['red', 0], ['orange', 30], ['gold', 48], ['green', 135], ['cyan', 188], ['blue', 212], ['purple', 272], ['pink', 325]];
function hsl2rgb(h, s, l) {
  function f(n) { var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }
  return [f(0), f(8), f(4)];
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
}
function themeColor(r, g, b, hue) {
  var c = rgb2hsl(r, g, b);
  if (c[1] < (c[2] < 0.4 ? 0.12 : 0.3) || c[2] < 0.06 || c[2] > 0.94 || (c[0] > 22 && c[0] < 338)) return null;   // faqat qizil tuslar (to'q ramkalar ham)
  return hsl2rgb(hue, c[1], c[2]);
}
function hex2(n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; }
/* rasmlar (logotiplar) ham tanlangan rangga bo'yaladi: canvas'da qizil piksellar tusini almashtiramiz */
var IMG_TH = {};
function recolorImages(hue) {
  each(document.querySelectorAll('img'), function (im) {
    var o = im.getAttribute('data-osrc') || im.getAttribute('src') || '';
    if (!/(^|\/)(logo|logo_big|spray_logo)\.png$/.test(o)) return;
    im.setAttribute('data-osrc', o);
    if (hue <= 0) { if (im.getAttribute('src') !== o) im.src = o; return; }
    var key = o + '|' + hue;
    if (IMG_TH[key]) { im.src = IMG_TH[key]; return; }
    var src = new Image();
    src.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        var x = c.getContext('2d'); x.drawImage(src, 0, 0);
        var d = x.getImageData(0, 0, c.width, c.height), px = d.data;
        for (var i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 8) continue;
          if (hue > 0) { var t = themeColor(px[i], px[i + 1], px[i + 2], hue); if (t) { px[i] = t[0]; px[i + 1] = t[1]; px[i + 2] = t[2]; } }
        }
        x.putImageData(d, 0, 0); IMG_TH[key] = c.toDataURL('image/png');
        each(document.querySelectorAll('img[data-osrc="' + o + '"]'), function (m) { m.src = IMG_TH[key]; });
      } catch (e) {}
    };
    src.src = o;
  });
}
function themeHue(id) { var hue = -1; each(THEMES, function (x) { if (x[0] === id) hue = x[1]; }); return hue; }
/* Kun / tun rejimi: DB.day 0 - tun (qorong'i, asl), 1 - kun (yorug'), 2 - avto (7:00-19:00 kun).
 * CEF1 da CSS o'zgaruvchilari yo'q - shuning uchun xc.css ning hamma ranglari JS da o'giriladi:
 * qorong'i fon -> och, och matn -> to'q; yorqin aksent ranglar (qizil tugmalar) o'z joyida qoladi. */
function isDay() { var m = DB.day || 0; if (m === 2) { var h = new Date().getHours(); return h >= 7 && h < 19; } return m === 1; }
function dayColor(c) {
  var x = rgb2hsl(c[0], c[1], c[2]), h = x[0], sa = x[1], l = x[2];
  if (sa > 0.45 && l > 0.28 && l < 0.75) return hsl2rgb(h, sa, Math.min(l, 0.52));      // aksent: biroz to'qroq - och fonda o'qilsin
  if (l >= 0.35) return hsl2rgb(h, sa * 0.5, (1 - l) * 0.62);                             // matn: to'q, aniq o'qiladi
  return hsl2rgb(h, sa * 0.55, 0.1 + (1 - l) * 0.86);                                      // fon va ramkalar: och
}
var CSS_SRC = null, LOOK_DAY = false;
function applyTheme(id) {
  var hue = themeHue(id), day = isDay();
  LOOK_DAY = day;
  recolorImages(hue); renderTop2();
  var h0 = document.documentElement; h0.className = (h0.className || '').replace(/(^|\s)day(?=\s|$)/g, '') + (day ? ' day' : '');
  var fs = DB.fs || 1;
  applyBg();
  if (hue <= 0 && !day && fs === 1) { var o0 = $('thcss'); if (o0) o0.parentNode.removeChild(o0); return; }
  var conv = function (r, g, b) {
    var c = hue > 0 ? themeColor(r, g, b, hue) : null;
    if (day) c = dayColor(c || [r, g, b]);
    return c;
  };
  var build = function (src) {
    var css = src.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, function (m, h) {
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      var c = conv(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
      return c ? '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]) : m;
    }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,[^)]*)?\)/gi, function (m, r, g, b, a) {
      var c = conv(+r, +g, +b);
      return c ? (a ? 'rgba(' : 'rgb(') + c.join(',') + (a || '') + ')' : m;
    });
    if (fs !== 1) css = css.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, function (m, n) { return 'font-size: ' + Math.round(n * fs) + 'px'; });   // kattaroq yozuvlar
    if (day) css += '\n* { text-shadow: none !important; }\n';
    var old = $('thcss'); if (old) old.parentNode.removeChild(old);
    var st = document.createElement('style'); st.id = 'thcss'; st.innerHTML = css;
    document.getElementsByTagName('head')[0].appendChild(st);
  };
  if (CSS_SRC) return build(CSS_SRC);
  var x; try { x = new XMLHttpRequest(); x.open('GET', 'xc.css?th=' + now(), true); } catch (e) { return; }
  x.onreadystatechange = function () {
    if (x.readyState !== 4 || !x.responseText) return;
    CSS_SRC = x.responseText; build(CSS_SRC);
  };
  x.send(null);
}
function dayToggle() {
  DB.day = ((DB.day || 0) + 1) % 3; persist(); cloudSave(); statePush();
  applyTheme(DB.theme || 'red');
  toast(T('dn_' + DB.day), 3000);
}
setInterval(function () { if ((DB.day || 0) === 2 && isDay() !== LOOK_DAY) applyTheme(DB.theme || 'red'); }, 300000);   // avto: soat 7:00 / 19:00 da o'zi almashadi
function renderTop2() {
  var b = $('thbar');
  if (!b) { b = document.createElement('div'); b.id = 'thbar'; (document.getElementById('app') || document.body).appendChild(b); }
  var h = '';
  each(THEMES, function (x) { h += '<a class="' + ((DB.theme || 'red') === x[0] ? 'on' : '') + '" data-theme="' + x[0] + '" style="background:hsl(' + x[1] + ',85%,55%)" title="' + esc(T('th_' + x[0])) + '"></a>'; });
  var dm = DB.day || 0;
  h += '<i class="sp"></i><a class="dn" data-daymode="1">' + (dm === 1 ? '\u2600' : dm === 2 ? 'A' : '\u263e') + ' <span>' + esc(T('dn_s' + dm)) + '</span></a>';
  b.innerHTML = h;
  var lg = $('bLang');
  if (!lg) { var bar = $('bar'), v = $('bVer'); if (bar) { lg = document.createElement('div'); lg.id = 'bLang'; lg.className = 'lng'; lg.setAttribute('data-act', 'langmenu'); bar.insertBefore(lg, v); } }
  var fb = $('bFb');
  if (!fb) { var bar2 = $('bar'); if (bar2 && lg) { fb = document.createElement('div'); fb.id = 'bFb'; fb.className = 'lng fb'; fb.setAttribute('data-act', 'feedback'); bar2.insertBefore(fb, lg); } }
  if (fb) fb.innerHTML = '\u270e ' + esc(T('fb_btn'));
  if (lg) { var cur = null; each(LANGS, function (o) { if (o[0] === CUR_LANG) cur = o; }); lg.innerHTML = (cur ? langBox(cur) : '') + esc(cur ? cur[2] : '') + ' \u25b4'; }
}
/* ---- do'st profili: daraja, statistika, yutuqlar, oxirgi faollik ---- */
function openFrProfile(login) {
  api('uinfo', { login: login }, function (r) {
    if (!r.ok) return toast(r.msg || 'Xato');
    var u = r.u, st = u.st || {}, s = u.server ? srv(u.server) : null, last = u.last || null, ls = last ? srv(last.s) : null;
    var status = u.online ? '<span class="gm">\u25cf</span> ' + esc(u.server ? T('fr_in') + ((s && s.name) || u.server) + (u.map ? ' \u00b7 ' + u.map : '') : T('fr_menu'))
      : esc(T('fr_last').replace('{t}', agoText(u.seen)));
    var h = '<div class="fpro"><div class="fpav' + frameCls(u) + '" style="' + avStyle(u) + '">' + avInner(u, u.name) + '</div>' +
      '<div class="fpn">' + crown(u) + (u.clan ? '<span class="ctag">[' + esc(u.clan.tag) + ']</span> ' : '') + nickHtml(u) + ' <span class="mut">@' + esc(u.login) + '</span></div>' +
      '<div class="fprk">' + rankBadge(u) + ' <b>' + (u.rp || 0) + ' RP</b>' + (u.duels ? ' \u00b7 ' + esc(T('du_rec').replace('{w}', u.duels.w).replace('{l}', u.duels.l).replace('{d}', u.duels.d)) : '') + '</div>' +
      '<div class="mut">' + esc(T('lvl').replace('{n}', u.level)) + ' \u00b7 ID ' + esc(u.id) + (u.created ? ' \u00b7 ' + esc(T('fp_since').replace('{d}', new Date(u.created * 1000).toLocaleDateString())) : '') + '</div>' +
      '<div class="fpst">' + status + '</div>' +
      (last && !u.online ? '<div class="mut fpl">' + esc(T('fp_lastsrv')) + ': <b>' + esc((ls && ls.name) || last.s) + '</b>' + (last.m ? ' \u00b7 ' + esc(last.m) : '') + ' \u00b7 ' + esc(agoText(last.t)) + '</div>' : '') +
      '</div>' + statBox(st) +
      '<div class="fpg"><div><b>' + esc(fmtHours(st.t || 0)) + '</b><span>' + esc(T('ks_time')) + '</span></div><div><b>' + (st.best || 0) + '</b><span>' + esc(T('ks_best')) + '</span></div><div><b>' + (st.wk || 0) + '</b><span>' + esc(T('ks_week')) + '</span></div><div><b>' + (u.nfr || 0) + '</b><span>' + esc(T('m_friends')) + '</span></div></div>';
    var wp = ''; for (var w in (u.wpn || {})) if (u.wpn.hasOwnProperty(w)) wp += '<span class="wpt">' + esc(w) + ' <b>' + u.wpn[w] + '</b></span>';
    if (wp) h += '<div class="ph2 m">' + esc(T('fp_wpn')) + '</div><div>' + wp + '</div>';
    h += '<div class="ph2 m">' + esc(T('ac_title')) + ' (' + (u.ach || []).length + ')</div>' + achBadges(u.ach || []);
    var mine = ME && ME.login.toLowerCase() === u.login.toLowerCase();
    h += '<div class="ph2 m">' + esc(T('wl_title')) + '</div>';
    if (u.isfr || mine) h += '<div class="wladd"><input id="wlIn" class="tx" maxlength="200" placeholder="' + esc(T(mine ? 'wl_ph_me' : 'wl_ph')) + '"><a class="btn red" data-wallsend="' + esc(u.login) + '">' + esc(T('wl_send')) + '</a></div>';
    each(u.wall || [], function (w) {
      var can = mine || (ME && w.from.toLowerCase() === ME.login.toLowerCase());
      h += '<div class="wlr"><b data-frprof="' + esc(w.from) + '">' + esc(w.name) + '</b><small class="mut">' + esc(agoText(w.t)) + '</small>' + (can ? '<a class="wld" data-walldel="' + esc(w.id) + '" data-wallto="' + esc(u.login) + '">\u00d7</a>' : '') + '<div>' + esc(w.text) + '</div></div>';
    });
    if (!(u.wall || []).length) h += '<div class="mut">' + esc(T('wl_none')) + '</div>';
    h += '<div class="fpb">' + (u.isfr ? '<a class="btn" data-chat="' + esc(u.login) + '" data-chatn="' + esc(u.name) + '">' + ico('chat') + ' ' + esc(T('ch_btn')) + '</a>' +
      (u.online ? '<a class="btn" data-ring="' + esc(u.login) + '">' + ico('phone') + ' ' + esc(T('rg_btn')) + '</a><a class="btn" data-duelp="' + esc(u.login) + '" data-dueln="' + esc(u.name) + '">' + ico('swords') + ' ' + esc(T('du_btn')) + '</a>' : '') + '<a class="btn" data-frcmp="' + esc(u.login) + '">VS</a>' : '') +
      (u.server ? '<a class="btn red" data-ip="' + esc(u.server) + '">' + esc(T('join')) + '</a>' : '') + '<a class="btn" data-act="friends">\u2190 ' + esc(T('m_friends')) + '</a></div>';
    openSide('frprof', u.name, h);
  });
}
/* ---- qo'ng'iroq: do'st chaqirsa - ekranda katta oyna va qo'ng'iroq ovozi (30 soniya) ---- */
var RING = null, RING_TM = 0;
function showRing(r) {
  if (RING && RING.login === r.login) return;
  RING = r;
  var b = $('ringBox');
  if (!b) { b = document.createElement('div'); b.id = 'ringBox'; (document.getElementById('app') || document.body).appendChild(b); }
  b.innerHTML = '<div class="rgi">' + ico('phone') + '</div><b>' + esc(r.from) + '</b><span>' + esc(T('rg_in')) + '</span>' +
    '<div class="rgb"><a class="btn red" data-ringok="1">' + esc(T('rg_ans')) + '</a><a class="btn" data-ringok="0">' + esc(T('rg_dec')) + '</a></div>';
  b.style.display = 'block';
  var n = 0; clearInterval(RING_TM);
  var beep = function () { if (++n > 15 || !RING) { clearInterval(RING_TM); if (RING && n > 15) ringAnswer(false, true); return; } cmd('play buttons/bell1.wav'); };
  beep(); RING_TM = setInterval(beep, 2000);
}
function ringAnswer(ok, silent) {
  var r = RING; RING = null; clearInterval(RING_TM);
  var b = $('ringBox'); if (b) b.style.display = 'none';
  if (!r) return;
  if (!silent) api('ring_ans', { to: r.login, ok: ok ? '1' : '0' }, function () {});
  if (ok) { if (r.srv && r.srv !== CONNECTED) connect(r.srv); else openChat(r.login, r.from); }
}
/* ---- reyting kartasi: unvon, RP, keyingi unvongacha ---- */
function rankCard(u) {
  if (!u) return '';
  var rp = u.rp || 0, i = 0; each(RANKS, function (r, k) { if (rp >= r[1]) i = k; });
  var nx = RANKS[i + 1], pct = nx ? Math.round(100 * (rp - RANKS[i][1]) / (nx[1] - RANKS[i][1])) : 100;
  return '<div class="rkcard rk-' + RANKS[i][0] + '"><div class="rkico">' + esc(T('rk_' + RANKS[i][0]).charAt(0)) + '</div><b>' + esc(T('rk_' + RANKS[i][0])) + '</b><span>' + rp + ' RP</span>' +
    '<div class="xpw"><i style="width:' + pct + '%"></i></div><small class="mut">' + (nx ? esc(T('rk_next').replace('{n}', nx[1] - rp).replace('{r}', T('rk_' + nx[0]))) : esc(T('rk_max'))) + ' \u00b7 ' + esc(T('rk_how')) + '</small></div>';
}
/* ---- sandiqlar: har darajada bittadan. Ichida XP, maxsus nik rangi, ramka ---- */
var NCOLS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'], NRARE = ['gold', 'neon', 'ice', 'toxic', 'rainbow'], FRARE = ['ffire', 'fice', 'fneon', 'ftoxic', 'flegend'];
function openChests(keep) {
  if (!ME) return openLogin();
  var n = ME.chests || 0, inv = ME.inv || { nc: [], fr: [] };
  var h = '<div class="chst"><div class="chestbox' + (n ? '' : ' empty') + '" id="chBox"><i></i><b>' + n + '</b></div><div id="chRes"></div>' +
    (n ? '<a class="btn red big" data-act="chestopen">' + esc(T('ch_open')) + '</a>' : '<div class="mut">' + esc(T('ch_none')) + '</div>') + '<div class="mut small">' + esc(T('ch_how')) + '</div></div>';
  h += '<div class="ph2 m">' + esc(T('ch_nick')) + '</div><div class="ncl"><a class="' + (!ME.nc ? 'on' : '') + '" data-equipnc="">' + esc(T('ch_def')) + '</a>';
  each(NCOLS, function (c) { var ok = ME.level >= 10; h += '<a class="' + (ME.nc === c ? 'on' : '') + (ok ? '' : ' lock') + '" data-equipnc="' + c + '"><span class="nk nk-' + c + '">' + esc(ME.name) + '</span></a>'; });
  each(NRARE, function (c) { var ok = (inv.nc || []).indexOf(c) >= 0; h += '<a class="rare' + (ME.nc === c ? ' on' : '') + (ok ? '' : ' lock') + '" data-equipnc="' + (ok ? c : 'x') + '"><span class="nk nk-' + c + '">' + esc(ok ? ME.name : '???') + '</span></a>'; });
  h += '</div><div class="mut small">' + esc(T('ch_nick2')) + '</div><div class="ph2 m">' + esc(T('ch_frames')) + '</div><div class="frl"><a class="' + (!ME.frame ? 'on' : '') + '" data-equipfr=""><i class="av' + (ME.frame ? '' : frameCls(ME)) + '">' + avInner(ME) + '</i>' + esc(T('ch_def')) + '</a>';
  each(FRARE, function (f) { var ok = (inv.fr || []).indexOf(f) >= 0; h += '<a class="' + (ME.frame === f ? 'on' : '') + (ok ? '' : ' lock') + '" data-equipfr="' + (ok ? f : 'x') + '"><i class="av ' + f + '">' + (ok ? avInner(ME) : '?') + '</i>' + esc(T('fr_' + f)) + '</a>'; });
  openSide('chests', T('chs_title'), h + '</div>');
}
function chestOpen() {
  var b = $('chBox'); if (b) b.className = 'chestbox shake';
  api('chest_open', {}, function (r) {
    if (!r.ok) { if (b) b.className = 'chestbox'; return toast(r.msg || 'Xato', 5000); }
    setTimeout(function () {
      ME.chests = r.chests; ME.inv = r.inv; ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar();
      openChests(true);
      var w = r.rw, txt = w.type === 'xp' ? '+' + w.xp + ' XP' : w.type === 'nick' ? T('ch_got_nick') + ': ' + T('nc_' + w.id) : w.type === 'frame' ? T('ch_got_frame') + ': ' + T('fr_' + w.id) : '+1000 XP' + (w.id ? ' + ' + T('fr_' + w.id) : '');
      var el = $('chRes'); if (el) el.innerHTML = '<div class="chrw rr-' + w.rar + '"><small>' + esc(T('rr_' + w.rar)) + '</small><b>' + esc(txt) + '</b></div>';
      sfx('save');
    }, 1300);
  });
}
/* ---- duel: do'stni N daqiqaga chaqirish, kim ko'p kill qilsa ---- */
var DUEL = null, DUEL_INV = null, DUEL_TM = 0;
function showDuelInv(d) {
  if (DUEL_INV && DUEL_INV.id === d.id) return;
  DUEL_INV = d;
  var b = $('ringBox');
  if (!b) { b = document.createElement('div'); b.id = 'ringBox'; (document.getElementById('app') || document.body).appendChild(b); }
  b.innerHTML = '<div class="rgi du">' + ico('swords') + '</div><b>' + esc(d.from) + '</b><span>' + esc(T('du_in').replace('{m}', d.mins)) + '</span>' +
    '<div class="rgb"><a class="btn red" data-duelok="1">' + esc(T('du_acc')) + '</a><a class="btn" data-duelok="0">' + esc(T('rg_dec')) + '</a></div>';
  b.className = 'du'; b.style.display = 'block';
  cmd('play buttons/bell1.wav');
}
function duelAnswer(ok) {
  var d = DUEL_INV; DUEL_INV = null; var b = $('ringBox'); if (b) { b.style.display = 'none'; b.className = ''; }
  if (!d) return;
  api('duel_ans', { id: d.id, ok: ok ? '1' : '0' }, function (r) { if (r.ok && r.duel) { DUEL = r.duel; duelBar(); toast(T('du_go'), 7000); } });
}
function duelBar() {
  var b = $('duelBar');
  if (!DUEL) { if (b) b.style.display = 'none'; clearInterval(DUEL_TM); DUEL_TM = 0; return; }
  if (!b) { b = document.createElement('div'); b.id = 'duelBar'; (document.getElementById('app') || document.body).appendChild(b); }
  var tick = function () {
    if (!DUEL || playing()) return;                 // o'yin paytida chizmaymiz - menyu ochilganda 'show' qayta chizadi
    var left = Math.max(0, DUEL.end - Math.floor(now() / 1000)), f = null;
    each(FRIENDS, function (x) { if (x.login.toLowerCase() === String(DUEL.op).toLowerCase()) f = x; });
    b.innerHTML = ico('swords') + ' ' + esc(T('du_bar')) + ' <b>' + DUEL.me_k + '</b> : <b>' + DUEL.op_k + '</b> ' + esc(DUEL.opn) + ' \u00b7 ' + Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2) +
      (f && f.server && f.server !== CONNECTED ? ' <a class="btn red" data-ip="' + esc(f.server) + '">' + esc(T('du_join')) + '</a>' : '');
  };
  b.style.display = 'block'; tick(); clearInterval(DUEL_TM); DUEL_TM = setInterval(tick, 1000);
}
function duelResult(d) {
  if (d.st === 'no') return toast(T('du_no').replace('{n}', d.opn), 6000);
  var k = d.win === 'me' ? 'du_win' : d.win === 'op' ? 'du_lose' : 'du_draw';
  openSide('duelres', T('du_title'), '<div class="dures ' + d.win + '"><b>' + esc(T(k)) + '</b><div class="dusc">' + d.me_k + ' : ' + d.op_k + '</div><span>' + esc(T('du_vs').replace('{n}', d.opn)) + '</span><p>' + esc(T(k + '2')) + '</p></div>');
  if (d.win === 'me') sfx('save');
}
/* ---- o'yin xulosasi: serverdan chiqqanda (2+ daqiqa o'ynalgan bo'lsa) ---- */
var XP0 = null, GS_LAST = null;
function gameSummary(g) {
  if (!g || DB.dnd || DB.gsum === 0 || (g.d || 0) < 120 || (g.k || 0) + (g.x || 0) < 2) return;
  if (curModal && curModal !== 'mdSide') return;                // o'yinchi boshqa oynada - xalaqit bermaymiz
  var kd = g.x ? (g.k / g.x).toFixed(2) : String(g.k || 0), hs = g.k ? Math.round((g.h || 0) * 100 / g.k) : 0;
  var fav = '', fn = 0; for (var w in g.w || {}) if (g.w.hasOwnProperty(w) && g.w[w] > fn) { fn = g.w[w]; fav = w; }
  var clips = 0;
  each(OPTS && OPTS.vids || [], function (v) {
    var m = /^xc_(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)$/.exec(v.n || '');
    if (m && new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() >= g.t - 60000) clips++;
  });
  var xp = ME && XP0 != null && ME.xp >= XP0 ? ME.xp - XP0 : 0;
  var row = function (l, v) { return '<div class="kv"><span>' + esc(T(l)) + '</span><b>' + esc(String(v)) + '</b></div>'; };
  var h = '<div class="ydc gsum"><div class="gsh">' + esc(g.name || g.ip) + (g.map ? ' \u00b7 ' + esc(g.map) : '') + ' \u00b7 ' + esc(fmtHours(g.d)) + '</div>' +
    '<div class="ydg"><div><b>' + (g.k || 0) + '</b><span>' + esc(T('ks_k')) + '</span></div><div><b>' + (g.x || 0) + '</b><span>' + esc(T('ks_d')) + '</span></div>' +
    '<div><b>' + kd + '</b><span>K/D</span></div><div><b>' + hs + '%</b><span>' + esc(T('gs_hs')) + '</span></div></div>' +
    '<div class="stmore">' + row('gs_streak', g.bs || 0) + row('gs_hsn', g.h || 0) + (g.a ? row('gs_assist', g.a) : '') + (fav ? row('gs_fav', fav + ' (' + fn + ')') : '') +
    (xp ? row('gs_xp', '+' + xp + ' XP') : '') + (clips ? row('gs_clips', clips) : '') + '</div>' +
    '<p class="mut">' + esc(T((g.k || 0) >= 25 || kd >= 2 ? 'gs_great' : (g.k || 0) >= 10 ? 'gs_good' : 'gs_ok')) + '</p>' +
    (ME ? '<a class="btn red" data-act="gsshare">' + ico('share') + ' ' + esc(T('gs_share')) + '</a> ' : '') +
    (clips ? '<a class="btn red" data-act="gsvids">' + ico('play') + ' ' + esc(T('gs_vids')) + '</a> ' : '') +
    '<a class="btn" data-act="gsoff">' + esc(T('gs_off')) + '</a></div>';
  GS_LAST = g;
  openSide('gsum', T('gs_title'), h);
}
/* ---- "Kechagi o'yiningiz": kun boshida qisqa xulosa ---- */
function showYesterday(y) {
  var kd = y.d ? (y.k / y.d).toFixed(2) : String(y.k);
  openSide('yday', T('yd_title'), '<div class="ydc"><div class="ydg"><div><b>' + esc(fmtHours(y.t)) + '</b><span>' + esc(T('ks_time')) + '</span></div><div><b>' + y.g + '</b><span>' + esc(T('ks_g')) + '</span></div><div><b>' + y.k + '</b><span>' + esc(T('ks_k')) + '</span></div><div><b>' + kd + '</b><span>K/D</span></div></div>' +
    '<p>' + esc(T('yd_best').replace('{n}', y.best || 0)) + (y.top ? '<br>' + esc(T('yd_srv').replace('{s}', y.top)) : '') + '</p><p class="mut">' + esc(T(y.k >= 30 ? 'yd_great' : 'yd_ok')) + '</p></div>');
}
/* "Muammo bor" - diagnostika: versiya, kompyuter, o'yin sozlamalari, menyu tezligi va xatolari (konsol logi bilan birga yuboriladi) */
function diagText() {
  var L = ['===== X CLIENT DIAGNOSTIKA =====', 'Menyu: v' + (window.XC_V || '?') + ' · launcher v' + (VERSION || '?') + ' · ' + new Date().toString(),
    'Kompyuter: ' + (PCID || 'noma\'lum') + (HW ? ' · CPU ' + (HW.cpu || '?') + ' yadro · RAM ' + (HW.ram || '?') + ' MB · GPU ' + (HW.gpu || '?') + ' · ekran ' + (HW.res || '') : ''),
    'Akkaunt: ' + (ME ? ME.login + ' (' + ME.level + '-daraja)' : 'kirmagan') + ' · til: ' + CUR_LANG + ' · beta: ' + (window.XC_BETA ? 'ha' : 'yo\'q'),
    'Server: ' + (CONNECTED || 'ulanmagan') + (CONNECTED && SRV[CONNECTED] ? ' · ' + (SRV[CONNECTED].name || '') + ' · ping ' + (SRV[CONNECTED].ping || '?') : ''),
    'Menyu: ochilish ' + Math.round(PERF.load) + ' ms · eng katta qotish ' + Math.round(PERF.lag) + ' ms · menyu FPS ' + (PERF.fps || '?') + ' · yengil rejim: ' + (lowFx() ? 'ha' : 'yo\'q'),
    'Menyu xatolari: ' + ((window.XC_ERRS || []).join(' | ') || 'yo\'q')];
  var cv = ['fps_max', 'fps_override', 'gl_vsync', 'rate', 'cl_updaterate', 'cl_cmdrate', 'ex_interp', 'm_rawinput', 'sensitivity', 'volume', 'voice_enable', 'voice_modenable', 'voice_dsound', 'voice_forcemicrecord', 'voice_scale', 'voice_loopback', '_snd_mixahead', 'hisound', 'net_graph', 'developer', 'gl_texturemode', 'r_detailtextures', 'gamma', 'brightness'];
  var o = []; each(cv, function (n) { var v = readCvar(n); if (v != null) o.push(n + '=' + v); });
  L.push('Sozlamalar: ' + (o.join(' · ') || 'o\'qib bo\'lmadi'));
  return L.join('\n');
}
/* ---- menyu tezligi: ochilish vaqti, eng katta qotish, menyu FPS - sessiyada bir marta (admin panel > Tezlik) ---- */
var PERF = { t0: 0, load: 0, lag: 0, fps: 0, sent: false };
function perfStart() {
  try { var nt = window.performance && performance.timing && performance.timing.navigationStart; PERF.load = nt ? now() - nt : 0; } catch (e) {}
  var last = now();
  var iv = setInterval(function () { var t = now(); if (uiShown() && !document.webkitHidden) PERF.lag = Math.max(PERF.lag, t - last - 250); last = t; }, 250);
  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  if (raf) setTimeout(function () { var n = 0, t1 = now(); var f = function () { n++; if (now() - t1 < 3000) raf(f); else PERF.fps = Math.round(n * 1000 / (now() - t1)); }; raf(f); }, 8000);
  setTimeout(function () { clearInterval(iv); perfSend(); }, 120000);
}
function perfSend() {
  if (PERF.sent) return; PERF.sent = true;
  api('perf', { v: window.XC_V || '', load: Math.round(PERF.load), lag: Math.round(PERF.lag), fps: PERF.fps, game: CONNECTED ? 1 : 0, low: lowFx() ? 1 : 0 }, function () {});
}
/* ko'rinish buzilsa (blok o'z panelidan chiqib ketsa) - admin panelga xato sifatida yuboriladi (sessiyada bir marta) */
var LAYOUT_SENT = {};
function layoutCheck(where) {
  setTimeout(function () {
    try {
      var bad = '', sb = document.querySelector('.modal.on #setBody');
      if (sb) each(sb.children, function (c) { if (!bad && !/(^|\s)(pane|hsub|kpick)(\s|$)/.test(c.className || '') && c.getBoundingClientRect().width) bad = (c.className || c.tagName) + ' panel tashqarisida'; });
      each(document.querySelectorAll('.modal.on .pane'), function (pn) {
        if (bad) return; var pr = pn.getBoundingClientRect(); if (!pr.width) return;
        each(pn.children, function (c) { if (bad) return; var r = c.getBoundingClientRect(); if (r.width && (r.left < pr.left - 6 || r.right > pr.right + 6)) bad = (c.className || c.tagName); });
        var sib = pn.nextSibling; if (!bad && sib && sib.className && /pane/.test(sib.className)) { var sr = sib.getBoundingClientRect(); if (sr.width && pr.right > sr.left + 6) bad = 'panes-overlap'; }
      });
      if (bad && !LAYOUT_SENT[where]) { LAYOUT_SENT[where] = 1; api('jserr', { msg: 'layout: ' + where + ' (' + String(bad).slice(0, 60) + ')', src: 'layout', line: 0, ver: window.XC_V || '' }, function () {}); }
    } catch (e) {}
  }, 400);
}
/* menyu musiqasi: ro'yxat admin panelda (Sozlamalar > Menyu musiqasi), fayllar o'yin papkasida (Paketlar orqali) */
var MUSICS = null;
function musicPick() {
  if (MUSICS === null) { MUSICS = []; api('music', {}, function (r) { MUSICS = (r.ok && r.list) || []; if (curModal === 'mdSettings' && setTab === 'sound' && MUSICS.length) showSetTab('sound'); }); }
  var cur = DB.mtrack || 'media/gamestartup.mp3', h = '<div class="ph2 m">' + esc(T('mu_title')) + '</div><div class="mul">';
  each([[T('mu_def'), 'media/gamestartup.mp3']].concat(MUSICS), function (m) { h += '<a class="sgo' + (cur === m[1] ? ' on' : '') + '" data-mtrack="' + esc(m[1]) + '">\u266b ' + esc(m[0]) + '</a>'; });
  return h + '</div>';
}
/* CFG kodini qo'yish (kod yozilganda yoki "Mashhur CFGlar" dan) */
function cfgUse(code) {
  api('cfg_get', { code: code }, function (r) {
    if (!r.ok || !r.cfg) return toast(r.msg || T('cf_bad'));
    if (curModal !== 'mdSettings') openSettings('tools');
    var c2 = r.cfg; for (var k in c2.s || {}) if (c2.s.hasOwnProperty(k) && DEF.hasOwnProperty(k) && k !== 'name' && k !== 'tag') E[k] = c2.s[k];
    if (c2.b) { DB.binds = c2.b; DB.binds2 = c2.b2 || {}; loadBinds(); applyBinds(); persist(); }
    E.xp = presetOf(E); toast(T('cf_loaded'), 6000); showSetTab('tools');
  });
}
function openCfgTop() {
  api('cfg_top', {}, function (r) {
    if (!r.ok) return toast(r.msg || 'Xato');
    var h = '<div class="mut" style="margin-bottom:10px">' + esc(T('ct_sub')) + '</div>';
    each(r.list || [], function (x, i) {
      h += '<div class="ctr"><span class="rk c">' + (i + 1) + '</span><b>' + esc(x.title) + '</b><small class="mut">' + (x.who ? '@' + esc(x.who) + ' \u00b7 ' : '') + esc(T('ct_uses').replace('{n}', x.uses)) + ' \u00b7 ' + esc(x.code) + '</small>' +
        '<a class="btn" data-cfglike="' + esc(x.code) + '">\u2665 ' + x.likes + '</a><a class="btn red" data-cfguse="' + esc(x.code) + '">' + esc(T('ct_use')) + '</a></div>';
    });
    if (!(r.list || []).length) h += '<div class="empty">' + esc(T('ct_none')) + '</div>';
    openSide('cfgtop', T('ct_title'), h);
  });
}
/* "Taklif / shikoyat": matn admin panelga (Fikrlar) va Telegram'ga boradi */
var FBK = 'idea';
function openFeedback() {
  FBK = 'idea';
  var h = '<div class="mut" style="margin-bottom:10px">' + esc(T('fb_sub')) + '</div><div class="seg">';
  each(['idea', 'bug', 'complain'], function (k) { h += '<a class="' + (k === FBK ? 'on' : '') + '" data-fbk="' + k + '">' + esc(T('fb_' + k)) + '</a>'; });
  h += '</div><textarea id="fbTx" maxlength="1500" style="width:100%;height:150px;margin:8px 0 12px;padding:10px;box-sizing:border-box;resize:none" placeholder="' + esc(T('fb_ph')) + '"></textarea>' +
    '<a class="btn red" data-act="fbsend">' + esc(T('fb_send')) + '</a>';
  openSide('feedback', T('fb_title'), h);
  setTimeout(function () { try { $('fbTx').focus(); } catch (e) {} }, 50);
}
function sendFeedback() {
  var x = $('fbTx'), v = x ? clean(x.value) : '';
  if (v.length < 3) return toast(T('fb_short'));
  api('feedback', { text: v, kind: FBK, nick: MYNAME || (S && S.name) || '', ver: VERSION }, function (r) {
    if (!r.ok) return toast(r.msg || 'Xato');
    closeModal(); toast(T('fb_ok'), 5000);
  });
}
/* net_graph yoqilgan bo'lsa (o'yin uni ekranning pastki burchagiga chizadi) - pastki chiziqdagi yozuvlar shu burchakdan
 * chetga suriladi, ustma-ust tushmaydi. net_graphpos: 1 - o'ngda (odatiy), 2 - o'rtada, 3 - chapda */
function ngFit() {
  var b = $('bar'); if (!b) return;
  var ng = Number(readCvar('net_graph')) || 0, pos = Number(readCvar('net_graphpos')) || 1;
  var c = ng > 0 ? (pos === 3 ? ' ngl' : pos === 2 ? '' : ' ngr') : '';
  b.className = (b.className || '').replace(/(^|\s)ng[lr](?=\s|$)/g, '') + c;
}
setInterval(function () { if (!playing()) ngFit(); }, 5000);   // o'yin paytida tekshirmaymiz
function langMenu() {
  var p = $('lngpop');
  if (p) { p.parentNode.removeChild(p); return; }
  p = document.createElement('div'); p.id = 'lngpop';
  var h = '';
  each(LANGS, function (o) { h += '<a class="' + (CUR_LANG === o[0] ? 'on' : '') + '" data-lang="' + o[0] + '">' + langBox(o) + esc(o[2]) + '</a>'; });
  p.innerHTML = h; (document.getElementById('app') || document.body).appendChild(p);
}
function openSettings(tab) {
  detectXext();
  seedFromGame();
  E = copy(S);
  openModal('mdSettings');
  showSetTab(tab || (DEMO_PLAY ? 'demo' : setTab));   // demo ko'rilayotganda sozlamalar pult bilan ochiladi
}
function showSetTab(tab) {
  var nm = $('fName'); if (nm && E) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
  setTab = tab;
  if (!PCID && (tab === 'cont' || tab === 'pro' || tab === 'system') && now() - OPTS_TRY > 5000) { OPTS_TRY = now(); loadOpts(); }   // launcher keyinroq ochilgan bo'lsa - qayta topamiz
  each(document.querySelectorAll('#setTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  $('setBody').innerHTML = (PANES[tab] || PANES.game)();
  $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local'));
  if (tab === 'demo') vidsRefresh();
  if (tab === 'hud') { drawXhair(); drawScope(); if (XLIVE || E && S && xcode(E) !== xcode(S)) xLive(); }
  layoutCheck('settings/' + tab);
}
function tg(key, label, sub) {
  return '<div class="fr w"><div class="lb">' + esc(T(label)) + (sub ? '<small>' + esc(T(sub)) + '</small>' : '') + '</div>' +
    '<div class="tg' + (E[key] ? ' on' : '') + '" data-tg="' + key + '"><i></i></div></div>';
}
function sl(key, label, min, max, step, sub, unit) {
  return '<div class="fr"><div class="lb">' + esc(T(label)) + (sub ? '<small>' + esc(T(sub)) + '</small>' : '') + '</div><div class="ct2"><div class="sl">' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + E[key] + '" data-sl="' + key + '"' + (unit ? ' data-u="' + unit + '"' : '') + '><div class="vv" id="vv_' + key + '">' + E[key] + (unit || '') + '</div></div></div></div>';
}
function seg(key, label, opts) {
  var h = '';
  each(opts, function (o) { h += '<a class="' + (String(E[key]) === String(o[0]) ? 'on' : '') + '" data-seg="' + key + '" data-v="' + esc(o[0]) + '">' + esc(T(o[1])) + '</a>'; });
  return '<div class="fr"><div class="lb">' + esc(T(label)) + '</div><div class="ct2 seg">' + h + '</div></div>';
}
function rowb(title, sub, act, btn) {
  return '<div class="rowb"><b>' + esc(T(title)) + '</b><small>' + esc(T(sub)) + '</small><a class="btn" data-act="' + act + '">' + esc(T(btn)) + '</a></div>';
}
function daysAgo(t) { return Math.max(0, Math.floor((now() / 1000 - t) / 86400)); }
var PANES = {
  game: function () {
    var nets = '';
    each([['slow', 'n_slow', 'n_slow2'], ['mid', 'n_mid', 'n_mid2'], ['fast', 'n_fast', 'n_fast2']], function (o) {
      nets += '<a class="' + (E.net === o[0] ? 'on' : '') + '" data-seg="net" data-v="' + o[0] + '">' + esc(T(o[1])) + '<small>' + esc(T(o[2])) + '</small></a>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('g_player')) + '</div>' +
      '<div class="fr"><div class="lb">' + esc(T('g_name')) + '</div><div class="ct2"><input class="tx" id="fName" maxlength="28" value="' + esc(E.name) + '"></div></div>' +
      seg('tag', 'g_tag', [['X | ', 'X |'], ['[UZ] ', '[UZ]']].concat(ME && ME.clan ? [['[' + ME.clan.tag + '] ', '[' + ME.clan.tag + ']']] : []).concat([['', 'g_none']])) +
      '<div class="ph2 m">' + esc(T('g_net')) + '</div><div class="big">' + nets + '</div>' +
      '<div class="mut" style="margin:10px 0 14px;font-size:12px">' + esc(T('g_net_note')) + '</div>' + tg('reconn', 'g_reconn') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('g_server')) + '</div>' +
      tg('queue', 'g_queue', 'g_queue2') + tg('mp3off', 'g_mp3', 'g_mp32') + tg('hand', 'g_hand') + tg('fastsw', 'g_fast') +
      (ncHas('cl_discordrpc') ? '<div class="ph2 m">Discord</div>' + tg('drpc', 'g_drpc', 'g_drpc2') + tg('drpcs', 'g_drpcs') + tg('drpcj', 'g_drpcj') : '') + '</div>';
  },
  keys: function () {
    var rows = '';
    each(ACTIONS, function (ac) {
      var k = BINDS[ac[0]] || '', k2 = BINDS2[ac[0]] || '', w1 = KEYWAIT === ac[0] && KEYSLOT === 1, w2 = KEYWAIT === ac[0] && KEYSLOT === 2;
      rows += '<div class="kb">' + esc(CUR_LANG === 'ru' || LFALL[CUR_LANG] === 'ru' ? ac[2] : ac[1]) +
        '<span class="k1' + (w1 ? ' w' : '') + '" data-bind="' + esc(ac[0]) + '">' + (w1 ? esc(T('k_press')) : esc(keyLabel(k) || '\u2014')) + '</span>' +
        '<span class="k2' + (w2 ? ' w' : '') + '" data-bind2="' + esc(ac[0]) + '">' + (w2 ? esc(T('k_press')) : esc(keyLabel(k2) || '+')) + '</span></div>';
    });
    return '<div class="pane full"><div class="ph2">' + esc(T('k_title')) + '<span class="mut" style="float:right;letter-spacing:0;font-weight:normal">' + esc(T('k_note2')) + '</span></div>' +
      '<div class="kcols">' + rows + '</div>' +
      '<div class="ph2 m">' + esc(T('k_buy')) + '</div>' + tg('buykeys', 'k_buy2') +
      '<div class="mut" style="font-size:12px;line-height:20px">F1: M4A1/AK-47 \u00b7 F2: AWP \u00b7 F3: Kevlar+Helmet, Defuse kit \u00b7 F4: HE + 2\u00d7Flash + Smoke</div>' +
      '<a class="btn" style="margin:14px 8px 0 0" data-act="keysdef">' + esc(T('k_def')) + '</a><a class="btn out" style="margin:14px 0 0" data-act="keysfactory">' + esc(T('k_factory')) + '</a></div>' +
      (KEYWAIT ? '<div class="kpick">' + esc(T('k_pick')) + ' ' + ['MOUSE3', 'MOUSE4', 'MOUSE5', 'MWHEELUP', 'MWHEELDOWN'].map(function (k) { return '<a data-pickkey="' + k + '">' + esc(T('kp_' + k)) + '</a>'; }).join('') + '<a data-pickkey="">' + esc(T('cancel')) + '</a></div>' : '');
  },
  mouse: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('mo_title')) + '</div>' + sl('sens', 'mo_sens', 0.5, 10, 0.1) + sl('zoom', 'mo_zoom', 0.2, 3, 0.05) +
      '<div class="ph2 m">' + esc(T('aw_title')) + '</div>' + sl('awps', 'aw_sens', 0, 10, 0.1) + sl('awpz', 'aw_zoom', 0.2, 3, 0.05) +
      '<div class="mut" style="font-size:12px;line-height:18px">' + esc(T('aw_note')) + '</div></div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('raw', 'mo_raw', 'mo_raw2') + tg('filter', 'mo_filter') + tg('inv', 'mo_inv') + '</div>';
  },
  sound: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('so_title')) + '</div>' + sl('vol', 'so_vol', 0, 1, 0.05) + sl('mus', 'so_mus', 0, 1, 0.05) + sl('vscale', 'so_vscale', 0, 2, 0.1) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('voice', 'so_voice') + tg('micwarm', 'so_micwarm', 'so_micwarm2') + tg('micfix', 'so_micfix', 'so_micfix2') + tg('loop', 'so_loop') + tg('mute', 'so_mute') + tg('uisnd', 'so_ui', 'so_ui2') + tg('mmusic', 'so_music', 'so_music2') +
      '<div class="ph2 m">' + esc(T('so_q')) + '</div>' + tg('hisnd', 'so_hi') + seg('mixa', 'so_mix', [[0.1, 'so_mix2'], [0.15, 'so_mix3']]) + musicPick() + '</div>';
  },
  video: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('v_title')) + '</div>' +
      seg('fps', 'v_fps', [[100, '100'], [144, '144'], [200, '200'], [300, '300'], [500, '500']]) +
      '<div class="mut" style="margin:-6px 0 8px;font-size:12px">' + esc(T('v_fps2')) + '</div>' +
      sl('gamma', 'v_bright', 1.8, 3, 0.1) + sl('fov', 'v_fov', 70, 100, 1, 'v_fov2') + sl('vmfov', 'v_vm', 70, 100, 1) + sl('decals', 'v_dec', 300, 4000, 100) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' +
      '<div class="fr"><div class="lb">' + esc(T('sy_screen')) + '</div><div class="ct2"><a class="dd wide" data-dd="res"><span>' + esc(ddLabel('res')) + '</span><i>\u25be</i></a></div></div>' +
      tg('hor', 'v_hor') + tg('vsync', 'v_vsync') + tg('showfps', 'v_showfps') + tg('dyn', 'v_dyn') + '</div>';
  },
  tools: function () {                            // Qo'shimcha: profillar, kalkulyator, tayyor uslublar, demolar
    var pr = '';
    each(profSlots(), function (sl, i) {
      pr += '<div class="rowb"><b class="pn" data-pren="' + i + '">' + esc(sl.n) + ' <span class="mut">✎</span></b><small>' + esc(sl.t ? fmtTime(sl.t) : T('pf_empty')) + '</small>' +
        (sl.t ? '<a class="btn" style="right:116px" data-prload="' + i + '">' + esc(T('pf_load')) + '</a>' : '') + '<a class="btn" data-prsave="' + i + '">' + esc(T('pf_save')) + '</a></div>';
    });
    var games = '';
    each(CALC_G, function (g) { games += '<a class="' + (CALC === g[0] ? 'on' : '') + '" data-calc="' + g[0] + '">' + g[1] + '</a>'; });
    var st = '';
    var lastG = '';
    each(STYLES, function (x) {
      if (x[4] !== lastG) { lastG = x[4]; st += '<div class="stg">' + esc(T('sg_' + lastG)) + '</div>'; }
      st += '<div class="rowb sty"><b>' + esc(T(x[1])) + '</b><small>' + esc(T(x[2])) + '</small><a class="btn" data-style="' + x[0] + '">' + esc(T('st_apply')) + '</a></div>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('pf_title')) + '</div>' + pr +
      '<div class="ph2 m">' + esc(T('cc_title')) + '</div>' +
      '<div class="fr"><div class="lb">' + esc(T('cc_game')) + '</div><div class="ct2 seg">' + games + '</div></div>' +
      '<div class="fr"><div class="lb">' + esc(T('cc_in')) + '</div><div class="ct2 code"><input id="calcIn" value="' + esc(CALC_V) + '"><span class="ccres" id="calcOut">' + calcOut() + '</span>' +
      '<a class="btn b2" data-act="calcapply">' + esc(T('x_apply')) + '</a></div></div>' +
      '<div class="ph2 m">' + esc(T('cf_title')) + '</div><div class="mut" style="font-size:12px;margin-bottom:8px">' + esc(T('cf_note')) + '</div>' +
      '<a class="btn" data-act="cfgshare" style="margin:0 8px 0 0">' + esc(T('cf_get')) + '</a><a class="btn" data-act="cfgload" style="margin:0 8px 0 0">' + esc(T('cf_load')) + '</a><a class="btn red" data-act="cfgtop">\u2605 ' + esc(T('ct_title')) + '</a>' +
      '<div id="cfgOut"></div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('st_title')) + '</div>' + st + '</div>';
  },
  demo: function () {                            // F10 videolari: sifat, ko'rsatma, "Mening videolarim" (ochish / o'chirish / papka - launcher bajaradi)
    var vq = OPTS && OPTS.vq || 'mid', vqs = '', rows = '', vids = OPTS && OPTS.vids || [];
    var vtg = function (k, on, label, sub) { return '<div class="fr w"><div class="lb">' + esc(T(label)) + '<small>' + esc(T(sub)) + '</small></div><div class="tg' + (on ? ' on' : '') + '" data-vopt="' + k + '"><i></i></div></div>'; };
    each([['hi', 'vq_hi', 'vq_hi2'], ['mid', 'vq_mid', 'vq_mid2'], ['low', 'vq_low', 'vq_low2']], function (o) {
      vqs += '<a class="' + (vq === o[0] ? 'on' : '') + '" data-ovq="' + o[0] + '">' + esc(T(o[1])) + '<small>' + esc(T(o[2])) + '</small></a>';
    });
    each(vids, function (v) {
      if ((v.sh === 'q' || /^\d+$/.test(v.sh || '')) && (!v.sht || now() / 1000 - v.sht > 1800)) v.sh = '';   // 30 daqiqa siljimagan yuklash - qayta ulashish mumkin
      var m = /^xc_(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)$/.exec(v.n || ''); if (!m) return;
      var t = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(), sec = v.sec | 0;
      var info = [(v.mb | 0) + ' MB'];
      if (sec) info.push(Math.floor(sec / 60) + ':' + pad(sec % 60));
      if (v.q) info.push(T('vq_' + v.q));
      rows += '<div class="dmr"><b>' + esc(fmtTime(t)) + ' · ' + esc(m[3] + '.' + m[2] + '.' + m[1]) + '</b><small>' + esc(info.join(' · ')) + '</small>' +
        '<a class="btn vdel" data-vdel="' + esc(v.n) + '" title="' + esc(T('vd_del')) + '">' + ico('trash') + '</a>' +
        (v.sh && /^[a-f0-9]{12}$/.test(v.sh) ? '<a class="btn vsh on" data-vlink="' + esc(v.sh) + '" title="' + esc(T('vs_copy')) + '">' + ico('link') + '</a>' :
          v.sh === 'q' || /^\d+$/.test(v.sh || '') ? '<span class="btn vsh wait">' + (v.sh === 'q' ? '\u2026' : v.sh + '%') + '</span>' :
          '<a class="btn vsh" data-vshare="' + esc(v.n) + '" title="' + esc(T('vs_share')) + '">' + ico('share') + '</a>') +
        '<a class="btn vcut" data-vtrim="' + esc(v.n) + '" data-vsec="' + sec + '" title="' + esc(T('vd_trim')) + '">' + ico('cut') + '</a>' +
        '<a class="btn red" data-vopen="' + esc(v.n) + '">' + ico('play') + ' ' + esc(T('vd_open')) + '</a></div>';
    });
    return '<div class="pane l"><div class="f10box big2"><b>' + esc(T('f10_t')) + '</b>' + esc(T('f10_1')) + '<br>' + esc(T('f10_2')) + '<br>' + esc(T('f9_1')) + '<br>' + esc(T('f10_3')) + '</div>' +
      '<div class="ph2 m">' + esc(T('vq_title')) + '</div><div class="big vqb">' + vqs + '</div>' +
      vtg('rb', OPTS && OPTS.rb, 'vb_rb', 'vb_rb2') + vtg('acl', DB.acl !== 0, 'vb_acl', 'vb_acl2') + vtg('mic', OPTS && OPTS.mic, 'vb_mic', 'vb_mic2') + vtg('gsum', DB.gsum !== 0, 'gs_tg', 'gs_tg2') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('vd_title')) + ' <a class="btn vfold" data-vfold="1">' + ico('folder') + ' ' + esc(T('vd_folder')) + '</a></div>' +
      '<div class="dml dml2">' + (rows || '<div class="empty">' + esc(T(PCID ? 'vd_none' : 'sy_nolaunch')) + '</div>') + '</div>' +
      '<div class="mut" style="font-size:12px;margin-top:8px">' + esc(T('vd_note')) + '</div></div>';
  },
  cont: function () {                             // Kontent: spray, skrinshotlar, mavzu, paketlar
    if (PACKS === null) loadPacks();
    var th = '';
    each(THEMES, function (x) { th += '<a class="' + ((DB.theme || 'red') === x[0] ? 'on' : '') + '" data-theme="' + x[0] + '" style="background:hsl(' + x[1] + ',85%,58%)" title="' + esc(T('th_' + x[0])) + '"></a>'; });
    var pk = '';
    each(PACKS || [], function (x) {
      var on = (',' + (OPTS.packs || '') + ',').indexOf(',' + x.id + ',') >= 0;
      pk += '<div class="fr w"><div class="lb">' + esc(x.name) + '<small>' + esc((x.desc ? x.desc + ' · ' : '') + (Math.round(x.size / 104857.6) / 10) + ' MB') + '</small></div><div class="tg' + (on ? ' on' : '') + '" data-pack="' + esc(x.id) + '"><i></i></div></div>';
    });
    var nol = PCID ? '' : '<div class="chk bad">' + esc(T('sy_nolaunch')) + '</div>';
    return '<div class="pane l"><div class="ph2">' + esc(T('sp_title')) + '</div>' + nol +
      // spray hammada bir xil - X CLIENT logotipi (XCLauncher.exe har ochilishda o'zi qo'yadi)
      '<div class="spr"><div class="sprv"><img src="spray_logo.png" alt=""></div><div class="mut">' + esc(T('sp_fixed')) + '</div></div>' +
      '<div class="ph2 m">' + esc(T('sh_title')) + '</div>' +
      '<div class="fr w"><div class="lb">' + esc(T('sh_up')) + '<small>' + esc(T('sh_up2')) + '</small></div><div class="tg' + (OPTS.shots ? ' on' : '') + '" data-otg="shots"><i></i></div></div>' +
      '<a class="btn" style="margin:0" data-act="gallery">' + esc(T('sh_open')) + '</a>' +
      '<div class="ph2 m">' + esc(T('th_title')) + '</div><div class="ths">' + th + '</div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('pk_title')) + '</div>' +
      (PACKS && !PACKS.length ? '<div class="empty">' + esc(T('pk_none')) + '</div>' : (PACKS ? pk : '<div class="empty">' + esc(T('loading')) + '</div>')) +
      '<div class="mut" style="font-size:12px;margin-top:10px">' + esc(T('pk_note')) + '</div></div>';
  },
  pro: function () {                              // Kengaytirilgan: grafika, internet, qurol, ekran
    return '<div class="pane l"><div class="ph2">' + esc(T('pr_gfx')) + '</div>' +
      tg('detail', 'pr_detail') + tg('shadows', 'pr_shadows') +
      '<div class="ph2 m">' + esc(T('pr_fps')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('pr_cfg')) + '</b><small>' + esc(T('pr_cfg2')) + '</small><a class="btn red" data-act="procfg">' + esc(T('pr_cfgb')) + '</a></div>' +
      '<div class="rowb"><b>' + esc(T('pr_fps')) + '</b><small>' + esc(T('pr_fps2')) + '</small><a class="btn red" data-act="fpsmode">' + esc(T('pr_fpsb')) + '</a></div>' +
      '<div class="rowb"><b>' + esc(T('hw_title')) + ' <span class="gr">' + esc(HW ? T('hw_' + hwClass()) : '') + '</span></b><small>' + esc(hwText()) + '</small>' +
      (HW ? '<a class="btn" data-act="hwauto">' + esc(T('hw_auto')) + '</a>' : '') + '</div>' +
      '<div class="fr w"><div class="lb">' + esc(T('pr_prio')) + '<small>' + esc(T('pr_prio2')) + '</small></div><div class="tg' + (OPTS.prio ? ' on' : '') + '" data-otg="prio"><i></i></div></div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('pr_net')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('nt_title')) + '</b><small>' + esc(NETT_RUN ? T('nt_run') : NETT ? T('nt_res').replace('{p}', NETT.best).replace('{j}', NETT.jit).replace('{l}', NETT.loss) + ' \u2192 ' + T('n_' + NETT.rec.net) : T('nt_desc')) + '</small>' +
        (NETT && !NETT_RUN ? '<a class="btn red" style="right:110px" data-act="netapply">' + esc(T('x_apply')) + '</a>' : '') + '<a class="btn" data-act="nettest">' + esc(T('nt_btn')) + '</a></div>' +
      seg('interp', 'pr_interp', [[0.01, '0.01'], [0.05, '0.05'], [0.1, '0.1']]) +
      '<div class="mut" style="margin:-6px 0 8px;font-size:12px">' + esc(T('pr_interp2')) + '</div>' +
      tg('lw', 'pr_lw', 'pr_lw2') + tg('lc', 'pr_lc') +
      '<div class="ph2 m">' + esc(T('pr_wpn')) + '</div>' + seg('bob', 'pr_bob', [[0.01, 'pr_bob1'], [0, 'pr_bob0']]) +
      '<div class="ph2 m">' + esc(T('pr_scr')) + '</div>' + sl('saytm', 'pr_say', 1, 20, 1) +
      seg('ngpos', 'pr_ngpos', [[1, 'pr_ng1'], [2, 'pr_ng2'], [3, 'pr_ng3']]) + '</div>';
  },
  hud: function () {
    var sub = '';
    each([['main', 'hx_main'], ['snip', 'hx_snip'], ['wpn', 'hx_wpn'], ['cam', 'hx_cam'], ['radar', 'hx_radar'], ['misc', 'hx_misc']], function (o) { sub += '<a class="' + (HSUB === o[0] ? 'on' : '') + '" data-hsub="' + o[0] + '">' + esc(T(o[1])) + '</a>'; });
    sub = '<div class="hsub">' + sub + '</div>';
    if (HSUB === 'snip') {
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hx_snip')) + '</div><div id="xPrev" class="big"><canvas id="xScope" width="524" height="220"></canvas></div>' +
        '<div class="hnote">' + esc(T('hx_zoom')) + '</div></div>' +
        '<div class="pane r hp"><div class="ph2">&nbsp;</div>' + sl('zoom', 'mo_zoom', 0.1, 3, 0.05) + sl('sens', 'mo_sens', 0.1, 10, 0.05) + '</div>';
    }
    if (HSUB === 'wpn') {
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hw_pos')) + '</div>' +
        sl('vmx', 'hw_x', -10, 10, 0.5) + sl('vmy', 'hw_y', -10, 10, 0.5) + sl('vmz', 'hw_z', -10, 10, 0.5) + sl('vmfov', 'v_vm', 70, 100, 1) +
        tg('vmshift', 'hw_shift', 'hw_shift2') + '</div>' +
        '<div class="pane r hp"><div class="ph2">' + esc(T('hw_lagt')) + '</div>' +
        seg('lagst', 'hw_lag', [[0, 'hw_lag0'], [1, 'hw_lag1'], [2, 'hw_lag2']]) + sl('lagsc', 'hw_lagsc', 0, 3, 0.1) + sl('lagsp', 'hw_lagsp', 1, 20, 0.5) +
        seg('bob', 'pr_bob', [[0.01, 'pr_bob1'], [0, 'pr_bob0']]) + tg('camint', 'hw_cam', 'hw_cam2') +
        '<div class="hfoot"><span class="mut">' + esc(T('hw_note')) + '</span><a class="btn" data-act="vmdef">' + esc(T('hx_std')) + '</a></div></div>';
    }
    if (HSUB === 'cam') {
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hw_anim')) + '</div>' +
        seg('bobst', 'hw_bob', [[0, 'hw_bob0'], [1, 'hw_bob1'], [2, 'hw_bob2']]) +
        (Number(E.bobst) === 2 ? sl('bobv', 'hc_bobv', 0, 1, 0.01) + sl('bobl', 'hc_bobl', 0, 1, 0.01) + sl('boblow', 'hc_boblow', 0, 20, 0.5) :
          '<div class="mut" style="margin:-4px 0 10px;font-size:12px">' + esc(T('hc_csgo')) + '</div>') +
        tg('bobcam', 'hc_bobcam', 'hc_bobcam2') + '</div>' +
        '<div class="pane r hp"><div class="ph2">' + esc(T('hc_title')) + '</div>' +
        sl('roll', 'hc_roll', 0, 5, 0.5) + sl('rollspd', 'hc_rollspd', 50, 400, 10) + sl('fovlerp', 'hc_fov', 0, 0.5, 0.05) + sl('camsc', 'hc_camsc', 0, 2, 0.1) +
        '<div class="mut" style="font-size:12px;margin-top:4px">' + esc(T('hc_roll2')) + '<br>' + esc(T('hc_fov2')) + '</div>' +
        '<div class="hfoot"><span class="mut">' + esc(T('hw_note')) + '</span><a class="btn" data-act="camdef">' + esc(T('hx_std')) + '</a></div></div>';
    }
    if (HSUB === 'radar' && !radarNC()) {          // bu NextClient versiyasida xaritali radar (hud_radar_*) yo'q - faqat CS 1.6 radari
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hx_radar')) + '</div>' + tg('radar', 'h_radar') +
        '<div class="mut" style="font-size:12px;margin-top:6px">' + esc(T('h_rnone')) + '</div></div>';
    }
    if (HSUB === 'radar') {
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hx_radar')) + '</div>' +
        seg('rmode', 'h_rmode', [[1, 'h_rmode1'], [0, 'h_rmode0']]) +
        sl('rscale', 'h_rscale', 50, 300, 5, null, '%') + sl('rmap', 'h_rmap', 0.25, 3, 0.05) + sl('ropac', 'h_ropac', 0, 100, 5, null, '%') +
        seg('rbg', 'h_rbg', [[0, 'h_rbg0'], [1, 'h_rbg1']]) + tg('rround', 'h_rround') + '</div>' +
        '<div class="pane r hp"><div class="ph2">&nbsp;</div>' +
        tg('rrot', 'h_rrot') + tg('rfull', 'h_rfull') + tg('rtracks', 'h_rtracks') + tg('rallies', 'h_rallies', 'h_rallies2') +
        tg('rnames', 'h_rnames') + sl('rns', 'h_rns', 0.6, 2, 0.1) + tg('rhp', 'h_rhp') + sl('rhs', 'h_rhs', 0.3, 4, 0.1) +
        '<div class="hfoot"><span class="mut">' + esc(T('h_cs2b')) + '</span><a class="btn" data-act="rcs2">' + esc(T('h_cs2')) + '</a></div></div>';
    }
    if (HSUB === 'misc') {
      var hz = '';
      each([[100, '100%'], [150, '150%'], [200, '200%']], function (o) { hz += '<a class="' + ((OPTS.hud || 100) === o[0] ? 'on' : '') + '" data-ohud="' + o[0] + '">' + o[1] + '</a>'; });
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('h_size')) + '</div>' +
        '<div class="fr"><div class="lb">' + esc(T('h_size2')) + '</div><div class="ct2 seg">' + hz + '</div></div>' +
        '<div class="mut" style="margin:-6px 0 10px;font-size:12px">' + esc(PCID ? T('h_size3') : T('sy_nolaunch')) + '</div>' +
        '<div class="ph2 m">' + esc(T('hx_kill')) + '</div>' + sl('dmax', 'h_kills', 3, 10, 1) + sl('dtime', 'h_dtime', 2, 15, 1, null, 's') + tg('hs', 'h_hs') + '</div>' +
        '<div class="pane r hp"><div class="ph2">' + esc(T('h_title')) + '</div>' + tg('netg', 'h_net') + tg('cid', 'h_cid') + tg('nover', 'h_draw') + '</div>';
    }
    var pal = ['255 59 59', '50 250 50', '0 230 255', '255 210 60', '255 80 220', '255 255 255'];
    if (pal.indexOf(E.xc) < 0 && /^\d+ \d+ \d+$/.test(E.xc)) pal.push(E.xc);
    var cols = '';
    each(pal, function (c) { cols += '<a class="' + (E.xc === c ? 'on' : '') + '" data-seg="xc" data-v="' + c + '" style="background:rgb(' + c.split(' ').join(',') + ')"></a>'; });
    var si = Math.max(0, SZ.indexOf(E.xs)), xt = Number(E.xt);
    var off = function (key, label, min, max) {
      return XSUP[key] ? sl(key, label, min, max, 1) : '';          // NextClient'da bo'lsagina ko'rsatamiz (hozircha yo'q)
    };
    var ck = function (k, label, on, dis) {
      return '<a class="ck' + (on ? ' on' : '') + (dis ? ' dis' : '') + '"' + (dis ? '' : ' data-xchk="' + k + '"') + '><i>' + (on ? '✓' : '') + '</i>' + esc(T(label)) + '</a>';
    };
    return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('x_title')) + '</div>' +
      '<div id="xPrev" class="big"><canvas id="xCan" width="524" height="220"></canvas></div>' +
      '<div class="fr" style="margin-top:14px"><div class="lb">' + esc(T('hx_style')) + '</div><div class="ct2"><a class="dd wide" data-dd="xpre"><span>' + esc(ddLabel('xpre')) + '</span><i>▾</i></a></div></div>' +
      '<div class="fr"><div class="lb">' + esc(T('x_color')) + '</div><div class="ct2 sw">' + cols + '<a class="btn pick" data-act="xpick">' + esc(T('hx_pick')) + '</a></div></div>' +
      '<div class="fr cw"><div class="lb">' + esc(T('x_code')) + '</div><div class="ct2 code"><input id="xCode" value="' + esc(xcode(E)) + '"><a class="btn" data-act="xcopy">' + esc(T('x_copy')) + '</a><a class="btn b2" data-act="xcode">' + esc(T('x_apply')) + '</a></div></div>' + xGallery() + '</div>' +
      '<div class="pane r hp"><div class="ph2">&nbsp;</div>' +
      '<div class="fr"><div class="lb">' + esc(T('x_size')) + '</div><div class="ct2"><a class="dd xsz" data-dd="xsz"><span>' + esc(ddLabel('xsz')) + '</span><i>▾</i></a>' +
      '<div class="sl sl2"><input type="range" min="0" max="3" step="1" value="' + si + '" data-xsz="1"><div class="vv" id="vv_xsz">x' + (si + 1) + '</div></div></div></div>' +
      off('xthick', 'hx_thick', 1, 5) + off('xgap', 'hx_gap', 0, 10) +
      '<div class="fr"><div class="lb">' + esc(T('hx_opaq')) + '</div><div class="ct2"><div class="sl"><input type="range" min="0" max="1" step="1" value="' + (E.xtr ? 0 : 1) + '" data-xop="1"><div class="vv" id="vv_xop">' + (E.xtr ? '60%' : '100%') + '</div></div></div></div>' +
      off('xout', 'hx_outl', 0, 3) +
      '<div class="cks">' + ck('dot', 'hx_dot', xt === 3) + ck('t', 'hx_t', xt === 1) + ck('circle', 'hx_circ', xt === 2) + '</div>' +
      '<div class="hfoot"><span class="mut">' + (XSUP.xthick && XSUP.xgap && XSUP.xout ? '' : esc(T('hx_na'))) + '</span><a class="btn" data-act="xdef">' + esc(T('hx_std')) + '</a><a class="btn xt" data-act="xtest">' + esc(T('hx_test')) + '</a></div></div>';
  },
  account: function () {
    if (!ME) {
      return '<div class="pane full" style="text-align:center;padding-top:110px"><div class="prof"><div class="bigav">?</div><h2>' + esc(T('a_none')) + '</h2>' +
        '<div class="id" style="margin:10px 0 24px">' + esc(T('a_none2')) + '</div><a class="btn red" style="height:44px;line-height:42px;padding:0 30px" data-act="login">' + esc(T('a_login')) + '</a></div></div>';
    }
    var last = ME.cloudt ? (now() / 1000 - ME.cloudt < 120 ? T('a_now') : fmtTime(ME.cloudt * 1000)) : T('a_never');
    return '<div class="pane l"><div class="ph2">' + esc(T('a_profile')) + '</div><div class="prof"><div class="bigav' + frameCls(ME) + '" style="' + avStyle(ME) + '">' + avInner(ME) + '<a class="avcam" data-act="avpick">' + esc(T('a_photo')) + '</a></div>' +
      '<h2>' + esc(ME.name) + '</h2><div class="id">ID: ' + esc(ME.id) + ' \u00b7 ' + esc(T('lvl').replace('{n}', ME.level)) + '</div>' +
      '<div class="xpw"><i style="width:' + Math.round(ME.lvlxp * 100 / ME.lvlmax) + '%"></i></div><div class="xpt">' + ME.lvlxp + ' / ' + ME.lvlmax + ' XP</div>' +
      '<div class="avcols">' + avColors() + '</div>' +
      '<a class="btn" data-act="rename" style="margin:0 6px 0 0">' + esc(T('a_rename')) + '</a><a class="btn" data-act="avpick" style="margin:0 6px 0 0">' + esc(T('a_photo')) + '</a>' +
      (ME.av ? '<a class="btn out" data-act="avdel" style="margin:0">' + esc(T('a_photodel')) + '</a>' : '') + '</div>' +
      (ME.vip ? '<div class="vipbox"><b>' + esc(T('a_vip')) + '</b><span>' + esc(T('a_vip2')) + '</span></div>' : '') +
      statBox(ME.st) + achBadges(ME.ach) + '<a class="btn" data-act="stats" style="margin:4px 6px 0 0">' + esc(T('ks_more')) + '</a><a class="btn" data-act="ref" style="margin:4px 6px 0 0">\u2709 ' + esc(T('rf_btn')) + '</a><a class="btn" data-frprof="' + esc(ME.login) + '" style="margin:4px 6px 0 0">' + ico('user') + ' ' + esc(T('fp_mine')) + '</a><a class="btn red" data-act="chests" style="margin:4px 0 0">' + esc(T('ch_btn2').replace('{n}', ME.chests || 0)) + '</a></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('a_sec')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('a_email')) + '</b><small>' + esc(ME.email || '\u2014') + '</small><a class="btn" data-act="email">' + esc(T('a_change')) + '</a></div>' +
      '<div class="rowb"><b>' + esc(T('a_pass')) + '</b><small>' + esc(T('a_pw_ago').replace('{d}', daysAgo(ME.pwchanged))) + '</small><a class="btn" data-act="passwd">' + esc(T('a_change')) + '</a></div>' +
      '<div class="rowb"><b>Telegram</b><small>' + esc(T(ME.tglinked ? 'tg_on' : 'tg_off')) + '</small><a class="btn" data-act="tglink">' + esc(T(ME.tglinked ? 'tg_re' : 'tg_link')) + '</a></div>' +
      '<div class="ph2 m">' + esc(T('a_cloud')) + '</div>' +
      '<div class="fr w"><div class="lb">' + esc(T('a_auto')) + '<small>' + esc(T('a_auto2')) + '</small></div><div class="tg' + (DB.autosave ? ' on' : '') + '" data-dbtg="autosave"><i></i></div></div>' +
      '<div style="margin:6px 0 12px;font-size:14px">' + esc(T('a_last')) + '<span class="gr">' + esc(last) + (ME.cloudt ? ' \u2713' : '') + '</span> \u00b7 ' + esc(T('a_pcs').replace('{n}', ME.devices || 1)) + '</div>' +
      '<a class="btn" style="margin:0 8px 0 0" data-act="cloudsave">' + esc(T('a_savenow')) + '</a><a class="btn" style="margin:0" data-act="cloudget">' + esc(T('a_restore')) + '</a>' +
      '<a class="btn out" style="float:right;margin:0" data-act="logout">' + esc(T('a_logout')) + '</a></div>';
  },
  system: function () {
    var langs = '';
    each(LANGS, function (o) {
      langs += '<a class="' + (CUR_LANG === o[0] ? 'on' : '') + '" data-lang="' + o[0] + '">' + langBox(o) + esc(o[2]) + (CUR_LANG === o[0] ? '<i>\u2713</i>' : '') + '</a>';
    });
    var chk = '';
    if (LAST_CHECK) {
      chk = '<div class="chk ' + (LAST_CHECK.bad.length ? 'bad' : 'ok') + '">' + esc((LAST_CHECK.bad.length ? T('chk_bad') : T('chk_ok')).replace('{n}', LAST_CHECK.bad.length || LAST_CHECK.ok));
      each(LAST_CHECK.bad, function (b) { chk += '<div>' + esc(b) + '</div>'; });
      chk += '</div>';
    }
    var otg = function (k, label, sub) {
      return '<div class="fr w"><div class="lb">' + esc(T(label)) + (sub ? '<small>' + esc(T(sub)) + '</small>' : '') + '</div><div class="tg' + (OPTS[k] ? ' on' : '') + '" data-otg="' + k + '"><i></i></div></div>';
    };
    return '<div class="pane l"><div class="ph2">' + esc(T('sy_lang')) + '</div><div class="lng">' + langs + '</div>' +
      '<div class="ph2 m">' + esc(T('sy_up')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('sy_ver')) + ' <span class="vbold">v' + esc(VERSION || '1.0') + '</span></b><small>' + esc(T('sy_new')) + '</small><span class="ok2">\u2713 ' + esc(T('sy_newb')) + '</span></div>' +
      otg('auto', 'sy_auto', 'sy_auto2') + otg('beta', 'sy_beta') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('sy_start')) + '</div>' +
      otg('start', 'sy_win') + otg('win', 'sy_windowed') +
      '<div class="fr w"><div class="lb">' + esc(T('sy_fx')) + '<small>' + esc(T('sy_fx2')) + '</small></div><div class="tg' + (DB.fx !== 0 && !FX.off ? ' on' : '') + '" data-dbtg="fx"><i></i></div></div>' +
      '<div class="fr w"><div class="lb">' + esc(T('sy_dnd')) + '<small>' + esc(T('sy_dnd2')) + '</small></div><div class="tg' + (DB.dnd ? ' on' : '') + '" data-dbtg="dnd"><i></i></div></div>' +
      '<div class="ph2 m">' + esc(T('lk_title')) + '</div>' +
      '<div class="lkr"><span>' + esc(T('lk_bg')) + '</span>' + (function () { var x = ''; for (var k in BGS) if (BGS.hasOwnProperty(k)) x += '<a class="bgc' + ((DB.bgs || 'def') === k ? ' on' : '') + '" data-bgs="' + k + '" style="background:' + (BGS[k] ? '-webkit-radial-gradient(center, circle cover, ' + BGS[k] + ')' : '-webkit-radial-gradient(center, circle cover, #3a0d14 0%, #1c0b10 30%, #0f0a0e 60%, #09070a 100%)') + '" title="' + esc(T('bg_' + k)) + '"></a>'; return x; })() + '</div>' +
      '<div class="lkr"><span>' + esc(T('lk_ptc')) + '</span>' + (function () { var x = ''; each(['spark', 'snow', 'none'], function (k) { x += '<a class="sgo' + ((DB.ptc || 'spark') === k ? ' on' : '') + '" data-ptc="' + k + '">' + esc(T('pt_' + k)) + '</a>'; }); return x; })() + '</div>' +
      '<div class="lkr"><span>' + esc(T('lk_fs')) + '</span>' + (function () { var x = ''; each([[1, '100%'], [1.1, '110%'], [1.2, '120%']], function (k) { x += '<a class="sgo' + ((DB.fs || 1) === k[0] ? ' on' : '') + '" data-fs="' + k[0] + '">' + k[1] + '</a>'; }); return x; })() + '</div>' +
      '<div class="fr w"><div class="lb">' + esc(T('lk_hol')) + '<small>' + esc(T('lk_hol2')) + '</small></div><div class="tg' + (DB.hol !== 0 ? ' on' : '') + '" data-dbtg="hol"><i></i></div></div>' +
      '<div class="ph2 m">' + esc(T('sy_srv')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('sy_cache')) + '</b><small>' + esc(T('sy_cache2').replace('{n}', CACHE_MB)) + (OPTS.clean ? ' \u00b7 ' + esc(T('sy_pending')) : '') + '</small><a class="btn" data-act="cache">' + esc(T('sy_cacheb')) + '</a></div>' +
      '<div class="rowb"><b>' + esc(T('sy_files')) + '</b><small>' + esc(T('sy_files2')) + (OPTS.verify ? ' \u00b7 ' + esc(T('sy_pending')) : '') + '</small><a class="btn" data-act="verify">' + esc(T('sy_filesb')) + '</a></div>' +
      rowb('sy_chk', 'sy_chk2', 'check', 'sy_chkb') + chk +
      rowb('sy_rep', 'sy_rep2', 'report', 'sy_repb') + '</div>';
  }
};
function drawXhair() {
  var c = $('xCan'); if (!c || !c.getContext) return;
  var g = c.getContext('2d'), w = c.width, h = c.height, cx = Math.round(w / 2), cy = Math.round(h / 2);
  g.clearRect(0, 0, w, h);
  var p = String(E.xc).split(' ');
  g.fillStyle = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (E.xtr ? 0.6 : 1) + ')';
  var z = w > 300 ? 2 : 1, len = ({ extra_small: 4, small: 5, medium: 8, large: 11, auto: 11 }[E.xs] || 5) * z, gap = (E.xgap != null ? Number(E.xgap) : 3) * z, t = (Math.max(1, Number(E.xthick) || 1) + 1) * z, type = Number(E.xt);
  if (Number(E.xout) > 0) {                         // kontur: avval qora, har tomondan kattaroq
    var o = Number(E.xout) * z, col = g.fillStyle;
    g.fillStyle = 'rgba(0,0,0,0.85)';
    xShape(g, cx, cy, z, len, gap, t, type, o);
    g.fillStyle = col;
  }
  xShape(g, cx, cy, z, len, gap, t, type, 0);
}
function xShape(g, cx, cy, z, len, gap, t, type, o) {
  var h = Math.floor(t / 2), R = function (x, y, a, b) { g.fillRect(x - o, y - o, a + 2 * o, b + 2 * o); };
  if (type === 3) { R(cx - 2 * z, cy - 2 * z, 4 * z, 4 * z); return; }
  if (type === 2) { g.strokeStyle = g.fillStyle; g.lineWidth = t + 2 * o; g.beginPath(); g.arc(cx, cy, len + 2 * z, 0, Math.PI * 2); g.stroke(); R(cx - z, cy - z, 2 * z, 2 * z); return; }
  R(cx - gap - len, cy - h, len, t); R(cx + gap, cy - h, len, t); R(cx - h, cy + gap, t, len);
  if (type !== 1) R(cx - h, cy - gap - len, t, len);
}
function drawScope() {
  var c = $('xScope'); if (!c || !c.getContext) return;
  var g = c.getContext('2d'), w = c.width, h = c.height, cx = w / 2, cy = h / 2, r = h / 2 - 6;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip(); g.clearRect(0, 0, w, h); g.restore();
  g.fillStyle = '#000'; g.fillRect(0, cy, w, 1); g.fillRect(cx, 0, 1, h);
}

/* ============================================================ tugmalar (bind) */
var ACTIONS = [
  ['+forward', 'Oldinga', '\u0412\u043f\u0435\u0440\u0451\u0434', 'w'], ['+back', 'Orqaga', '\u041d\u0430\u0437\u0430\u0434', 's'],
  ['+moveleft', 'Chapga', '\u0412\u043b\u0435\u0432\u043e', 'a'], ['+moveright', "O'ngga", '\u0412\u043f\u0440\u0430\u0432\u043e', 'd'],
  ['+jump', 'Sakrash', '\u041f\u0440\u044b\u0436\u043e\u043a', 'SPACE'], ['+duck', "O'tirish", '\u041f\u0440\u0438\u0441\u0435\u0441\u0442\u044c', 'CTRL'],
  ['+speed', 'Sekin yurish', '\u0418\u0434\u0442\u0438 \u0442\u0438\u0445\u043e', 'SHIFT'], ['+attack', 'Otish', '\u0410\u0442\u0430\u043a\u0430', 'MOUSE1'],
  ['+attack2', 'Ikkinchi hujum / pritsel', '\u0414\u043e\u043f. \u0430\u0442\u0430\u043a\u0430', 'MOUSE2'], ['+reload', "Qayta o'qlash", '\u041f\u0435\u0440\u0435\u0437\u0430\u0440\u044f\u0434\u043a\u0430', 'r'],
  ['+use', 'Ishlatish', '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c', 'e'], ['drop', 'Qurolni tashlash', '\u0412\u044b\u0431\u0440\u043e\u0441\u0438\u0442\u044c', 'g'],
  ['lastinv', 'Oxirgi qurol', '\u041f\u0440\u0435\u0434. \u043e\u0440\u0443\u0436\u0438\u0435', 'q'], ['slot1', 'Asosiy qurol', '\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435', '1'],
  ['slot2', 'Pistolet', '\u041f\u0438\u0441\u0442\u043e\u043b\u0435\u0442', '2'], ['slot3', 'Pichoq', '\u041d\u043e\u0436', '3'],
  ['slot4', 'Granatalar', '\u0413\u0440\u0430\u043d\u0430\u0442\u044b', '4'], ['slot5', 'C4 bomba', 'C4', '5'],
  ['buy', 'Sotib olish menyusi', '\u041c\u0435\u043d\u044e \u0437\u0430\u043a\u0443\u043f\u043a\u0438', 'b'], ['buyammo1', "Asosiy qurol o'qi", '\u041f\u0430\u0442\u0440\u043e\u043d\u044b (\u043e\u0441\u043d.)', ','],
  ['buyammo2', "Pistolet o'qi", '\u041f\u0430\u0442\u0440\u043e\u043d\u044b (\u043f\u0438\u0441\u0442.)', '.'], ['chooseteam', 'Jamoa tanlash', '\u0412\u044b\u0431\u043e\u0440 \u043a\u043e\u043c\u0430\u043d\u0434\u044b', 'm'],
  ['+showscores', 'Hisob jadvali', '\u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u0441\u0447\u0451\u0442\u0430', 'TAB'], ['messagemode', 'Umumiy chat', '\u0427\u0430\u0442', 'y'],
  ['messagemode2', 'Jamoa chati', '\u0427\u0430\u0442 \u043a\u043e\u043c\u0430\u043d\u0434\u044b', 'u'], ['+voicerecord', 'Ovozli chat', '\u0413\u043e\u043b\u043e\u0441', 'k'],
  ['impulse 201', 'Spray', '\u0421\u043f\u0440\u0435\u0439', 't'], ['nightvision', "Tungi ko'rish", '\u041d\u043e\u0447\u043d\u043e\u0435 \u0432\u0438\u0434\u0435\u043d\u0438\u0435', 'n'],
  ['radio1', 'Radio buyruqlar', '\u0420\u0430\u0434\u0438\u043e', 'z'], ['snapshot', 'Skrinshot', '\u0421\u043a\u0440\u0438\u043d\u0448\u043e\u0442', 'F5'],
  // tayyor bindlar (tugmasi bo'sh - o'yinchi o'zi tanlaydi)
  ['+jumpthrow', 'Granatani sakrab otish (jumpthrow)', '\u041f\u0440\u044b\u0436\u043e\u043a + \u0431\u0440\u043e\u0441\u043e\u043a', ''],
  ['xc_qs', 'Tez almashtirish (AWP uchun)', '\u0411\u044b\u0441\u0442\u0440\u0430\u044f \u0441\u043c\u0435\u043d\u0430 (AWP)', ''],
  ['radio2', 'Radio 2', '\u0420\u0430\u0434\u0438\u043e 2', ''], ['radio3', 'Radio 3', '\u0420\u0430\u0434\u0438\u043e 3', ''],
  ['say gl hf', 'Chat: gl hf', '\u0427\u0430\u0442: gl hf', ''], ['say gg wp', 'Chat: gg wp', '\u0427\u0430\u0442: gg wp', ''],
  ['say_team Need backup!', 'Jamoaga: yordam kerak', '\u041a\u043e\u043c\u0430\u043d\u0434\u0435: \u043d\u0443\u0436\u043d\u0430 \u043f\u043e\u043c\u043e\u0449\u044c', ''],
  ['+xc_jd', 'Sakrab o\'tirish (jump + duck)', '\u041f\u0440\u044b\u0436\u043e\u043a \u0441 \u043f\u0440\u0438\u0441\u0435\u0434\u043e\u043c', ''],
  ['xc_he', 'HE granata', '\u0413\u0440\u0430\u043d\u0430\u0442\u0430 HE', ''],
  ['xc_fl', 'Flash granata', '\u0424\u043b\u0435\u0448\u043a\u0430', ''],
  ['xc_sm', 'Tutun granata', '\u0414\u044b\u043c\u043e\u0432\u0430\u044f \u0433\u0440\u0430\u043d\u0430\u0442\u0430', ''],
  ['xc_c4', 'C4 bombani tashlash', '\u0412\u044b\u0431\u0440\u043e\u0441\u0438\u0442\u044c C4', ''],
  ['xc_volup', 'Ovoz +', '\u0413\u0440\u043e\u043c\u043a\u043e\u0441\u0442\u044c +', ''],
  ['xc_voldn', 'Ovoz -', '\u0413\u0440\u043e\u043c\u043a\u043e\u0441\u0442\u044c -', ''],
  ['xc_vt', 'Ovozli chat (yoqish/o\'chirish)', '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0447\u0430\u0442 (\u0432\u043a\u043b/\u0432\u044b\u043a\u043b)', ''],
  ['xc_ng', 'net_graph + FPS (yoqish/o\'chirish)', 'net_graph + FPS (\u0432\u043a\u043b/\u0432\u044b\u043a\u043b)', ''],
  ['xc_awp', 'AWP rejimi: sezgirlik + pritsel almashtirish', '\u0420\u0435\u0436\u0438\u043c AWP: \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c + \u043f\u0440\u0438\u0446\u0435\u043b', ''],
  ['xc_dm', 'Demo yozish (boshlash/to\'xtatish)', '\u0417\u0430\u043f\u0438\u0441\u044c \u0434\u0435\u043c\u043e (\u0441\u0442\u0430\u0440\u0442/\u0441\u0442\u043e\u043f)', ''],
  ['xc_b_rifle', 'Xarid: avtomat + o\'q', '\u0417\u0430\u043a\u0443\u043f\u043a\u0430: \u0430\u0432\u0442\u043e\u043c\u0430\u0442 + \u043f\u0430\u0442\u0440\u043e\u043d\u044b', ''],
  ['xc_b_awp', 'Xarid: AWP + o\'q', '\u0417\u0430\u043a\u0443\u043f\u043a\u0430: AWP + \u043f\u0430\u0442\u0440\u043e\u043d\u044b', ''],
  ['xc_b_pist', 'Xarid: Deagle + o\'q', '\u0417\u0430\u043a\u0443\u043f\u043a\u0430: Deagle + \u043f\u0430\u0442\u0440\u043e\u043d\u044b', ''],
  ['xc_b_full', 'Xarid: to\'liq (avtomat, zirh, granatalar)', '\u0417\u0430\u043a\u0443\u043f\u043a\u0430: \u043f\u043e\u043b\u043d\u0430\u044f (\u0430\u0432\u0442\u043e\u043c\u0430\u0442, \u0431\u0440\u043e\u043d\u044f, \u0433\u0440\u0430\u043d\u0430\u0442\u044b)', ''],
  ['coverme', 'Radio: Meni qopla', '\u0420\u0430\u0434\u0438\u043e: \u041f\u0440\u0438\u043a\u0440\u043e\u0439 \u043c\u0435\u043d\u044f', ''],
  ['go', 'Radio: Hujum!', '\u0420\u0430\u0434\u0438\u043e: \u0412\u043f\u0435\u0440\u0451\u0434!', ''],
  ['fallback', 'Radio: Orqaga!', '\u0420\u0430\u0434\u0438\u043e: \u041e\u0442\u0441\u0442\u0443\u043f\u0430\u0435\u043c!', ''],
  ['enemyspot', 'Radio: Dushman ko\'rindi', '\u0420\u0430\u0434\u0438\u043e: \u0412\u0440\u0430\u0433 \u0437\u0430\u043c\u0435\u0447\u0435\u043d', ''],
  ['needbackup', 'Radio: Yordam kerak', '\u0420\u0430\u0434\u0438\u043e: \u041d\u0443\u0436\u043d\u0430 \u043f\u043e\u043c\u043e\u0449\u044c', ''],
  ['sectorclear', 'Radio: Toza', '\u0420\u0430\u0434\u0438\u043e: \u0427\u0438\u0441\u0442\u043e', ''],
  ['roger', 'Radio: Tushunarli', '\u0420\u0430\u0434\u0438\u043e: \u041f\u043e\u043d\u044f\u043b', ''],
  ['say_team Bomb planted!', 'Jamoaga: bomba qo\'yildi', '\u041a\u043e\u043c\u0430\u043d\u0434\u0435: \u0431\u043e\u043c\u0431\u0430 \u0437\u0430\u043b\u043e\u0436\u0435\u043d\u0430', '']
];
var BINDS = {}, BINDS2 = {}, KEYWAIT = '', KEYSLOT = 1;   // BINDS2 - ikkinchi (qo'shimcha) tugma
function loadBinds() {
  BINDS = {};
  each(ACTIONS, function (a) { BINDS[a[0]] = a[3]; });
  if (DB.binds) for (var k in DB.binds) if (DB.binds.hasOwnProperty(k)) BINDS[k] = DB.binds[k];
  BINDS2 = DB.binds2 ? copy(DB.binds2) : {};
}
function binAliases() {                        // tayyor bindlar uchun aliaslar
  cmd('alias +jumpthrow "+jump; -attack"'); cmd('alias -jumpthrow "-jump"');
  cmd('alias xc_qs "slot3; wait; lastinv"');
  cmd('alias +xc_jd "+jump; +duck"'); cmd('alias -xc_jd "-jump; -duck"');
  cmd('alias xc_he "use weapon_hegrenade"'); cmd('alias xc_fl "use weapon_flashbang"'); cmd('alias xc_sm "use weapon_smokegrenade"');
  cmd('alias xc_c4 "use weapon_c4; drop"');
  cmd('alias xc_b_rifle "m4a1; ak47; primammo"'); cmd('alias xc_b_awp "awp; primammo"'); cmd('alias xc_b_pist "deagle; secammo"');
  cmd('alias xc_b_full "m4a1; ak47; primammo; vesthelm; defuser; hegren; flash; flash; sgren"');
  // yoqish/o'chirish (toggle) aliaslari
  cmd('alias xc_vt1 "+voicerecord; alias xc_vt xc_vt0"'); cmd('alias xc_vt0 "-voicerecord; alias xc_vt xc_vt1"'); cmd('alias xc_vt xc_vt1');
  cmd('alias xc_ng1 "net_graph 3; cl_showfps 1; alias xc_ng xc_ng0"'); cmd('alias xc_ng0 "net_graph 0; cl_showfps 0; alias xc_ng xc_ng1"'); cmd('alias xc_ng xc_ng1');
  cmd('alias xc_dm1 "record xc_quick; alias xc_dm xc_dm0"'); cmd('alias xc_dm0 "stop; alias xc_dm xc_dm1"'); cmd('alias xc_dm xc_dm1');
  // ovoz: 0.0 ... 1.0, 0.1 qadam
  for (var i = 0; i <= 10; i++) cmd('alias xc_v' + i + ' "volume ' + (i / 10) + '; alias xc_volup xc_v' + Math.min(10, i + 1) + '; alias xc_voldn xc_v' + Math.max(0, i - 1) + '"');
  var cv = Math.round(((S && S.vol) || 0.8) * 10); cmd('alias xc_volup xc_v' + Math.min(10, cv + 1)); cmd('alias xc_voldn xc_v' + Math.max(0, cv - 1));
  // AWP rejimi: asosiy (sezgirlik, skop, pritsel) <-> AWP (alohida sezgirlik, skop, pritsel)
  if (S) {
    // alias ichida qo'shtirnoq bo'lmaydi - pritsel rangi (3 so'z) almashtirilmaydi, faqat sezgirlik, skop va pritsel o'lchami
    var A = 'sensitivity ' + S.sens + '; zoom_sensitivity_ratio ' + S.zoom + '; cl_crosshair_size ' + S.xs;
    var W = 'sensitivity ' + (S.awps || S.sens) + '; zoom_sensitivity_ratio ' + S.awpz + '; cl_crosshair_size ' + S.awpxs;
    cmd('alias xc_awp1 "' + W + '; alias xc_awp xc_awp0"'); cmd('alias xc_awp0 "' + A + '; alias xc_awp xc_awp1"'); cmd('alias xc_awp xc_awp1');
  }
}
function applyBinds() {
  binAliases();
  for (var a in BINDS) if (BINDS.hasOwnProperty(a) && BINDS[a]) cmd('bind ' + q(BINDS[a]) + ' ' + q(a));
  for (var b in BINDS2) if (BINDS2.hasOwnProperty(b) && BINDS2[b]) cmd('bind ' + q(BINDS2[b]) + ' ' + q(b));
}
var KEYNAMES = { 8: 'BACKSPACE', 9: 'TAB', 13: 'ENTER', 16: 'SHIFT', 17: 'CTRL', 18: 'ALT', 19: 'PAUSE', 20: 'CAPSLOCK', 32: 'SPACE',
  33: 'PGUP', 34: 'PGDN', 35: 'END', 36: 'HOME', 37: 'LEFTARROW', 38: 'UPARROW', 39: 'RIGHTARROW', 40: 'DOWNARROW', 45: 'INS', 46: 'DEL',
  96: 'KP_INS', 97: 'KP_END', 98: 'KP_DOWNARROW', 99: 'KP_PGDN', 100: 'KP_LEFTARROW', 101: 'KP_5', 102: 'KP_RIGHTARROW', 103: 'KP_HOME',
  104: 'KP_UPARROW', 105: 'KP_PGUP', 106: '*', 107: 'KP_PLUS', 109: 'KP_MINUS', 110: 'KP_DEL', 111: 'KP_SLASH',
  186: 'SEMICOLON', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'" };
function keyName(e) {
  var c = e.keyCode;
  if (KEYNAMES[c]) return KEYNAMES[c];
  if (c >= 112 && c <= 123) return 'F' + (c - 111);
  if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90)) return String.fromCharCode(c).toLowerCase();
  return '';
}
function keyLabel(k) { return /^[a-z]$/.test(k) ? k.toUpperCase() : k; }
function setBind(action, key, slot) {
  var M = slot === 2 ? BINDS2 : BINDS, old = M[action];
  // bitta tugma faqat bitta vazifada: boshqa joyda (1- yoki 2-ustunda) bo'lsa - o'sha yerdan olib tashlanadi
  for (var a in BINDS) if (BINDS.hasOwnProperty(a) && BINDS[a] === key && !(M === BINDS && a === action)) BINDS[a] = '';
  for (var b in BINDS2) if (BINDS2.hasOwnProperty(b) && BINDS2[b] === key && !(M === BINDS2 && b === action)) BINDS2[b] = '';
  M[action] = key;
  binAliases();
  if (old && old !== key) cmd('unbind ' + q(old));
  if (key) cmd('bind ' + q(key) + ' ' + q(action));
  DB.binds = BINDS; DB.binds2 = BINDS2; persist(); cloudSave();
}
function finishWait(key) {
  var a = KEYWAIT; KEYWAIT = '';
  if (key === 'BACKSPACE' && KEYSLOT === 2) { setBind(a, '', 2); }   // 2-tugmani tozalash
  else if (key) { setBind(a, key, KEYSLOT); toast(keyLabel(key) + ' \u2192 ' + a); }
  showSetTab('keys');
}

/* ============================================================ oynalar */
var curModal = '';
function openModal(id) {
  SFX_QUIET = true; closeModal(); SFX_QUIET = false;
  curModal = id; $(id).className = 'modal on';
  sfx('open');
}
function closeModal() {
  if (DD) ddClose();
  if (!curModal) return;
  if (curModal === 'mdSettings' && XLIVE && S) { XLIVE = false; each(xhairCmds(S), function (x) { cmd(x); }); }   // saqlanmagan pritselni qaytarish
  KEYWAIT = '';
  $(curModal).className = 'modal'; curModal = '';
  if (!SFX_QUIET) sfx('close');
}
var askCb = null;
function ask(title, cb, two, pw, noin, pw2) {
  askCb = cb; $('askT').innerHTML = esc(title); $('askI').value = ''; $('askI2').value = '';
  $('askI').style.display = noin ? 'none' : '';
  $('askI').type = pw ? 'password' : 'text';
  $('askI2').style.display = two ? '' : 'none';
  $('askI2').type = pw2 ? 'password' : 'text';      // ikkinchi maydon faqat parol bo'lganda yashirin (klan tegi, setinfo nomi ko'rinib yozilsin)
  $('mdAsk').className = 'modal on';
  setTimeout(function () { try { $('askI').focus(); } catch (e) {} }, 50);
}
function askDone(ok) {
  $('mdAsk').className = 'modal';
  var cb = askCb; askCb = null;
  if (ok && cb) cb($('askI').value, $('askI2').value);
}

/* ============================================================ profil rasmi */
var AVC = ['#ff3b3b', '#ff8a2a', '#f5c518', '#3ccf4e', '#1fb5d6', '#3b6cff', '#9b4dff', '#ff4fb4', '#6b6470'];
function avColors() {
  var h = '';
  each(AVC, function (c) { h += '<a class="' + (ME && ME.avc === c ? 'on' : '') + '" data-avc="' + c + '" style="background:' + c + '"></a>'; });
  return h;
}
function avUpload(file) {
  if (!file) return;
  if (!/^image\//.test(file.type || '')) return toast(T('a_photo_bad'));
  if (!window.FileReader) return toast(T('a_photo_na'));
  var rd = new FileReader();
  rd.onload = function () {
    var im = new Image();
    im.onload = function () {
      // markazdan kvadrat qirqib 128x128 JPEG qilamiz (~10 KB)
      var c = document.createElement('canvas'); c.width = 128; c.height = 128;
      var g = c.getContext('2d'), s = Math.min(im.width, im.height);
      g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
      g.drawImage(im, Math.round((im.width - s) / 2), Math.round((im.height - s) / 2), s, s, 0, 0, 128, 128);
      var data = '';
      try { data = c.toDataURL('image/jpeg', 0.85); } catch (e) {}
      if (data.indexOf('data:image/jpeg') !== 0) { try { data = c.toDataURL('image/png'); } catch (e2) {} }
      if (!data) return toast(T('a_photo_bad'));
      toast(T('lg_wait'));
      api('avatar', { img: data }, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); setMe(r.me); toast(T('saved')); if (curModal === 'mdSettings') showSetTab('account'); });
    };
    im.onerror = function () { toast(T('a_photo_bad')); };
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}

/* ============================================================ amallar */
function act(a) {
  if (LITE && /^(friends|profile|missions|login|weekall|promo|stats|clan|ref)$/.test(a)) return openPromo();
  if (a === 'quick' || a === 'play') { closeModal(); return quick(); }
  if (a === 'servers') return openServers('internet');
  if (a === 'friends') return openFriends();
  if (a === 'missions') return openMissions();
  if (a === 'nettest') return netTest();
  if (a === 'netapply') { if (!NETT) return; E.net = NETT.rec.net; E.interp = NETT.rec.interp; showSetTab('pro'); return toast(T('nt_applied'), 4000); }
  if (a === 'weekall') return openServers('history');
  if (a === 'profile') return ME ? openSettings('account') : openLogin();
  if (a === 'login') return openLogin();
  if (a === 'acctx') { DB.acx = 1; persist(); statePush(); renderAll(); return toast(T('ac_x'), 5000); }   // akkaunt kartasi bir marta yopiladi
  if (a === 'promox') { DB.pxx = now(); persist(); statePush(); renderAll(); return; }
  if (a === 'feedback') return openFeedback();
  if (a === 'fbsend') return sendFeedback();
  if (a === 'settings') return openSettings();
  if (a === 'quit') return cmd('quit');
  if (a === 'resume') { closeModal(); return cmd('cancelselect'); }   // NextClient'ning o'z "ResumeGame" tugmasi ham shu buyruqni yuboradi
  if (a === 'dconn') { closeModal(); return cmd('disconnect'); }
  if (a === 'plist') { if (!CONNECTED) return; openServers('history'); srvSel = CONNECTED; loadPlayers(CONNECTED); query(CONNECTED, true); return renderServers(); }
  if (a === 'close') return closeModal();
  if (a === 'guest') { DB.guest = 1; persist(); return closeModal(); }
  if (a === 'dologin') return doLogin();
  if (a === 'lgswitch') { lgReg = !lgReg; return renderLoginForm(); }
  if (a === 'forgot') return forgot();
  if (a === 'refresh') { each(tabIps(), function (ip) { query(ip, true); }); if (srvSel) loadPlayers(srvSel); if (srvTab === 'friends') loadFriends(); return; }
  if (a === 'join') { if (srvSel) { closeModal(); connect(srvSel); } return; }
  if (a === 'togglefav') return toggleFav(srvSel);
  if (a === 'clearhist') { DB.hist = []; CUR = null; persist(); return renderAll(); }
  if (a === 'clearall') { DB.hist = []; DB.fav = []; CUR = null; persist(); cloudSave(); toast(T('sy_ok')); return renderAll(); }
  if (a === 'addip') return ask(T('ask_ip'), function (v) { var ip = normIp(v); if (!ip) return toast(T('bad_ip')); if (!isFavIp(ip)) toggleFav(ip); srvSel = ip; renderServers(); });
  if (a === 'console') { closeModal(); return cmd('toggleconsole'); }
  if (a === 'fradd') {
    var v = ($('frIn').value || '').replace(/\s+/g, '');
    if (!v) return;
    if (FR_SUG && FR_SUG.length === 1 && !FR_SUG[0].st) v = FR_SUG[0].login;   // bitta variant bo'lsa - o'sha
    return frAdd(v);
  }
  if (a === 'avdel' && curModal !== 'mdSettings') return api('avatar', { img: 'none' }, function (r) { if (r.ok) { setMe(r.me); toast(T('saved')); openAvatars(); } });
  if (a === 'frback') { CHAT = null; return openFriends(); }
  if (a === 'chatsend') return chatSend();
  if (a === 'cfgtop') return openCfgTop();
  if (a === 'chests') return openChests();
  if (a === 'chestopen') return chestOpen();
  if (a === 'tglink') return api('tg_code', {}, function (r) {
    if (!r.ok) return toast(r.msg || 'Xato', 5000);
    openSide('tg', 'Telegram', '<div class="tgl2"><p>' + esc(T('tg_how1').replace('{b}', r.bot ? '@' + r.bot : 'bot')) + '</p><div class="tgcode">' + esc(r.code) + '</div><p class="mut">' + esc(T('tg_how2')) + '</p>' +
      (r.bot ? '<div class="avurl"><input class="ipin" readonly value="t.me/' + esc(r.bot) + '"><a class="cpy" data-copyip="t.me/' + esc(r.bot) + '">' + esc(T('ip_copy')) + '</a></div>' : '') +
      '<p class="mut">/me \u00b7 /friends \u00b7 /top \u00b7 /online</p>' + (r.linked ? '<a class="btn" data-act="tgunlink">' + esc(T('tg_unlink')) + '</a>' : '') + '</div>');
  });
  if (a === 'tgunlink') return api('tg_unlink', {}, function () { if (ME) ME.tglinked = 0; closeModal(); toast(T('tg_unl_ok')); });
  if (a === 'cfgshare') return ask(T('cf_name'), function (title) {
    var cs = copy(E); delete cs.name; delete cs.tag;
    title = clean(title).slice(0, 40);
    api('cfg_share', { cfg: JSON.stringify({ s: cs, b: BINDS, b2: BINDS2 }), title: title, pub: title ? '1' : '0' }, function (r) {
      if (!r.ok) return toast(r.msg || 'Xato');
      var o = $('cfgOut'); if (o) o.innerHTML = '<div class="avurl" style="margin-top:10px"><input class="ipin" readonly value="' + esc(r.code) + '"><a class="cpy" data-copyip="' + esc(r.code) + '">' + esc(T('ip_copy')) + '</a></div>';
      toast(T('cf_ok').replace('{c}', r.code), 6000);
    });
  });
  if (a === 'cfgload') return ask(T('cf_ask'), function (c) { cfgUse(c); });
  if (a === 'cfgload_old') return ask(T('cf_ask'), function (c) {
    api('cfg_get', { code: c }, function (r) {
      if (!r.ok || !r.cfg) return toast(r.msg || T('cf_bad'));
      var c2 = r.cfg; for (var k in c2.s || {}) if (c2.s.hasOwnProperty(k) && DEF.hasOwnProperty(k) && k !== 'name' && k !== 'tag') E[k] = c2.s[k];
      if (c2.b) { DB.binds = c2.b; DB.binds2 = c2.b2 || {}; loadBinds(); applyBinds(); persist(); }
      E.xp = presetOf(E); toast(T('cf_loaded'), 5000); showSetTab('tools');
    });
  });
  if (a === 'keysfactory') return ask(T('k_factory_ask'), function () {
    // CS 1.6 zavod tugmalari: hammasi o'chiriladi (unbindall), so'ng asl tugmalar qo'yiladi; X CLIENT qo'shimchalari bo'sh qoladi
    var F = {"`": "toggleconsole", "ESCAPE": "cancelselect", "w": "+forward", "s": "+back", "a": "+moveleft", "d": "+moveright", "SPACE": "+jump", "CTRL": "+duck", "SHIFT": "+speed", "MOUSE1": "+attack", "MOUSE2": "+attack2", "r": "+reload", "e": "+use", "g": "drop", "q": "lastinv", "1": "slot1", "2": "slot2", "3": "slot3", "4": "slot4", "5": "slot5", "6": "slot6", "7": "slot7", "8": "slot8", "9": "slot9", "0": "slot10", "b": "buy", "o": "buyequip", "m": "chooseteam", ",": "buyammo1", ".": "buyammo2", "TAB": "+showscores", "y": "messagemode", "u": "messagemode2", "k": "+voicerecord", "t": "impulse 201", "n": "nightvision", "f": "impulse 100", "z": "radio1", "x": "radio2", "c": "radio3", "F1": "autobuy", "F2": "rebuy", "F5": "snapshot", "MWHEELUP": "invprev", "MWHEELDOWN": "invnext", "PAUSE": "pause"};
    cmd('unbindall'); for (var fk in F) if (F.hasOwnProperty(fk)) cmd('bind ' + q(fk) + ' ' + q(F[fk]));
    DB.binds = {}; each(ACTIONS, function (x) { DB.binds[x[0]] = ''; }); for (var fk2 in F) if (F.hasOwnProperty(fk2) && DB.binds.hasOwnProperty(F[fk2])) DB.binds[F[fk2]] = fk2;
    DB.binds2 = {}; loadBinds(); persist(); cloudSave(); toast(T('k_factory_ok'), 5000); showSetTab('keys');
  }, false, false, true);
  if (a === 'keysdef') { each(ACTIONS, function (x) { if (BINDS2[x[0]]) cmd('unbind ' + q(BINDS2[x[0]])); }); DB.binds = null; DB.binds2 = null; loadBinds(); applyBinds(); persist(); cloudSave(); toast(T('sy_ok')); return showSetTab('keys'); }
  if (a === 'cache') { OPTS.clean = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'verify') { OPTS.verify = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'check') { if (!canRead()) return toast(T('chk_na')); return verifySettings(S); }
  if (a === 'report') return api('report', { log: diagText() + '\n\n===== KONSOL =====\n' + CONLOG.join('\n'), who: ME ? ME.login : 'guest', ver: VERSION }, function (r) { toast(r.ok ? T('sy_repok') : (r.msg || 'Xato'), 5000); });
  if (a === 'xcopy') {
    var inp = $('xCode'); inp.value = xcode(E); inp.focus(); inp.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    return toast(ok ? T('x_copied') : T('x_copy2'));
  }
  if (a === 'xtest') {                         // 3 soniya qizil katta pritsel: menyu buyrug'i o'yinga yetib boradimi
    cmd('cl_crosshair_color "255 0 0"'); cmd('cl_crosshair_size large');
    setTimeout(function () {
      var v = readCvar('cl_crosshair_color');
      toast(T('hx_test2').replace('{v}', v == null ? '?' : v), 5000);
      each(xhairCmds(E || S), function (x) { cmd(x); });
    }, 3000);
    return toast(T('hx_test1'), 3000);
  }
  if (a === 'calcapply') { var cv = calcVal(); if (!cv) return toast(T('cc_bad')); E.sens = Math.max(0.1, Math.min(20, cv)); return toast(T('cc_ok').replace('{v}', E.sens), 4000); }
  if (a === 'hwauto') return hwAuto();
  if (a === 'spfile') { var sf = $('sprayFile'); if (!sf) return; sf.value = ''; try { sf.click(); } catch (e) { toast(T('a_photo_na')); } return; }
  if (a === 'spav') return ME && ME.av ? sprayFrom(ME.av) : null;
  if (a === 'splogo') {                         // standart tiniq X CLIENT spray (saytda tayyorlangan)
    if (!PCID) return toast(T('sy_nolaunch'), 5000);
    return api('spray_reset', { d: PCID }, function (r) {
      if (!r.ok) return toast(r.msg || 'Xato', 5000);
      DB.sprayPrev = 'spray_logo.png'; DB.sprayT = now(); persist(); toast(T('sp_ok'), 6000);
      if (curModal === 'mdSettings' && setTab === 'cont') showSetTab('cont');
    });
  }
  if (a === 'gallery') return api('shots', { d: PCID }, function (r) {
    var h = '';
    if (!r.ok) h = '<div class="empty">' + esc(r.msg || T('sy_nolaunch')) + '</div>';
    else if (!r.list.length) h = '<div class="empty">' + esc(T('sh_none')) + '</div>';
    else each(r.list, function (x) {
      var u = 'xc_api.php?a=shot&d=' + encodeURIComponent(r.d) + '&k=' + encodeURIComponent(DB.pck || '') + '&f=' + encodeURIComponent(x.f);
      h += '<div class="shot"><img src="' + u + '" alt=""><small>' + esc(fmtTime(x.t * 1000)) + '</small><a class="x2" data-shdel="' + esc(x.f) + '">✕</a></div>';
    });
    openSide('shots', T('sh_title2'), '<div class="shots">' + h + '</div>');
  });
  if (a === 'procfg') {                        // Pro CFG: lag'siz internet, aniq sichqoncha, toza ovoz
    /* Grafika va FPS ga tegmaymiz: FPS ni 100 ga qotirish (144 Hz monitorda) va soya/yorug'likni o'chirish o'yinchilarga
     * "qotish" va xunuk grafika bo'lib tuyuldi. FPS faqat 100 dan past bo'lsa - 100 */
    E.net = 'fast'; E.vsync = 0; if (!(E.fps >= 100)) E.fps = 100;
    E.raw = 1; E.filter = 0; E.fastsw = 1; E.bob = 0; E.interp = 0.01; E.lw = 1; E.lc = 1;
    E.hisnd = 1; E.mixa = 0.1; E.pro = 1; E.xmig = 1; E.pmig = 1;   // pritsel kengayishiga (xdyn) tegmaymiz
    toast(T('pr_cfgok'), 5000); a = 'save';     // darhol saqlab qo'llaymiz - "Saqlash" ni bosish esdan chiqib, CFG ishlamay qolardi
  }
  if (a === 'fpsmode') {                       // kuchsiz kompyuter: grafikani pasaytiramiz
    E.detail = 0; E.shadows = 0; E.dyn = 0; E.vsync = 0; if (E.fps < 200) E.fps = 200;
    showSetTab('pro'); return toast(T('pr_fpsok'), 5000);
  }
  if (a === 'vmdef') { each(['vmx', 'vmy', 'vmz', 'vmshift', 'lagst', 'lagsc', 'lagsp', 'camint', 'vmfov', 'bob'], function (k) { E[k] = DEF[k]; }); return showSetTab('hud'); }
  if (a === 'gsshare') {                         // xulosa kartasi: saytdagi o'yin yozuvidan chiziladi, Telegram kanalga ham tushadi
    var gl = GS_LAST, gb = document.querySelector('[data-act="gsshare"]'); if (!gl || !ME) return;
    if (gb) gb.style.visibility = 'hidden';
    return api('gsshare', { sid: gl.t, ip: gl.ip, map: gl.map || '', h: gl.h || 0, bs: gl.bs || 0, as: gl.a || 0 }, function (r) {
      if (gb) gb.style.visibility = '';
      if (!r.ok) return toast(r.msg || T('lg_neterr'), 5000);
      copyIp(r.url, null); toast(T('gs_shared'), 6000);
    });
  }
  if (a === 'gsoff') { DB.gsum = 0; persist(); closeModal(); return toast(T('gs_offok'), 5000); }
  if (a === 'gsvids') { closeModal(); return openSettings('demo'); }
  if (a === 'rcs2') {                          // CS2 radari kabi: katta, aylanadigan, uzoqroq xarita, Tab da butun xarita
    var r2 = { rmode: 1, rscale: 135, rmap: 0.6, ropac: 90, rbg: 0, rround: 0, rrot: 1, rfull: 1, rtracks: 0, rallies: 1, rnames: 0, rhp: 0 };
    for (var rk in r2) if (r2.hasOwnProperty(rk)) E[rk] = r2[rk];
    toast(T('h_cs2ok'), 5000); a = 'save';
  }
  if (a === 'camdef') { each(['bobst', 'bobv', 'bobl', 'boblow', 'bobcam', 'roll', 'rollspd', 'fovlerp', 'camsc'], function (k) { E[k] = DEF[k]; }); return showSetTab('hud'); }
  if (a === 'xdef') { each(['xp', 'xt', 'xs', 'xc', 'xtr', 'xdyn', 'xthick', 'xgap', 'xout'], function (k) { E[k] = DEF[k]; }); return showSetTab('hud'); }
  if (a === 'xpick') return ask(T('hx_colask'), function (v) {
    v = String(v || '').replace(/^\s+|\s+$/g, '');
    var m = /^#?([0-9a-f]{6})$/i.exec(v), r = /^(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})$/.exec(v);
    if (m) E.xc = parseInt(m[1].slice(0, 2), 16) + ' ' + parseInt(m[1].slice(2, 4), 16) + ' ' + parseInt(m[1].slice(4, 6), 16);
    else if (r && r[1] < 256 && r[2] < 256 && r[3] < 256) E.xc = Number(r[1]) + ' ' + Number(r[2]) + ' ' + Number(r[3]);
    else return toast(T('x_badcode'));
    showSetTab('hud');
  });
  if (a === 'xcode') { if (applyCode($('xCode').value)) showSetTab('hud'); return; }
  if (a === 'rename') return ask(T('a_newname'), function (v) { api('profile', { name: v }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); });
  if (a === 'email') return ask(T('a_newmail'), function (v) { api('profile', { email: v }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); });
  if (a === 'passwd') return ask(T('a_oldnew'), function (o, n) { api('profile', { oldpass: o, newpass: n }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); toast(T('saved')); showSetTab('account'); }); }, true, true, false, true);
  if (a === 'avpick') return openAvatars();   // o'yin to'liq ekranda bo'lganda Windows fayl oynasi o'yin ortida ochilib, o'yin "qotib" qolardi
  if (a === 'avdel') return api('avatar', { img: 'none' }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); });
  if (a === 'cloudsave') return cloudSave(true);
  if (a === 'stats') return ME ? openStats() : openLogin();
  if (a === 'langmenu') return langMenu();
  if (a === 'qstop') { stopQueue(); return toast(T('q_stopped')); }
  if (a === 'ref') return openRef();
  if (a === 'refset') return ask(T('rf_ask'), function (c) { api('ref_set', { code: c }, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); ME = r.me; toast(T('rf_ok'), 5000); openRef(); renderBar(); }); });
  if (a === 'srvpw') {
    if (!srvSel) return;
    var ip0 = srvSel, cur = srvPw(ip0);
    return ask(T('pw_ask').replace('{s}', srv(ip0).name || ip0), function (pw, fld) {
      fld = String(fld || '').replace(/[^\w]/g, '') || '_pw';
      DB.pw = (DB.pw || []).filter(function (x) { return x.ip !== ip0; });
      if (pw) DB.pw.push({ ip: ip0, f: fld, pw: String(pw).replace(/["\\;]/g, '').slice(0, 40) });
      persist(); cloudSave(); renderInfo(); toast(pw ? T('pw_saved') : T('pw_del'));
      if (CONNECTED === ip0) applyPw(ip0);
    }, true, true);
  }
  if (a === 'clan') return openClan();
  if (a === 'clancreate') return ask(T('cl_ask'), function (n, t) { clanCall('clan_create', { name: n, tag: t }); }, true);
  if (a === 'clanjoin') return ask(T('cl_askcode'), function (c) { clanCall('clan_join', { code: c }); });
  if (a === 'clanleave') return ask(T('cl_askleave'), function () { clanCall('clan_leave'); }, false, false, true);
  if (a === 'cloudget') return api('me', {}, function (r) { if (!r.ok) return; ME = r.me; restoreCloud(r.me.cloud); if (curModal === 'mdSettings') { seedFromGame(); E = copy(S); showSetTab('account'); } });
  if (a === 'logout') { api('logout', {}); DB.token = ''; ME = null; FRIENDS = []; persist(); closeModal(); return renderAll(); }
  if (a === 'defaults') { var keep = E.name, tag = E.tag; E = copy(DEF); E.name = keep; E.tag = tag; return showSetTab(setTab); }
  if (a === 'save') {
    var nm = $('fName'); if (nm) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
    S = copy(E); DB.set = S; persist(); applySettings(S); closeModal(); renderBar(); cloudSave(); setTimeout(musicSync, 300);
    setTimeout(function () { verifySettings(S); }, 700);
  }
}

/* ============================================================ hodisalar */
/* ---- menyu musiqasi: CS ning o'z menyu kuyi (media/gamestartup.mp3), faqat serverda bo'lmaganda ---- */
var MUSIC_ON = null;                             // null - noma'lum: oldingi sahifa (menyu yangilangan) qoldirgan musiqa ham o'chirilsin
function musicSync() {
  var want = !!(S && S.mmusic && !CONNECTED && !DEMO_PLAY && hasApi());   // demo ko'rilayotganda menyu musiqasi chalinmasin
  if (want && !MUSIC_ON) { cmd('mp3volume ' + (S.mp3off ? 0 : S.mus)); cmd('mp3 loop ' + (/^[\w\/.\-]+\.mp3$/.test(DB.mtrack || '') ? DB.mtrack : 'media/gamestartup.mp3')); MUSIC_ON = true; }
  else if (!want && MUSIC_ON !== false) { cmd('mp3 stop'); MUSIC_ON = false; }
}

/* ---- internet tekshiruvi: bir nechta serverga 3 martadan so'rov - ping, tebranish, yo'qotish -> mos rate ---- */
var NETT = null, NETT_RUN = false;
function netTest() {
  if (NETT_RUN) return;
  if (CONNECTED) return toast(T('nt_ingame'), 4500);
  if (!hasMM()) return toast(T('nt_na'), 4000);
  var ips = [], i, j, res = [], jobs = [];
  each(PINNED.concat(TOP), function (ip) { if (ips.length < 5 && ips.indexOf(ip) < 0) ips.push(ip); });
  for (j = 0; j < 3; j++) for (i = 0; i < ips.length; i++) jobs.push(ips[i]);
  NETT_RUN = true; NETT = null; showSetTab('pro'); toast(T('nt_run'), 5000);
  function next() {
    if (!jobs.length) return finish();
    var ip = jobs.shift(), t0 = now(), done = false;
    var tm = setTimeout(function () { if (done) return; done = true; res.push(-1); setTimeout(next, 120); }, 2500);
    try {
      NC.matchmaking.getServerInfo(ip).then(function () { if (done) return; done = true; clearTimeout(tm); res.push(now() - t0); setTimeout(next, 120); },
        function () { if (done) return; done = true; clearTimeout(tm); res.push(-1); setTimeout(next, 120); });
    } catch (e) { done = true; clearTimeout(tm); res.push(-1); setTimeout(next, 120); }
  }
  function finish() {
    var ok = [], sum = 0, jit = 0, k;
    for (k = 0; k < res.length; k++) if (res[k] >= 0) { ok.push(res[k]); sum += res[k]; }
    var loss = res.length ? Math.round((res.length - ok.length) * 100 / res.length) : 100;
    var avg = ok.length ? Math.round(sum / ok.length) : 0, best = ok.length ? Math.min.apply(null, ok) : 0;
    for (k = 0; k < ok.length; k++) jit += Math.abs(ok[k] - avg);
    jit = ok.length ? Math.round(jit / ok.length) : 0;
    var rec = (!ok.length || loss > 10 || best > 150) ? { net: 'slow', interp: 0.1 } : (loss > 2 || jit > 30 || best > 80) ? { net: 'mid', interp: 0.05 } : { net: 'fast', interp: 0.01 };
    NETT = { best: best, avg: avg, jit: jit, loss: loss, rec: rec }; NETT_RUN = false;
    if (curModal === 'mdSettings' && setTab === 'pro') showSetTab('pro');
    toast(T('nt_done').replace('{p}', best).replace('{l}', loss), 5000);
  }
  next();
}

/* ---- "Nima yangi": admin panelda yozilgan yangiliklar - har yangisini bir marta ko'rsatamiz ---- */
function loadWhatsNew() {
  api('whatsnew', {}, function (r) {
    if (!r.ok || !r.w || !r.w.id || DB.wnSeen === r.w.id || !r.w.items || !r.w.items.length) return;
    if (DB.dnd) { DB.wnSeen = r.w.id; persist(); return; }               // "Bezovta qilmaslik"
    if (curModal) return setTimeout(loadWhatsNew, 30000);              // boshqa oyna ochiq - keyinroq
    var h = '<div class="wn">' + (r.w.ver ? '<div class="mut">' + esc(r.w.ver) + '</div>' : '') + '<ul>';
    each(r.w.items, function (x) { h += '<li>' + esc(x) + '</li>'; });
    openSide('whatsnew', r.w.title || T('wn_title'), h + '</ul></div>');
    DB.wnSeen = r.w.id; persist();
  });
}

/* ---- kunlik vazifalar: ro'yxat serverdan, bajarilishi o'yin tarixidan ---- */
var MIS = null;
function misProgress(m) {
  // sayt hisoblagani (u mukofotni ham shunga qarab beradi); eski sayt javobida yo'q bo'lsa - o'yin tarixidan
  if (MIS && MIS.prog && MIS.prog[m.id] != null) return Math.min(m.goal, MIS.prog[m.id] | 0);
  var today = new Date().toDateString(), v = 0, set = {}, k = 0, x = 0;
  each(DB.hist || [], function (h) {
    if (new Date(h.t).toDateString() !== today) return;
    var d = h.d || 0;
    if (m.id === 'min') v += d / 60;
    else if (m.id === 'kills') v += h.k || 0;
    else if (m.id === 'servers') set[h.ip] = 1;
    else if (m.id === 'maps') { if (h.map) set[h.map] = 1; }
    else if (m.id === 'xsrv') { if (PINNED.indexOf(h.ip) >= 0 || /x\s*client/i.test(h.name || '')) v += d / 60; }
    else if (m.id === 'kd') { k += h.k || 0; x += h.x || 0; }
  });
  if (m.id === 'servers' || m.id === 'maps') { for (var s2 in set) if (set.hasOwnProperty(s2)) v++; }
  if (m.id === 'kd') v = (x === 0 || k / x >= 1) ? k : 0;           // K/D 1 dan yuqori bo'lgandagina hisoblanadi
  return Math.min(m.goal, Math.floor(v));
}
function openMissions() {
  if (!ME) return openSide('missions', T('ms_title'), '<div class="empty">' + esc(T('ms_login')) + '</div><a class="btn red" data-act="login" style="margin-top:12px">' + esc(T('a_login')) + '</a>');
  api('missions', {}, function (r) {
    if (!r.ok) return toast(r.msg || 'Xato');
    MIS = r; renderMissions();
  });
}
function renderMissions() {
  if (!MIS) return;
  var h = '<div class="mis">';
  each(MIS.list, function (m) {
    var p = misProgress(m), done = MIS.done.indexOf(m.id) >= 0, full = p >= m.goal;
    h += '<div class="msr' + (done ? ' got' : '') + '"><b>' + esc(T('ms_' + m.id).replace('{n}', m.goal)) + '</b><span class="gr">+' + m.xp + ' XP</span>' +
      '<div class="xpw"><i style="width:' + Math.round(p * 100 / m.goal) + '%"></i></div><small>' + p + ' / ' + m.goal + '</small>' +
      (done ? '<em>\u2713 ' + esc(T('ms_got')) + '</em>' : full ? '<a class="btn red" data-misclaim="' + esc(m.id) + '">' + esc(T('ms_claim')) + '</a>' : '') + '</div>';
  });
  h += '<div class="mut" style="font-size:12px;margin-top:10px">' + esc(T('ms_note')) + '</div></div>';
  openSide('missions', T('ms_title'), h);
}

/* ---- admin yuborgan shaxsiy xabarlar ---- */
function showAdminMsgs(list) {
  if (!list || !list.length) return;
  var h = '';
  each(list, function (m) { h += '<div class="amsg"><div>' + esc(m.text) + '</div><small class="mut">' + esc(fmtTime(m.t * 1000)) + '</small></div>'; });
  openSide('amsg', T('am_title'), h);
}

/* ---- qaysi tugmalar bosiladi (admin panel > Tugmalar): 2 daqiqada bir yuboriladi ---- */
var CLK = {}, CLK_N = 0;
document.addEventListener('mousedown', function (e) {
  for (var el = e.target; el && el !== document; el = el.parentNode) {
    if (!el.getAttribute) continue;
    var a = el.getAttribute('data-act') || (el.getAttribute('data-tab') ? 'tab:' + el.getAttribute('data-tab') : '') || (el.getAttribute('data-ip') ? 'connect' : '') || (el.getAttribute('data-ring') ? 'ring' : '') || (el.getAttribute('data-frprof') ? 'frprof' : '');
    if (a) { CLK[a] = (CLK[a] || 0) + 1; CLK_N++; return; }
  }
}, true);
setInterval(function () { if (!CLK_N || !feat('clicks')) return; var c = CLK; CLK = {}; CLK_N = 0; api('clicks', { c: JSON.stringify(c) }, function () {}); }, 120000);

/* ---- menyu ovozlari: o'yin sound/xclient/*.wav ni chaladi (XCLauncher.exe ularni o'yin papkasiga qo'yadi) ---- */
var SFX_ATTR = ['data-act', 'data-tab', 'data-hsub', 'data-seg', 'data-tg', 'data-otg', 'data-ohud', 'data-dd', 'data-ddv', 'data-xchk', 'data-pack',
  'data-sort', 'data-flt', 'data-theme', 'data-daymode', 'data-lang', 'data-prload', 'data-prsave', 'data-style', 'data-calc', 'data-avc', 'data-demo', 'data-dctl', 'data-ovq', 'data-dsel', 'data-vopen', 'data-vdel', 'data-vfold', 'data-vopt', 'data-vtrim', 'data-vshare', 'data-vlink', 'data-copyip', 'data-chat', 'data-fradd2', 'data-fracc', 'data-frdec', 'data-avpre'];
var SFX_QUIET = false, sfxLast = null, sfxT = 0;
function sfx(n) {
  if (!S || S.uisnd === 0 || !hasApi()) return;
  var t = now();
  if (n === 'hover' && (DB.dnd || t - sfxT < 45)) return;
  sfxT = t; cmd('play xclient/' + n + '.wav');
}
function sfxTarget(el) {
  for (; el && el !== document; el = el.parentNode) {
    if (!el.getAttribute) continue;
    for (var i = 0; i < SFX_ATTR.length; i++) if (el.getAttribute(SFX_ATTR[i]) != null) return el;
    if (/(^| )(mi|btn|sr)( |$)/.test(el.className || '')) return el;
  }
  return null;
}
document.addEventListener('mouseover', function (e) { var el = sfxTarget(e.target); if (el && el !== sfxLast) sfx('hover'); sfxLast = el; }, true);
document.addEventListener('mousedown', function (e) {
  var el = sfxTarget(e.target);
  if (!el) return;
  var a = el.getAttribute('data-act');
  if (a === 'close' || /(^| )mi( |$)/.test(el.className || '')) return;            // oyna ochilish/yopilish ovozi o'zi chalinadi
  if (el.getAttribute('data-tg') != null || el.getAttribute('data-otg') != null || el.getAttribute('data-xchk') != null || el.getAttribute('data-pack') != null)
    return sfx(/(^| )on( |$)/.test(el.className || '') ? 'off' : 'on');
  if (el.getAttribute('data-tab') != null || el.getAttribute('data-hsub') != null) return sfx('tab');
  sfx(a === 'save' ? 'save' : 'click');
}, true);
document.onclick = function (e) {
  var t = e.target || e.srcElement, el;
  if (t && t.id === 'lgRemember' || (t && t.parentNode && t.parentNode.id === 'lgRemember')) { var cb = $('lgRemember'); cb.className = cb.className.indexOf('on') >= 0 ? 'cb' : 'cb on'; return; }
  if ((el = closest(t, 'data-ddv'))) { ddPick(el.getAttribute('data-ddv')); return; }
  if ((el = closest(t, 'data-dd'))) { ddOpen(el); return; }
  if (DD) ddClose();
  if ((el = closest(t, 'data-bind'))) { var ka = el.getAttribute('data-bind'); KEYWAIT = KEYWAIT === ka && KEYSLOT === 1 ? '' : ka; KEYSLOT = 1; showSetTab('keys'); return; }
  if ((el = closest(t, 'data-bind2'))) { var kb = el.getAttribute('data-bind2'); KEYWAIT = KEYWAIT === kb && KEYSLOT === 2 ? '' : kb; KEYSLOT = 2; showSetTab('keys'); return; }
  if ((el = closest(t, 'data-fav'))) { toggleFav(el.getAttribute('data-fav')); return; }
  if ((el = closest(t, 'data-inv'))) { api('invite', { to: el.getAttribute('data-inv'), ip: CONNECTED }, function (r) { toast(r.ok ? T('iv_sent') : (r.msg || 'Xato')); }); return; }
  if ((el = closest(t, 'data-avpre'))) { toast(T('lg_wait')); api('avatar', { preset: el.getAttribute('data-avpre') }, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); setMe(r.me); toast(T('saved')); closeModal(); openSettings('account'); }); return; }
  if ((el = closest(t, 'data-fradd2'))) { frAdd(el.getAttribute('data-fradd2')); return; }
  if ((el = closest(t, 'data-fracc'))) { frAdd(el.getAttribute('data-fracc')); return; }
  if ((el = closest(t, 'data-frdec'))) { api('friend_decline', { login: el.getAttribute('data-frdec') }, function () { loadFriends(); }); return; }
  if ((el = closest(t, 'data-chat'))) { openChat(el.getAttribute('data-chat'), el.getAttribute('data-chatn')); return; }
  if ((el = closest(t, 'data-frprof'))) return openFrProfile(el.getAttribute('data-frprof'));
  if ((el = closest(t, 'data-duelp'))) { var dl = el.getAttribute('data-duelp'), dn = el.getAttribute('data-dueln');
    openSide('duel', T('du_title'), '<div class="dupick"><p>' + esc(T('du_how').replace('{n}', dn)) + '</p>' + [5, 10, 15].map(function (m) { return '<a class="btn red" data-duelgo="' + esc(dl) + '" data-duelm="' + m + '">' + m + ' ' + esc(T('du_min')) + '</a>'; }).join('') + '</div>'); return; }
  if ((el = closest(t, 'data-duelgo'))) { api('duel_req', { to: el.getAttribute('data-duelgo'), mins: el.getAttribute('data-duelm') }, function (r) { if (!r.ok) return toast(r.msg || 'Xato', 5000); closeModal(); toast(T('du_sent'), 6000); }); return; }
  if ((el = closest(t, 'data-duelok'))) { duelAnswer(el.getAttribute('data-duelok') === '1'); return; }
  if ((el = closest(t, 'data-equipnc'))) { api('equip', { nc: el.getAttribute('data-equipnc') }, function (r) { if (!r.ok) return toast(r.msg || 'Xato', 5000); ME = r.me; renderBar(); openChests(true); }); return; }
  if ((el = closest(t, 'data-equipfr'))) { api('equip', { frame: el.getAttribute('data-equipfr') }, function (r) { if (!r.ok) return toast(r.msg || 'Xato', 5000); ME = r.me; renderBar(); openChests(true); }); return; }
  if ((el = closest(t, 'data-bgs'))) { DB.bgs = el.getAttribute('data-bgs'); persist(); applyBg(); showSetTab('system'); return; }
  if ((el = closest(t, 'data-ptc'))) { DB.ptc = el.getAttribute('data-ptc'); persist(); applyBg(); showSetTab('system'); return; }
  if ((el = closest(t, 'data-fs'))) { DB.fs = Number(el.getAttribute('data-fs')); persist(); applyTheme(DB.theme || 'red'); showSetTab('system'); return; }
  if ((el = closest(t, 'data-mtrack'))) { DB.mtrack = el.getAttribute('data-mtrack'); persist(); MUSIC_ON = null; cmd('mp3 stop'); musicSync(); showSetTab('sound'); return; }
  if ((el = closest(t, 'data-wallsend'))) { var wto = el.getAttribute('data-wallsend'), wv = clean($('wlIn') ? $('wlIn').value : ''); if (!wv) return; api('wall_add', { to: wto, text: wv }, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); openFrProfile(wto); }); return; }
  if ((el = closest(t, 'data-walldel'))) { var wt2 = el.getAttribute('data-wallto'); api('wall_del', { to: wt2, id: el.getAttribute('data-walldel') }, function () { openFrProfile(wt2); }); return; }
  if ((el = closest(t, 'data-xgal'))) { if (applyCode(el.getAttribute('data-xgal'))) { if (typeof xLive === 'function') xLive(); showSetTab('hud'); toast(T('xg_ok'), 3000); } return; }
  if ((el = closest(t, 'data-cfguse'))) { cfgUse(el.getAttribute('data-cfguse')); return; }
  if ((el = closest(t, 'data-cfglike'))) { var lk = el; api('cfg_like', { code: el.getAttribute('data-cfglike') }, function (r) { if (!r.ok) return toast(r.msg || 'Xato'); lk.innerHTML = '\u2665 ' + r.likes; lk.className = 'btn on'; }); return; }
  if ((el = closest(t, 'data-ring'))) { var rl = el.getAttribute('data-ring'); api('ring', { to: rl, srv: CONNECTED || '' }, function (r) { toast(r.ok ? T('rg_calling') : (r.msg || 'Xato'), 6000); }); return; }
  if ((el = closest(t, 'data-ringok'))) { ringAnswer(el.getAttribute('data-ringok') === '1'); return; }
  if ((el = closest(t, 'data-mcall'))) { var mc = el; api('miss_call', { to: el.getAttribute('data-mcall') }, function (r) { toast(r.ok ? T('mc_ok') : (r.msg || 'Xato'), 5000); if (r.ok && mc.parentNode) mc.parentNode.removeChild(mc); }); return; }
  if ((el = closest(t, 'data-fbk'))) { FBK = el.getAttribute('data-fbk'); var sib = el.parentNode.childNodes; for (var fi = 0; fi < sib.length; fi++) sib[fi].className = sib[fi] === el ? 'on' : ''; return; }
  if ((el = closest(t, 'data-frdel'))) { api('friend_del', { login: el.getAttribute('data-frdel') }, function () { loadFriends(); }); return; }
  if ((el = closest(t, 'data-dbtg'))) { var dk = el.getAttribute('data-dbtg'); var cur = dk === 'fx' ? (DB.fx !== 0 && !FX.off) : (dk === 'autosave' || dk === 'dnd' ? !!DB[dk] : DB[dk] !== 0); DB[dk] = cur ? 0 : 1; persist(); if (dk === 'fx') { FX.off = 0; FX.slow = 0; sparks(); } if (dk === 'hol') applyBg(); if (dk === 'autosave') $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local')); el.className = 'tg' + (DB[dk] ? ' on' : ''); return; }
  if ((el = closest(t, 'data-misclaim'))) {
    var mid = el.getAttribute('data-misclaim');
    sendStat(null, function () { api('mission_claim', { id: mid }, function (r) {   // sayt bajarilganini o'zi tekshiradi - oxirgi o'yin natijasi avval yetib borsin
      if (!r.ok) return toast(r.err === 'notyet' ? T('ms_notyet') : (r.msg || 'Xato'), 5000);
      if (ME) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); }
      MIS.done.push(mid); renderMissions(); toast(T('ms_ok').replace('{n}', r.got), 4000);
    }); });
    return;
  }
  if ((el = closest(t, 'data-ohud'))) { OPTS.hud = Number(el.getAttribute('data-ohud')); saveOpts(T('h_size4')); showSetTab('hud'); return; }
  if ((el = closest(t, 'data-otg'))) { var ok2 = el.getAttribute('data-otg'); OPTS[ok2] = OPTS[ok2] ? 0 : 1; el.className = 'tg' + (OPTS[ok2] ? ' on' : ''); saveOpts(); return; }
  if ((el = closest(t, 'data-tg'))) { var k = el.getAttribute('data-tg'); E[k] = E[k] ? 0 : 1; el.className = 'tg' + (E[k] ? ' on' : ''); if (setTab === 'hud') { drawXhair(); var cd = $('xCode'); if (cd) cd.value = xcode(E); } return; }
  if ((el = closest(t, 'data-avc'))) { api('avatar', { color: el.getAttribute('data-avc') }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); return; }
  if ((el = closest(t, 'data-annx'))) { DB.annHide = (DB.annHide || []).concat([el.getAttribute('data-annx')]).slice(-50); persist(); renderAnn(); return; }
  if ((el = closest(t, 'data-daymode'))) return dayToggle();
  if ((el = closest(t, 'data-theme'))) { DB.theme = el.getAttribute('data-theme'); persist(); cloudSave(); applyTheme(DB.theme); if (curModal === 'mdSettings') showSetTab('cont'); return; }
  if ((el = closest(t, 'data-pack'))) {
    var pid = el.getAttribute('data-pack'), pl = (OPTS.packs ? OPTS.packs.split(',') : []), pix = pl.indexOf(pid);
    if (pix >= 0) pl.splice(pix, 1); else pl.push(pid);
    OPTS.packs = pl.join(','); el.className = 'tg' + (pix >= 0 ? '' : ' on'); saveOpts(); return;
  }
  if ((el = closest(t, 'data-shdel'))) { api('shot_del', { d: PCID, f: el.getAttribute('data-shdel') }, function () { act('gallery'); }); return; }
  if ((el = closest(t, 'data-prsave'))) { profSave(Number(el.getAttribute('data-prsave'))); showSetTab('tools'); return; }
  if ((el = closest(t, 'data-prload'))) { profLoad(Number(el.getAttribute('data-prload'))); showSetTab('tools'); return; }
  if ((el = closest(t, 'data-pren'))) {
    var pi = Number(el.getAttribute('data-pren'));
    ask(T('pf_rename'), function (v) {
      v = String(v || '').replace(/[<>"]/g, '').slice(0, 20); if (!v) return;
      var pp = DB.profiles || []; if (!pp[pi]) pp[pi] = { n: v, t: 0 }; else pp[pi].n = v;
      DB.profiles = pp; persist(); showSetTab('tools');
    });
    return;
  }
  if ((el = closest(t, 'data-calc'))) { var ci = $('calcIn'); if (ci) CALC_V = ci.value; CALC = el.getAttribute('data-calc'); showSetTab('tools'); return; }
  if ((el = closest(t, 'data-style'))) { applyStyle(el.getAttribute('data-style')); return; }
  if (t && t.className === 'ipin') { t.select(); return; }
  if ((el = closest(t, 'data-frcmp'))) { openCompare(el.getAttribute('data-frcmp')); return; }
  if ((el = closest(t, 'data-clkick'))) { clanCall('clan_kick', { who: el.getAttribute('data-clkick') }); return; }
  if ((el = closest(t, 'data-copyip'))) { copyIp(el.getAttribute('data-copyip'), el.parentNode.querySelector('input')); return; }
  if ((el = closest(t, 'data-ovq'))) { OPTS = OPTS || {}; OPTS.vq = el.getAttribute('data-ovq'); saveOpts(T('vq_ok')); showSetTab('demo'); return; }
  if ((el = closest(t, 'data-vopen'))) { vidCmd('open', el.getAttribute('data-vopen')); return; }
  if ((el = closest(t, 'data-vdel'))) { var vn = el.getAttribute('data-vdel'); ask(T('vd_delq'), function () { vidCmd('del', vn); }, false, false, true); return; }
  if ((el = closest(t, 'data-vfold'))) { vidCmd('folder', ''); return; }
  if ((el = closest(t, 'data-vshare'))) {          // klipni saytga va Telegram kanalga
    var vsn = el.getAttribute('data-vshare');
    if (!ME) return toast(T('vs_login'), 5000);
    return ask(T('vs_ask'), function () {
      vidCmd('share', vsn, { srv: CONNECTED ? (srv(CONNECTED).name || CONNECTED) : '' });   // xato bo'lsa (kunlik chegara, qayta kirish) - sababi ko'rinadi
      each([6000, 20000, 45000, 90000, 150000], function (ms) { setTimeout(function () { VIDS_T = 0; vidsRefresh(); }, ms); });
    }, false, false, true);
  }
  if ((el = closest(t, 'data-vlink'))) {
    var url = 'https://mmb.boost-top.com/clips.php?v=' + el.getAttribute('data-vlink');
    copyIp(url, null); return;
  }
  if ((el = closest(t, 'data-vopt'))) {
    var vk = el.getAttribute('data-vopt');
    if (vk === 'gsum') { DB.gsum = DB.gsum === 0 ? 1 : 0; persist(); showSetTab('demo'); return; }
    if (vk === 'acl') { DB.acl = DB.acl === 0 ? 1 : 0; persist(); showSetTab('demo'); return; }
    OPTS[vk] = OPTS[vk] ? 0 : 1; showSetTab('demo');
    if (!PCID) { toast(T('sy_nolaunch'), 4000); return; }
    api('opts_set', { d: PCID, o: JSON.stringify(OPTS) }, function (r) { if (r.ok) vidCmd('opt', '', null, false); else toast(r.msg || 'Xato', 3500); });   // launcher darhol qo'llaydi
    return;
  }
  if ((el = closest(t, 'data-vtrim'))) { vidCmd('edit', el.getAttribute('data-vtrim')); return; }   // launcher muharrir oynasini ochadi (o'yin yig'iladi)
  if ((el = closest(t, 'data-dctl'))) { demoCtl(el.getAttribute('data-dctl')); return; }
  if ((el = closest(t, 'data-demo'))) { closeModal(); demoPlay(el.getAttribute('data-demo')); return; }
  if ((el = closest(t, 'data-dsel'))) { DEMO_SEL = el.getAttribute('data-dsel'); showSetTab('demo'); return; }   // qatorni bosish - pleyerda tanlash (▶ tugmasi yuqorida ushlanadi)
  if ((el = closest(t, 'data-hsub'))) { HSUB = el.getAttribute('data-hsub'); showSetTab('hud'); return; }
  if ((el = closest(t, 'data-xchk'))) {
    var xk = el.getAttribute('data-xchk'), XT = { dot: 3, t: 1, circle: 2 };
    if (xk === 'dyn') E.xdyn = E.xdyn ? 0 : 1;
    else E.xt = Number(E.xt) === XT[xk] ? 0 : XT[xk];
    E.xp = presetOf(E); showSetTab('hud'); return;
  }
  if ((el = closest(t, 'data-xpre'))) {
    var id = el.getAttribute('data-xpre');
    each(XPRE, function (p) { if (p[0] === id) { E.xp = id; E.xt = p[2]; E.xs = p[3]; } });
    showSetTab('hud'); return;
  }
  if ((el = closest(t, 'data-seg'))) {
    var key = el.getAttribute('data-seg'), v = el.getAttribute('data-v');
    E[key] = (typeof DEF[key] === 'number') ? Number(v) : v;
    if (key === 'xs') E.xp = presetOf(E);
    showSetTab(setTab); return;
  }
  if ((el = closest(t, 'data-lang'))) { DB.lang = el.getAttribute('data-lang'); persist(); cloudSave(); setLang(DB.lang); var lp = $('lngpop'); if (lp) lp.parentNode.removeChild(lp); if (curModal === 'mdSettings') showSetTab('system'); return; }
  if ((el = closest(t, 'data-tab'))) { if (curModal === 'mdServers') setSrvTab(el.getAttribute('data-tab')); else showSetTab(el.getAttribute('data-tab')); return; }
  if ((el = closest(t, 'data-flt'))) { var f = el.getAttribute('data-flt'); FLT[f] = !FLT[f]; renderServers(); return; }
  if ((el = closest(t, 'data-sort'))) { var so = el.getAttribute('data-sort'); if (SORT_USER && srvSort === so) srvDesc = !srvDesc; else { srvSort = so; srvDesc = so === 'pl'; } SORT_USER = true; renderServers(); return; }
  if ((el = closest(t, 'data-act'))) { act(el.getAttribute('data-act')); return; }
  if ((el = closest(t, 'data-ip'))) {
    var ip = el.getAttribute('data-ip');
    if (el.className.indexOf('sr') === 0) { srvSel = ip; loadPlayers(ip); query(ip, true); renderServers(); }
    else { closeModal(); connect(ip); }
    return;
  }
  if (t && t.className === 'modal on' && t.id !== 'mdAsk') closeModal();
};
document.ondblclick = function (e) {
  var el = closest(e.target || e.srcElement, 'data-ip');
  if (el && el.className.indexOf('sr') === 0) { closeModal(); connect(el.getAttribute('data-ip')); }
};
function onSlide(e) {
  var t = e.target || e.srcElement;
  if (t && t.getAttribute && t.getAttribute('data-xsz')) {
    var i = Number(t.value); E.xs = SZ[i]; E.xp = presetOf(E); xLive();
    $('vv_xsz').innerHTML = 'x' + (i + 1); drawXhair(); var cd = $('xCode'); if (cd) cd.value = xcode(E);
    var dl = document.querySelector('.dd.xsz span'); if (dl) dl.innerHTML = esc(ddLabel('xsz'));
    return;
  }
  if (t && t.getAttribute && t.getAttribute('data-xop')) {
    E.xtr = Number(t.value) ? 0 : 1; xLive(); $('vv_xop').innerHTML = E.xtr ? '60%' : '100%'; drawXhair(); var cd2 = $('xCode'); if (cd2) cd2.value = xcode(E);
    return;
  }
  if (!t || !t.getAttribute || !t.getAttribute('data-sl')) return;
  var k = t.getAttribute('data-sl');
  E[k] = Math.round(Number(t.value) * 100) / 100; $('vv_' + k).innerHTML = E[k] + (t.getAttribute('data-u') || '');
  if (XEXT.hasOwnProperty(k)) { drawXhair(); xLive(); }
}
document.addEventListener('change', function (e) { onSlide(e); var t = e.target || e.srcElement; if (t && (t.id === 'fMap' || t.id === 'fMode')) renderServers();  }, false);
document.addEventListener('input', onSlide, false);
document.addEventListener('keyup', function (e) { var t = e.target || e.srcElement; if (t && t.id === 'frIn' && e.keyCode !== 13) frSearch(t.value); if (t && t.id === 'calcIn') { CALC_V = t.value; var o = $('calcOut'); if (o) o.innerHTML = calcOut(); } }, false);
document.addEventListener('mousedown', function (e) {
  if (!KEYWAIT || closest(e.target || e.srcElement, 'data-bind') || closest(e.target || e.srcElement, 'data-bind2')) return;
  var pk = closest(e.target || e.srcElement, 'data-pickkey');   // sichqoncha yon tugmalari brauzerga kelmaydi - ro'yxatdan tanlash
  if (pk) { e.preventDefault(); e.stopPropagation(); var kk = pk.getAttribute('data-pickkey'); if (kk) finishWait(kk); else { KEYWAIT = ''; showSetTab('keys'); } return; }
  var b = e.button === 0 ? 'MOUSE1' : e.button === 2 ? 'MOUSE2' : e.button === 1 ? 'MOUSE3' : e.button === 3 ? 'MOUSE4' : 'MOUSE5';
  e.preventDefault(); e.stopPropagation(); finishWait(b);
}, true);
document.addEventListener('mousewheel', function (e) { if (!KEYWAIT) return; e.preventDefault(); finishWait(e.wheelDelta > 0 ? 'MWHEELUP' : 'MWHEELDOWN'); }, false);
document.oncontextmenu = function () { return !KEYWAIT; };
document.onkeydown = function (e) {
  var k = e.keyCode;
  if (KEYWAIT) { finishWait(k === 27 ? '' : keyName(e)); return false; }
  if ($('mdAsk').className === 'modal on') { if (k === 13) askDone(true); if (k === 27) askDone(false); return; }
  if (curModal === 'mdLogin' && k === 13) { doLogin(); return false; }
  if (curModal === 'mdSide' && k === 13 && $('chatIn')) { chatSend(); return false; }
  if (curModal === 'mdSide' && k === 13 && $('frIn')) { act('fradd'); return false; }
  if (k === 27 && curModal) { closeModal(); return false; }
  if (k >= 112 && k <= 123 && k !== 116) { if (e.preventDefault) e.preventDefault(); return false; }   // F1-F12 menyuda hech narsa qilmasin (brauzer tugmalari)
  if (k === 116 || (k === 82 && e.ctrlKey)) { if (e.preventDefault) e.preventDefault(); toast(T('sh_menu'), 3500); return false; }   // F5 menyuni qayta yuklamasin (skrinshot - o'yin ichida)
};
$('askYes').onclick = function () { askDone(true); };
$('askNo').onclick = function () { askDone(false); };
$('srvSearch').onkeyup = function () { renderServers(); };
$('avFile').onchange = function () { avUpload(this.files && this.files[0]); };
$('sprayFile').onchange = function () {
  var f = this.files && this.files[0]; if (!f) return;
  if (!/^image\//.test(f.type || '') || !window.FileReader) return toast(T('a_photo_bad'));
  var rd = new FileReader(); rd.onload = function () { sprayFrom(rd.result); }; rd.readAsDataURL(f);
};

/* ============================================================ boshlash */
var VERSION = qparam('v') || window.XC_VERSION || '';
function detectLang() {
  if (DB.lang) { setLang(DB.lang); return; }
  var m = /[?&]lang=([a-z]+)/i.exec(location.search || '');
  setLang(m ? m[1] : 'uzbek');
}
function renderAll() { renderHome(); renderServers(); }

/* har bir qadam alohida: bittasi buzilsa ham qolgani ishlaydi */
function step(name, fn) { try { fn(); } catch (e) { if (window.onerror) window.onerror(name + ': ' + (e && e.message ? e.message : e), 'xc.js', 0); } }
step('load();', function () { load(); });
step("if (DB.forget) { DB.token = ''; DB.forge", function () { if (DB.forget) { DB.token = ''; DB.forget = 0; persist(); } });      // "Eslab qolish" o'chirilgan bo'lsa - keyingi safar qayta kirish
step('loadSettings();', function () { loadSettings(); });
step('loadBinds();', function () { loadBinds(); binAliases(); });
step('seedFromGame();', function () { seedFromGame(); });
// saqlangan sozlamalar har ochilishda qayta qo'yiladi: sborkaning userconfig.cfg / eski xclient_launcher.cfg ularni o'zgartirib yuboradi
step('demo', function () { if (DB.dplay && now() - DB.dplay.t < 600000) { DEMO_PLAY = true; DEMO_CUR = DB.dplay.n; } });   // demo paytida menyu qayta yuklandi
step('f10', function () {                          // F10 (video) va F9 (oxirgi 30 soniya) - launcher ushlaydi; o'yinda zararsiz bo'lsin
  each(['F10', 'F9'], function (key) {
    var used = false; for (var a in BINDS) if (BINDS.hasOwnProperty(a) && (BINDS[a] === key || BINDS2[a] === key)) used = true;
    if (!used) { cmd('alias xc_' + key.toLowerCase() + ' "echo X CLIENT: ' + key + ' - video (launcher)"'); cmd('bind ' + key + ' xc_' + key.toLowerCase()); }
  });
});   // launcher F10 ni ushlay olmasa ham o'yinda "quit prompt" chiqmasin
step('reapply', function () { if (DB.set) { var ra = function () { applySettings(S); applyBinds(); }; setTimeout(ra, 2500); setTimeout(ra, 12000); } });
step('fit();', function () { fit(); });
step('window.onresize = fit;', function () { window.onresize = fit; });
step('fxLoop();', function () { fxLoop(); });
step('beat', function () { if (DB.beat !== new Date().toDateString()) api('beat', { nick: MYNAME || (S && S.name) || '', res: (screen.width || 0) + 'x' + (screen.height || 0), mv: VERSION }, function (r) { if (r.ok) { DB.beat = new Date().toDateString(); persist(); } }); });   // statistika: menyu ochildi
step('loadAnn', function () { loadAnn(); });
step('loadFeat', function () { loadFeat(); });
step('perf', function () { perfStart(); });
step('music', function () { setTimeout(musicSync, 3000); });
step('whatsnew', function () { setTimeout(loadWhatsNew, 4000); });
step('ngFit', function () { ngFit(); });
step('applyTheme', function () { if ((DB.theme && DB.theme !== 'red') || DB.day || (DB.fs && DB.fs !== 1)) applyTheme(DB.theme || 'red'); else { renderTop2(); applyBg(); } });
step('detectLang();', function () { detectLang(); });
step('loadMaster();', function () { loadMaster(); });
step('loadTop();', function () { loadTop(); });
step('loadWeek();', function () { loadWeek(); });
step('loadOpts();', function () { loadOpts(); });
step('each(PINNED.concat(DB.fav).concat(DB.his', function () { each(PINNED.concat(DB.fav).concat(DB.hist.slice(0, 5).map(function (h) { return h.ip; })), function (ip) { query(ip); }); });
step('renderAll();', function () { renderAll(); });

// kirish oynasi o'zi ochilmaydi - o'ng ustundagi "Akkauntga kiring" kartasi orqali
if (DB.token) api('me', {}, function (r) { if (r.ok) { setMe(r.me); loadFriends(); pingPresence(); } else if (r.err === 'auth') { DB.token = ''; persist(); renderAll(); } });

if (NC) {
  // o'yin ekrani ochildi (NextClient'ning o'z ro'yxatidan yoki konsoldan kirilsa ham) - menyu musiqasi o'chsin
  try { if (NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('hide', function () { UI_VIS = false; if (MUSIC_ON !== false) { cmd('mp3 stop'); MUSIC_ON = false; } }); } catch (e) {}
  try { if (NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('show', function () { UI_VIS = true; each(TOP.concat(PINNED).concat(DB.fav), function (ip) { query(ip); }); if (curModal === 'mdServers') { each(tabIps(), function (ip) { query(ip, true); }); if (srvSel) loadPlayers(srvSel); } if (CHAT && curModal === 'mdSide' && sideMode === 'chat') chatLoad(); loadFriends(); loadWeek(); ngFit(); }); } catch (e) {}
  try {
    if (NC.addEventListener) {
      NC.addEventListener('connect', function (e) { onConnectEvt(e && e.detail && e.detail.address, false); });
      NC.addEventListener('putinserver', function (e) { onConnectEvt(e && e.detail && e.detail.address, true); });
      NC.addEventListener('disconnect', function () { onDisconnectEvt(); });
    }
    if (NC.connectedHost) onConnectEvt(NC.connectedHost, true);
  } catch (e) {}
  try {
    if (NC.console) {
      if (typeof NC.console.init === 'function') NC.console.init();
      if (NC.console.addEventListener) NC.console.addEventListener('message', function (e) { onConsole(e && e.detail && (e.detail.text != null ? e.detail.text : e.detail)); });
    }
  } catch (e) {}
} else dbg('nextclient API yo\'q');

/* O'yin paytida (serverda, menyu yopiq) fonda hech narsa qilmaymiz: serverlarni so'rash o'yin dvigateli orqali ketadi va
 * har 30 soniyada qisqa qotish berardi. Menyu ochilganda ('show') hammasi darhol yangilanadi */
function playing() {
  if (!CONNECTED) return false;
  return !uiShown();
}
setInterval(function () {
  if (playing()) return;
  each(TOP.slice(0, 6).concat(PINNED).concat(DB.fav), function (ip) { query(ip); });
  if (curModal === 'mdServers') each(tabIps(), function (ip) { query(ip); });
}, 30000);
setInterval(function () {                          // "Serverlar" oynasi ochiq va ko'rinib turibdi - 15 soniyada bir yangilanadi
  if (curModal !== 'mdServers' || !uiShown()) return;
  each(tabIps(), function (ip) { query(ip, true); });
  if (srvSel) loadPlayers(srvSel);
}, 15000);
setInterval(pingPresence, 60000);
setInterval(function () { if (CONNECTED) sendStat(); }, 120000);   // o'yin davomida 2 daqiqada bir (o'yin qulab tushsa ham yo'qolmasin)
setInterval(function () { if (!playing()) { loadFriends(); loadWeek(); } }, 60000);   // o'yinda xabarlar pollNotif orqali keladi
setInterval(function () { if (!playing()) loadTop(); }, 10 * 60 * 1000);
setInterval(function () { if (!playing()) loadAnn(); }, 5 * 60 * 1000);
setTimeout(sendStats, 90000); setInterval(sendStats, 10 * 60 * 1000);
})();
