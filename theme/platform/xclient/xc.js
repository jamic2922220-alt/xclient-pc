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
function readCvar(n) { if (!canRead()) return null; try { var v = NC.getCvarValue(n); return v == null ? null : String(v); } catch (e) { return null; } }
function cmd(c) {
  dbg('exec: ' + c);
  try { if (hasApi()) { NC.exec(c + '\n'); return true; } } catch (e) { dbg('exec xato ' + e); }
  return false;
}
function toast(msg, ms) {
  var t = $('toast'); t.innerHTML = esc(msg); t.style.display = 'block';
  clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.style.display = 'none'; }, ms || 2800);
}
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
  $('srvSearch').setAttribute('placeholder', T('search'));
  renderLoginForm();
  renderAll();
}
var LANGS = [['uz', 'UZ', "O'zbekcha", '#1eb53a'], ['ru', 'RU', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', '#0039a6'], ['en', 'EN', 'English', '#012169'],
  ['ua', 'UA', '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', '#0057b7'], ['tr', 'TR', 'T\u00fcrk\u00e7e', '#e30a17'], ['kz', 'KZ', '\u049a\u0430\u0437\u0430\u049b\u0448\u0430', '#00afca'],
  ['kg', 'KG', '\u041a\u044b\u0440\u0433\u044b\u0437\u0447\u0430', '#e8112d'], ['tj', 'TJ', '\u0422\u043e\u04b7\u0438\u043a\u04e3', '#006600'], ['az', 'AZ', 'Az\u0259rbaycanca', '#0092bc'], ['tm', 'TM', 'T\u00fcrkmen\u00e7e', '#28ae66']];
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
  var f = 0, N = 16;                                    // ~1.2 soniya, keyin to'xtaydi
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
function fxVisible() {
  if (curModal || document.webkitHidden) return false;
  try { if (NC && NC.gameUi && NC.gameUi.shown === false) return false; } catch (e) {}
  return true;
}
function sparkReset(p, first) {
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
  var on = DB.fx !== 0 && !FX.off;
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
    p.x += p.vx; p.y += p.vy; p.vx += (Math.random() - 0.5) * 0.4;
    var s = p.el.style;
    s.left = Math.round(p.x) + 'px'; s.top = Math.round(p.y) + 'px'; s.opacity = (p.life / p.max).toFixed(2);
  });
  // kirmaganlarga akkaunt kartasi sekin "nafas oladi"
  if (!ME && ++FX.n % 11 === 0) { var a = $('acct'); if (a) a.className = 'card acct' + (FX.n % 22 ? ' hi' : ''); }
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
var HW = null, OPTS = { beta: 0, auto: 1, start: 0, res: '', win: 0, clean: 0, verify: 0, prio: 0, shots: 0, packs: '', hud: 100 }, CACHE_MB = parseInt(qparam('c'), 10) || 0;
var OPTS_TRY = 0;
function loadOpts() {
  // id berilmasa server shu IP dan oxirgi ulangan XClient.exe ni topadi
  if (!PCID && DB.pcid && DB.pck) PCID = DB.pcid;
  api('opts', PCID ? { d: PCID } : {}, function (r) {
    if (!r.ok && r.err === 'nolaunch' && PCID) { PCID = ''; DB.pcid = DB.pck = ''; persist(); return loadOpts(); }   // kalit eskirgan
    if (!r.ok || !r.o) return;
    if (r.d) PCID = r.d;
    if (r.k) { DB.pcid = r.d; DB.pck = r.k; persist(); }
    for (var k in r.o) if (r.o.hasOwnProperty(k) && OPTS.hasOwnProperty(k)) OPTS[k] = r.o[k];
    if (r.o.ver && !qparam('v')) { VERSION = r.o.ver; renderBar(); }
    if (r.o.cachemb != null && !qparam('c')) CACHE_MB = r.o.cachemb;
    if (r.o.hw) HW = r.o.hw;
    stateSync();
    if (curModal === 'mdSettings' && (setTab === 'pro' || setTab === 'cont')) showSetTab(setTab);
    if (curModal === 'mdSettings' && setTab === 'system') showSetTab('system');
  });
}
/* Menyu holati kompyuter (XCLauncher.exe) bo'yicha saytda ham saqlanadi: o'yin brauzeri localStorage ni har doim ham
 * saqlab qolmaydi (o'yin yopilganda yo'qoladi) - kirish ("Eslab qolish"), sevimlilar, tarix, tugmalar, til qayta tiklanadi. */
var STATE_SYNCED = false, STATE_TM = 0;
function stateData() {
  var h = [];
  each((DB.hist || []).slice(0, 50), function (x) { h.push({ ip: x.ip, name: x.name, map: x.map, t: x.t, d: x.d, k: x.k, x: x.x }); });
  return { token: DB.forget ? '' : (DB.token || ''), fav: DB.fav.slice(0, 100), hist: h, binds: DB.binds || null, binds2: DB.binds2 || null, lang: DB.lang || '', wnSeen: DB.wnSeen || '' };
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
  var body = 'a=' + encodeURIComponent(a) + '&device=' + DB.device + (DB.token ? '&token=' + DB.token : '') + (params && params.d && DB.pck ? '&k=' + DB.pck : '');
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
    if (cb) cb(r);
  };
  try { x.send(body); } catch (e) { done = true; clearTimeout(tm); if (cb) cb({ ok: false, err: 'net', msg: T('lg_neterr') }); }
}
function setMe(me) { ME = me; renderAll(); }
function afterLogin(r) {
  DB.token = r.token; DB.guest = 0; persist();
  setMe(r.me);
  closeModal();
  // yangi kompyuterda: bulutdagi sozlamalarni olamiz, bo'lmasa shu kompyuterdagisini bulutga yuboramiz
  if (r.me.cloud && (!DB.set || r.me.cloudt > (DB.cloudt || 0))) restoreCloud(r.me.cloud, true);
  else cloudSave(true);
  loadFriends();
}
function cloudData() { return { set: DB.set, binds: DB.binds, binds2: DB.binds2, fav: DB.fav, lang: DB.lang }; }
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
    FRIENDS = r.friends || [];
    each(FRIENDS, function (f) {                                   // do'st sevimli serverga kirdi
      if (f.server && before[f.login] !== undefined && before[f.login] !== f.server && isFavIp(f.server) && DB.notifyFr !== 0)
        toast(f.name + T('fr_joined') + (srv(f.server).name || f.server), 5000);
      if (f.server) query(f.server);
    });
    renderHome();
    if (curModal === 'mdServers' && srvTab === 'friends') renderServers();
    if (curModal === 'mdSide' && sideMode === 'friends') openFriends();
  });
}
function loadWeek() { api('top', {}, function (r) { if (r.ok) { WEEK = r.top || []; renderHome(); } }); }
/* do'stdan taklif: "X sizni serverga chaqiryapti" -> Kirish */
function showInvite(iv) {
  var ip = normIp(iv.ip); if (!ip || ip === CONNECTED) return;
  var s = srv(ip); query(ip);
  ask(T('iv_title').replace('{n}', iv.from || iv.login).replace('{s}', s.name || ip), function () { closeModal(); connect(ip); }, false, false, true);
}
function pingPresence() {
  if (!ME) return;
  var s = CONNECTED ? srv(CONNECTED) : null;
  api('ping', { server: CONNECTED || '', map: (s && s.map) || '' }, function (r) {
    if (r.ok && ME) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); }
    if (r.ok && r.inv && r.inv.length) showInvite(r.inv[r.inv.length - 1]);
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
  if (CONNECTED && (normIp(ip) === CONNECTED || !(force || (curModal === 'mdServers' && NC && NC.gameUi && NC.gameUi.shown)))) return;
  var s = srv(ip);
  if (!force && s.ts && now() - s.ts < 20000) return;
  if (s.q) return;
  s.q = 1; queue.push(ip); pump();
}
function pump() {
  while (running < MAXQ && queue.length) {
    (function (ip) {
      running++;
      var s = srv(ip), t0 = now(), done = false;
      function fin() { if (done) return; done = true; running--; s.q = 0; s.ts = now(); onSrvUpdate(s); renderSoon(); pump(); }
      var tm = setTimeout(function () { if (!done) { s.ok = false; s.fail = true; fin(); } }, 6000);
      if (!hasMM()) { clearTimeout(tm); s.fail = true; fin(); return; }
      try {
        NC.matchmaking.getServerInfo(ip).then(function (r) {
          clearTimeout(tm);
          r = r || {};
          s.prevPl = s.ok ? s.pl : null; s.ok = true; s.fail = false; s.ping = now() - t0;
          s.name = clean(r.hostname) || ip; s.map = clean(r.map);
          s.pl = r.playersOnline || 0; s.max = r.playersMax || 0; s.bots = r.botsOnline || 0; s.pass = !!r.isPasswordProtected;
          fin();
        }, function () { clearTimeout(tm); s.ok = false; s.fail = true; fin(); });
      } catch (e) { clearTimeout(tm); s.fail = true; fin(); }
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
  el.onload = function () { if (!done) { done = true; ok(); } };
  el.onerror = function () { if (!done) { done = true; fail(); } };
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
function loadTop() {
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
  if (QUEUE_IP === s.ip && s.ok && !isFull(s)) { var ip = QUEUE_IP; stopQueue(); toast(T('queue_free')); doConnect(ip); }
  if (isFavIp(s.ip) && DB.notifyFav !== 0 && s.prevPl != null && s.max && s.prevPl >= s.max && s.pl < s.max && CONNECTED !== s.ip)
    toast(T('fav_free') + s.name, 5000);
}
function startQueue(ip) {
  stopQueue(); QUEUE_IP = ip; toast(T('queue'), 6000);
  QUEUE_TM = setInterval(function () { query(QUEUE_IP, true); }, 4000);
}
function stopQueue() { QUEUE_IP = ''; clearInterval(QUEUE_TM); }

/* ============================================================ ulanish, tarix, K/D */
var CONNECTED = '', CUR = null;                 // CUR: joriy o'yin (tarix yozuvi)
function connect(ip) {
  ip = normIp(ip);
  if (!ip) return;
  if (S.queue && isFull(srv(ip))) { startQueue(ip); return; }
  stopQueue();
  doConnect(ip);
}
function doConnect(ip) {
  toast(T('connecting') + (srv(ip).name || ip));
  if (!cmd('connect ' + ip)) toast(T('no_api'));
  else startGame(ip);
}
function startGame(ip) {
  var h = DB.hist[0];
  if (h && h.ip === ip && now() - h.t < 90000) { CUR = h; return; }
  var s = srv(ip);
  CUR = { ip: ip, name: s.name || ip, map: s.map || '', t: now(), d: 0, k: 0, x: 0 };
  DB.hist.unshift(CUR);
  if (DB.hist.length > 300) DB.hist.length = 300;
  persist(); renderSoon();
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
function stopRecord() { clearTimeout(REC_TM); if (REC) { cmd('stop'); REC = ''; } }
function onConnectEvt(addr, inGame) {
  addr = normIp(addr);
  if (!addr) return;
  if (addr !== CONNECTED) { CONNECTED = addr; startGame(addr); musicSync(); pingPresence(); renderAll(); }
  if (S.demo) startRecord(inGame ? 1500 : 25000);   // 'connect' dan keyin 'putinserver' kelmasa ham 25 soniyadan so'ng urinamiz
}
function onDisconnectEvt() {
  var was = CONNECTED;
  setTimeout(musicSync, 500);
  if (CUR) { CUR.d = Math.round((now() - CUR.t) / 1000); persist(); }
  stopRecord();
  CONNECTED = ''; renderAll(); pingPresence();
  // o'yinchi o'zi menyudan chiqmagan bo'lsa (menyu yopiq) - qayta ulanamiz
  var shown = false;
  try { shown = !!(NC && NC.gameUi && NC.gameUi.shown); } catch (e) {}
  if (S.reconn && was && !shown) setTimeout(function () { if (!CONNECTED) cmd('retry'); }, 3000);
}
/* konsoldan o'ldirish/o'lish hisobi: "Player1 killed Player2 with ak47" */
var MYNAME = '', CONLOG = [];
function onConsole(txt) {
  txt = String(txt || '');
  CONLOG.push(txt); if (CONLOG.length > 400) CONLOG.shift();
  var r = /Recording to (\S+?)(?:\.dem)?\.?\s*$/i.exec(txt);
  if (r && REC && r[1].indexOf(REC) === 0) demoAdd(REC);
  else if (REC && /(can'?t|cannot|not) record|must be connected/i.test(txt)) { REC = ''; if (S.demo && CONNECTED) startRecord(10000); }   // erta bo'ldi - keyinroq qayta
  if (/\b(wrote|writing|saved)\b.*\.(bmp|tga|jpg|png)\b/i.test(txt)) toast(T('sh_saved'), 2500);   // F5: skrinshot saqlandi
  if (!CUR || !MYNAME) return;
  var m = /^(.+?) killed (.+?) with ([\w\-]+)/.exec(txt.replace(/^\s+/, ''));
  if (!m) return;
  if (m[1] === MYNAME && m[2] !== MYNAME) { CUR.k = (CUR.k || 0) + 1; persist(); }
  else if (m[2] === MYNAME) { CUR.x = (CUR.x || 0) + 1; persist(); }
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
  var html = '', list = TOP.length ? TOP : PINNED;
  each(list.slice(0, 5), function (ip, i) {
    var s = srv(ip);
    var meta = s.ok ? pbar(s) + s.pl + '/' + s.max + ' \u00b7 ' + esc(s.map) : (s.fail ? T('offline') : esc(ip));
    html += '<div class="tr' + (i === 0 ? ' r1' : '') + '" data-ip="' + esc(ip) + '"><div class="rk">' + (i + 1) + '</div>' +
      '<div class="nm">' + flagOf(ip) + esc(s.name || ip) + '</div><div class="mt">' + meta + '</div>' +
      '<div class="go">' + esc(T('join')) + '</div></div>';
  });
  $('topList').innerHTML = html || '<div class="empty">' + esc(T('no_top')) + '</div>';
  // TOP hafta
  var wk = '';
  each(WEEK.slice(0, 3), function (u, i) {
    wk += '<div class="tr' + (i === 0 ? ' r1' : '') + '" style="cursor:default"><div class="rk c av2" style="' + avStyle(u) + '">' + avInner(u, u.name || '?') + '</div>' +
      '<div class="nm one">' + (i + 1) + '. ' + esc(u.name) + (u.vip ? '<span class="vb">VIP</span>' : '') + '</div>' +
      '<div class="sc">' + Math.round(u.week / 6) / 10 + ' <small>' + esc(T('week_h')) + ' \u00b7 ' + esc(T('lvl').replace('{n}', u.level)) + '</small></div></div>';
  });
  $('weekList').innerHTML = wk || '<div class="empty">' + esc(T('no_week')) + '</div>';
  // do'stlar onlayn
  var fr = '', on = 0;
  each(FRIENDS, function (f) {
    if (!f.online) return;
    on++;
    if (on > 3) return;
    var s = f.server ? srv(f.server) : null;
    fr += '<div class="tr"' + (f.server ? ' data-ip="' + esc(f.server) + '"' : ' style="cursor:default"') + '><div class="rk c av2" style="' + avStyle(f) + '">' + avInner(f, f.name) + '</div>' +
      '<div class="nm">' + esc(f.name) + '</div><div class="mt"><span class="gm">\u25cf</span> ' + esc(f.server ? ((s && s.name) || f.server) + (f.map ? ' \u00b7 ' + f.map : '') : T('fr_menu')) + '</div>' +
      (f.server ? '<div class="go">' + esc(T('join')) + '</div>' : '') + '</div>';
  });
  $('frList').innerHTML = fr || '<div class="empty">' + (ME ? esc(T('no_fr')) : '<a data-act="login">' + esc(T('no_fr_login')) + '</a>') + '</div>';
  $('acct').style.display = ME ? 'none' : ''; $('frCard').style.display = ME ? '' : 'none';
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
  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('bOnline').innerHTML = on; $('bServers').innerHTML = cnt || MASTER.length;
  var nm = ME ? ME.name : ((S && S.name) || T('guest_name'));
  $('meName').innerHTML = esc(nm);
  $('meAv').innerHTML = avInner(ME, nm); $('meAv').style.cssText = avStyle(ME);
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
      }, true, false);
    });
  });
}

/* ============================================================ SERVERLAR oynasi */
var srvTab = 'internet', srvSel = '', srvSort = 'pl', srvDesc = true;
var FLT = { ping: false, notempty: false, notfull: false };
function openServers(tab) { openModal('mdServers'); setSrvTab(tab || 'internet'); }
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
  else if (kind === 'res') { OPTS.res = v; saveOpts(); showSetTab('system'); }
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
function loadPlayers(ip) {
  if (!NC || !NC.matchmaking || !NC.matchmaking.getPlayersInfo || (CONNECTED && normIp(ip) === CONNECTED)) return;
  try {
    NC.matchmaking.getPlayersInfo(ip).then(function (list) {
      list = list || [];
      list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      PLAYERS[ip] = list; if (ip === srvSel) renderInfo();
    }, function () { PLAYERS[ip] = []; if (ip === srvSel) renderInfo(); });
  } catch (e) {}
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
}
function openFriends() {
  if (!ME) { openLogin(); return; }
  var keep = $('frIn') ? $('frIn').value : '';
  var h = '<div class="addf"><input class="tx big" id="frIn" type="text" maxlength="20" placeholder="' + esc(T('fr_add')) + '" value="' + esc(keep) + '"><a class="btn red" data-act="fradd">' + esc(T('fr_addb')) + '</a></div>';
  each(FRIENDS, function (f) {
    var s = f.server ? srv(f.server) : null;
    h += '<div class="tr" style="cursor:default"><div class="rk c av2" style="' + (f.online ? avStyle(f) : 'background:#4a4048') + '">' + avInner(f, f.name) + '</div>' +
      '<div class="nm">' + esc(f.name) + ' <span class="mut" style="font-weight:normal;font-size:12px">' + esc(T('lvl').replace('{n}', f.level)) + '</span></div>' +
      '<div class="mt">' + (f.online ? '<span class="gm">\u25cf</span> ' + esc(f.server ? T('fr_in') + ((s && s.name) || f.server) : T('fr_menu')) : esc(T('fr_off'))) + '</div>' +
      (CONNECTED && f.online && f.server !== CONNECTED ? '<a class="go inv" data-inv="' + esc(f.login) + '">' + esc(T('iv_btn')) + '</a>' : '') +
      (f.server ? '<a class="go" data-ip="' + esc(f.server) + '">' + esc(T('join')) + '</a>' : '<a class="go" data-frdel="' + esc(f.login) + '">' + esc(T('fr_del')) + '</a>') + '</div>';
  });
  if (!FRIENDS.length) h += '<div class="empty">' + esc(T('fr_none')) + '</div>';
  openSide('friends', T('m_friends'), h);
}

/* ============================================================ SOZLAMALAR */
var DEF = {
  name: '', tag: 'X | ', net: 'fast', dl: 1, spray: 1, mp3off: 0, hand: 1, fastsw: 1, buykeys: 0, queue: 1, reconn: 1, demo: 0,
  sens: 2.5, zoom: 1.2, raw: 1, filter: 0, inv: 0,
  vol: 0.8, mus: 0.4, voice: 1, vscale: 1, mute: 1,
  fps: 100, showfps: 0, uisnd: 1, gamma: 2.5, fov: 90, vmfov: 90, hor: 1, vsync: 0, dyn: 1, decals: 1000,
  xp: 'pro', xt: 0, xs: 'small', xc: '255 59 59', xtr: 0, xdyn: 0, xthick: 1, xgap: 3, xout: 0, netg: 0, hs: 1, radar: 1, cid: 1, nover: 1, dmax: 5,
  rscale: 115, ropac: 100, rnames: 0, rhp: 0, rmode: 1, rround: 1, rrot: 1, rmap: 0.8,
  vmx: 0, vmy: 0, vmz: 0, vmshift: 0, bobst: 0, lagst: 0, camint: 0,
  roll: 0, rollspd: 200, bobv: 0.13, bobl: 0.32, boblow: 8, bobcam: 1, lagsc: 1, lagsp: 8, fovlerp: 0, camsc: 1,
  rtracks: 0, rfull: 1, rbg: 0, rallies: 1, rns: 0.8, rhs: 1, dtime: 6, drpc: 1, drpcs: 1, drpcj: 1, mmusic: 1,
  bob: 0.01, picmip: 0, detail: 1, shadows: 1, minm: 0, interp: 0.01, lw: 1, lc: 1, hisnd: 1, mixa: 0.1, loop: 0, saytm: 5, ngpos: 1
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
  if (nm) { MYNAME = nm; S.tag = /^X \| /.test(nm) ? 'X | ' : /^\[UZ\] /.test(nm) ? '[UZ] ' : ''; S.name = nm.slice(S.tag.length); }
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
  c.push('volume ' + s.vol, 'voice_enable ' + s.voice, 'voice_scale ' + s.vscale, 'snd_mute_losefocus ' + s.mute);
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
function applySettings(s) { each(settingsCmds(s), function (c) { cmd(c); }); if (s.name) MYNAME = fullName(s); }

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
var SZ = ['extra_small', 'small', 'medium', 'large'];   // NextClient: large eng katta (auto ham shunday); qalinlik doim 1 piksel
function xcode(s) {
  var hex = '';
  each(String(s.xc).split(' '), function (v) { var h = (Number(v) || 0).toString(16).toUpperCase(); hex += h.length < 2 ? '0' + h : h; });
  return 'X-' + s.xt + '-' + Math.max(0, SZ.indexOf(s.xs)) + '-' + (s.xtr ? 1 : 0) + '-' + (s.xdyn ? 1 : 0) + '-' + hex;
}
function applyCode(code) {
  var m = /^X-([0-3])-([0-3])-([01])-([01])-([0-9A-F]{6})$/i.exec(String(code).replace(/\s+/g, ''));
  if (!m) { toast(T('x_badcode')); return false; }
  E.xt = Number(m[1]); E.xs = SZ[Number(m[2])] || 'large'; E.xtr = Number(m[3]); E.xdyn = Number(m[4]);
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
  var c = ['cl_crosshair_type ' + s.xt, 'cl_crosshair_size ' + s.xs, 'cl_crosshair_color ' + q(String(s.xc).replace(/[^\d ]/g, '')), 'cl_crosshair_translucent ' + s.xtr, 'cl_dynamiccrosshair ' + s.xdyn];
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
var STYLES = [
  ['rifle', 'st_rifle', 'st_rifle2', { sens: 2.2, zoom: 1, raw: 1, xt: 0, xs: 'small', xc: '50 250 50', xdyn: 0, interp: 0.01, lw: 1, lc: 1, bob: 0 }],
  ['awp', 'st_awp', 'st_awp2', { sens: 1.8, zoom: 0.85, raw: 1, xt: 3, xs: 'small', xc: '0 230 255', xdyn: 0, interp: 0.01, lw: 1, lc: 1, bob: 0 }],
  ['classic', 'st_classic', 'st_classic2', { sens: 2.5, zoom: 1.2, raw: 1, xt: 0, xs: 'medium', xc: '50 250 50', xdyn: 1, bob: 0.01 }],
  ['new', 'st_new', 'st_new2', { sens: 3, zoom: 1.2, raw: 1, xt: 0, xs: 'medium', xc: '255 210 60', xdyn: 1, bob: 0.01 }],
  ['entry', 'st_entry', 'st_entry2', { sens: 3.2, zoom: 1, raw: 1, filter: 0, xt: 0, xs: 'small', xc: '0 230 255', xdyn: 0, interp: 0.01, lw: 1, lc: 1, bob: 0, fastsw: 1 }],
  ['low', 'st_low', 'st_low2', { sens: 1.4, zoom: 0.9, raw: 1, filter: 0, xt: 0, xs: 'extra_small', xc: '255 255 255', xdyn: 0, interp: 0.01, lw: 1, lc: 1, bob: 0 }],
  ['csgo', 'st_csgo', 'st_csgo2', { bobst: 2, bobv: 0.13, bobl: 0.32, boblow: 8, lagst: 2, lagsc: 1, fovlerp: 0.2, camint: 1, vmx: 1, vmy: 0, vmz: -1, vmfov: 90, xt: 0, xs: 'small', xc: '50 250 50', xdyn: 0 }]
];
function applyStyle(id) {
  each(STYLES, function (x) { if (x[0] === id) for (var k in x[3]) if (x[3].hasOwnProperty(k)) E[k] = x[3][k]; });
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
function hwAuto() {
  var c = hwClass(), v = c === 'weak' ? { detail: 0, shadows: 0, dyn: 0, vsync: 0 }
    : c === 'mid' ? { detail: 0, shadows: 1, dyn: 0, vsync: 0 }
    : { detail: 1, shadows: 1, dyn: 1, vsync: 0 };
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
var THEMES = [['red', 0], ['blue', 212], ['cyan', 188], ['green', 135], ['purple', 272], ['orange', 30]];
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
  if (c[1] < 0.3 || c[2] < 0.08 || c[2] > 0.94 || (c[0] > 22 && c[0] < 338)) return null;   // faqat qizil tuslar
  return hsl2rgb(hue, c[1], c[2]);
}
function hex2(n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; }
function applyTheme(id) {
  var old = $('thcss'); if (old) old.parentNode.removeChild(old);
  var hue = -1; each(THEMES, function (x) { if (x[0] === id) hue = x[1]; });
  if (hue <= 0) return;
  var x; try { x = new XMLHttpRequest(); x.open('GET', 'xc.css?th=' + now(), true); } catch (e) { return; }
  x.onreadystatechange = function () {
    if (x.readyState !== 4 || !x.responseText) return;
    var css = x.responseText.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, function (m, h) {
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      var c = themeColor(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), hue);
      return c ? '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]) : m;
    }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,[^)]*)?\)/gi, function (m, r, g, b, a) {
      var c = themeColor(+r, +g, +b, hue);
      return c ? (a ? 'rgba(' : 'rgb(') + c.join(',') + (a || '') + ')' : m;
    });
    var st = document.createElement('style'); st.id = 'thcss'; st.innerHTML = css;
    document.getElementsByTagName('head')[0].appendChild(st);
  };
  x.send(null);
}
function openSettings(tab) {
  detectXext();
  seedFromGame();
  E = copy(S);
  openModal('mdSettings');
  showSetTab(tab || setTab);
}
function showSetTab(tab) {
  var nm = $('fName'); if (nm && E) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
  setTab = tab;
  if (!PCID && (tab === 'cont' || tab === 'pro' || tab === 'system') && now() - OPTS_TRY > 5000) { OPTS_TRY = now(); loadOpts(); }   // launcher keyinroq ochilgan bo'lsa - qayta topamiz
  each(document.querySelectorAll('#setTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  $('setBody').innerHTML = (PANES[tab] || PANES.game)();
  $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local'));
  if (tab === 'hud') { drawXhair(); drawScope(); if (XLIVE || E && S && xcode(E) !== xcode(S)) xLive(); }
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
      seg('tag', 'g_tag', [['X | ', 'X |'], ['[UZ] ', '[UZ]'], ['', 'g_none']]) +
      '<div class="ph2 m">' + esc(T('g_net')) + '</div><div class="big">' + nets + '</div>' +
      '<div class="mut" style="margin:10px 0 14px;font-size:12px">' + esc(T('g_net_note')) + '</div>' + tg('reconn', 'g_reconn') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('g_server')) + '</div>' +
      tg('queue', 'g_queue', 'g_queue2') + tg('mp3off', 'g_mp3', 'g_mp32') + tg('hand', 'g_hand') + tg('fastsw', 'g_fast') +
      '<div class="ph2 m">' + esc(T('g_demo')) + '</div>' + tg('demo', 'g_rec', 'g_rec2') +
      '<div class="ph2 m">Discord</div>' + tg('drpc', 'g_drpc', 'g_drpc2') + tg('drpcs', 'g_drpcs') + tg('drpcj', 'g_drpcj') + '</div>';
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
      '<a class="btn" style="margin:14px 0 0" data-act="keysdef">' + esc(T('k_def')) + '</a></div>';
  },
  mouse: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('mo_title')) + '</div>' + sl('sens', 'mo_sens', 0.5, 10, 0.1) + sl('zoom', 'mo_zoom', 0.2, 3, 0.05) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('raw', 'mo_raw', 'mo_raw2') + tg('filter', 'mo_filter') + tg('inv', 'mo_inv') + '</div>';
  },
  sound: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('so_title')) + '</div>' + sl('vol', 'so_vol', 0, 1, 0.05) + sl('mus', 'so_mus', 0, 1, 0.05) + sl('vscale', 'so_vscale', 0, 2, 0.1) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('voice', 'so_voice') + tg('loop', 'so_loop') + tg('mute', 'so_mute') + tg('uisnd', 'so_ui', 'so_ui2') + tg('mmusic', 'so_music', 'so_music2') +
      '<div class="ph2 m">' + esc(T('so_q')) + '</div>' + tg('hisnd', 'so_hi') + seg('mixa', 'so_mix', [[0.05, 'so_mix1'], [0.1, 'so_mix2']]) + '</div>';
  },
  video: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('v_title')) + '</div>' +
      seg('fps', 'v_fps', [[100, '100'], [144, '144'], [200, '200'], [300, '300'], [500, '500']]) +
      '<div class="mut" style="margin:-6px 0 8px;font-size:12px">' + esc(T('v_fps2')) + '</div>' +
      sl('gamma', 'v_bright', 1.8, 3, 0.1) + sl('fov', 'v_fov', 70, 100, 1, 'v_fov2') + sl('vmfov', 'v_vm', 70, 100, 1) + sl('decals', 'v_dec', 300, 4000, 100) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('hor', 'v_hor') + tg('vsync', 'v_vsync') + tg('showfps', 'v_showfps') + tg('dyn', 'v_dyn') + '</div>';
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
    each(STYLES, function (x) { st += '<div class="rowb"><b>' + esc(T(x[1])) + '</b><small>' + esc(T(x[2])) + '</small><a class="btn" data-style="' + x[0] + '">' + esc(T('st_apply')) + '</a></div>'; });
    var dm = '';
    each(DB.demos || [], function (d) {
      dm += '<div class="dmr"><b>' + esc(d.s) + '</b><small>' + esc(fmtTime(d.t) + (d.m ? ' · ' + d.m : '') + ' · ' + d.n) + '</small><a class="btn" data-demo="' + esc(d.n) + '">▶ ' + esc(T('dm_play')) + '</a></div>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('pf_title')) + '</div>' + pr +
      '<div class="ph2 m">' + esc(T('cc_title')) + '</div>' +
      '<div class="fr"><div class="lb">' + esc(T('cc_game')) + '</div><div class="ct2 seg">' + games + '</div></div>' +
      '<div class="fr"><div class="lb">' + esc(T('cc_in')) + '</div><div class="ct2 code"><input id="calcIn" value="' + esc(CALC_V) + '"><span class="ccres" id="calcOut">' + calcOut() + '</span>' +
      '<a class="btn b2" data-act="calcapply">' + esc(T('x_apply')) + '</a></div></div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('st_title')) + '</div>' + st +
      '<div class="ph2 m">' + esc(T('dm_title')) + '</div>' +
      (S && S.demo ? '' : '<div class="mut" style="font-size:12px;margin-bottom:6px">' + esc(T('dm_off')) + '</div>') +
      '<div class="dml">' + (dm || '<div class="empty">' + esc(T('dm_none')) + '</div>') + '</div></div>';
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
    if (HSUB === 'radar') {
      return sub + '<div class="pane l hp"><div class="ph2">' + esc(T('hx_radar')) + '</div>' +
        seg('rmode', 'h_rmode', [[1, 'h_rmode1'], [0, 'h_rmode0']]) +
        sl('rscale', 'h_rscale', 50, 300, 5, null, '%') + sl('rmap', 'h_rmap', 0.25, 3, 0.05) + sl('ropac', 'h_ropac', 0, 100, 5, null, '%') +
        seg('rbg', 'h_rbg', [[0, 'h_rbg0'], [1, 'h_rbg1']]) + tg('rround', 'h_rround') + '</div>' +
        '<div class="pane r hp"><div class="ph2">&nbsp;</div>' +
        tg('rrot', 'h_rrot') + tg('rfull', 'h_rfull') + tg('rtracks', 'h_rtracks') + tg('rallies', 'h_rallies', 'h_rallies2') +
        tg('rnames', 'h_rnames') + sl('rns', 'h_rns', 0.6, 2, 0.1) + tg('rhp', 'h_rhp') + sl('rhs', 'h_rhs', 0.3, 4, 0.1) + '</div>';
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
      '<div class="fr cw"><div class="lb">' + esc(T('x_code')) + '</div><div class="ct2 code"><input id="xCode" value="' + esc(xcode(E)) + '"><a class="btn" data-act="xcopy">' + esc(T('x_copy')) + '</a><a class="btn b2" data-act="xcode">' + esc(T('x_apply')) + '</a></div></div></div>' +
      '<div class="pane r hp"><div class="ph2">&nbsp;</div>' +
      '<div class="fr"><div class="lb">' + esc(T('x_size')) + '</div><div class="ct2"><a class="dd xsz" data-dd="xsz"><span>' + esc(ddLabel('xsz')) + '</span><i>▾</i></a>' +
      '<div class="sl sl2"><input type="range" min="0" max="3" step="1" value="' + si + '" data-xsz="1"><div class="vv" id="vv_xsz">x' + (si + 1) + '</div></div></div></div>' +
      off('xthick', 'hx_thick', 1, 5) + off('xgap', 'hx_gap', 0, 10) +
      '<div class="fr"><div class="lb">' + esc(T('hx_opaq')) + '</div><div class="ct2"><div class="sl"><input type="range" min="0" max="1" step="1" value="' + (E.xtr ? 0 : 1) + '" data-xop="1"><div class="vv" id="vv_xop">' + (E.xtr ? '60%' : '100%') + '</div></div></div></div>' +
      off('xout', 'hx_outl', 0, 3) +
      '<div class="cks">' + ck('dot', 'hx_dot', xt === 3) + ck('t', 'hx_t', xt === 1) + ck('circle', 'hx_circ', xt === 2) + ck('dyn', 'hx_wdep', !!E.xdyn) + '</div>' +
      '<div class="hfoot"><span class="mut">' + (XSUP.xthick && XSUP.xgap && XSUP.xout ? '' : esc(T('hx_na'))) + '</span><a class="btn" data-act="xdef">' + esc(T('hx_std')) + '</a><a class="btn xt" data-act="xtest">' + esc(T('hx_test')) + '</a></div></div>';
  },
  account: function () {
    if (!ME) {
      return '<div class="pane full" style="text-align:center;padding-top:110px"><div class="prof"><div class="bigav">?</div><h2>' + esc(T('a_none')) + '</h2>' +
        '<div class="id" style="margin:10px 0 24px">' + esc(T('a_none2')) + '</div><a class="btn red" style="height:44px;line-height:42px;padding:0 30px" data-act="login">' + esc(T('a_login')) + '</a></div></div>';
    }
    var last = ME.cloudt ? (now() / 1000 - ME.cloudt < 120 ? T('a_now') : fmtTime(ME.cloudt * 1000)) : T('a_never');
    return '<div class="pane l"><div class="ph2">' + esc(T('a_profile')) + '</div><div class="prof"><div class="bigav" style="' + avStyle(ME) + '">' + avInner(ME) + '<a class="avcam" data-act="avpick">' + esc(T('a_photo')) + '</a></div>' +
      '<h2>' + esc(ME.name) + '</h2><div class="id">ID: ' + esc(ME.id) + ' \u00b7 ' + esc(T('lvl').replace('{n}', ME.level)) + '</div>' +
      '<div class="xpw"><i style="width:' + Math.round(ME.lvlxp * 100 / ME.lvlmax) + '%"></i></div><div class="xpt">' + ME.lvlxp + ' / ' + ME.lvlmax + ' XP</div>' +
      '<div class="avcols">' + avColors() + '</div>' +
      '<a class="btn" data-act="rename" style="margin:0 6px 0 0">' + esc(T('a_rename')) + '</a><a class="btn" data-act="avpick" style="margin:0 6px 0 0">' + esc(T('a_photo')) + '</a>' +
      (ME.av ? '<a class="btn out" data-act="avdel" style="margin:0">' + esc(T('a_photodel')) + '</a>' : '') + '</div>' +
      (ME.vip ? '<div class="vipbox"><b>' + esc(T('a_vip')) + '</b><span>' + esc(T('a_vip2')) + '</span></div>' : '') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('a_sec')) + '</div>' +
      '<div class="rowb"><b>' + esc(T('a_email')) + '</b><small>' + esc(ME.email || '\u2014') + '</small><a class="btn" data-act="email">' + esc(T('a_change')) + '</a></div>' +
      '<div class="rowb"><b>' + esc(T('a_pass')) + '</b><small>' + esc(T('a_pw_ago').replace('{d}', daysAgo(ME.pwchanged))) + '</small><a class="btn" data-act="passwd">' + esc(T('a_change')) + '</a></div>' +
      '<div class="ph2 m">' + esc(T('a_cloud')) + '</div>' +
      '<div class="fr w"><div class="lb">' + esc(T('a_auto')) + '<small>' + esc(T('a_auto2')) + '</small></div><div class="tg' + (DB.autosave ? ' on' : '') + '" data-dbtg="autosave"><i></i></div></div>' +
      '<div style="margin:6px 0 12px;font-size:14px">' + esc(T('a_last')) + '<span class="gr">' + esc(last) + (ME.cloudt ? ' \u2713' : '') + '</span> \u00b7 ' + esc(T('a_pcs').replace('{n}', ME.devices || 1)) + '</div>' +
      '<a class="btn" style="margin:0 8px 0 0" data-act="cloudsave">' + esc(T('a_savenow')) + '</a><a class="btn" style="margin:0" data-act="cloudget">' + esc(T('a_restore')) + '</a>' +
      '<a class="btn out" style="float:right;margin:0" data-act="logout">' + esc(T('a_logout')) + '</a></div>';
  },
  system: function () {
    var langs = '';
    each(LANGS, function (o) {
      langs += '<a class="' + (CUR_LANG === o[0] ? 'on' : '') + '" data-lang="' + o[0] + '"><b style="background:' + o[3] + '">' + o[1] + '</b>' + esc(o[2]) + (CUR_LANG === o[0] ? '<i>\u2713</i>' : '') + '</a>';
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
      '<div class="fr"><div class="lb">' + esc(T('sy_screen')) + '</div><div class="ct2"><a class="dd wide" data-dd="res"><span>' + esc(ddLabel('res')) + '</span><i>\u25be</i></a></div></div>' +
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
function ask(title, cb, two, pw, noin) {
  askCb = cb; $('askT').innerHTML = esc(title); $('askI').value = ''; $('askI2').value = '';
  $('askI').style.display = noin ? 'none' : '';
  $('askI').type = pw ? 'password' : 'text';
  $('askI2').style.display = two ? '' : 'none';
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
  if (a === 'quick' || a === 'play') { closeModal(); return quick(); }
  if (a === 'servers') return openServers('internet');
  if (a === 'friends') return openFriends();
  if (a === 'missions') return openMissions();
  if (a === 'nettest') return netTest();
  if (a === 'netapply') { if (!NETT) return; E.net = NETT.rec.net; E.interp = NETT.rec.interp; showSetTab('pro'); return toast(T('nt_applied'), 4000); }
  if (a === 'weekall') return openServers('history');
  if (a === 'profile') return ME ? openSettings('account') : openLogin();
  if (a === 'login') return openLogin();
  if (a === 'settings') return openSettings();
  if (a === 'quit') return cmd('quit');
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
    return api('friend_add', { login: v }, function (r) { if (!r.ok) return toast(r.msg); $('frIn').value = ''; loadFriends(); });
  }
  if (a === 'keysdef') { each(ACTIONS, function (x) { if (BINDS2[x[0]]) cmd('unbind ' + q(BINDS2[x[0]])); }); DB.binds = null; DB.binds2 = null; loadBinds(); applyBinds(); persist(); cloudSave(); toast(T('sy_ok')); return showSetTab('keys'); }
  if (a === 'cache') { OPTS.clean = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'verify') { OPTS.verify = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'check') { if (!canRead()) return toast(T('chk_na')); return verifySettings(S); }
  if (a === 'report') return api('report', { log: CONLOG.join('\n'), who: ME ? ME.login : 'guest', ver: VERSION }, function (r) { toast(r.ok ? T('sy_repok') : (r.msg || 'Xato')); });
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
  if (a === 'procfg') {                        // Pro CFG: lag'siz internet, yuqori FPS, aniq sichqoncha
    E.net = 'fast'; E.fps = 100; E.vsync = 0;   // CS 1.6 100 FPS ga moslangan: otish, otdacha va harakat bir xil bo'ladi
    E.raw = 1; E.filter = 0; E.fastsw = 1; E.bob = 0; E.interp = 0.01; E.lw = 1; E.lc = 1;
    E.dyn = 0; E.detail = 0; E.hisnd = 1; E.mixa = 0.05; E.xdyn = 0;
    showSetTab('pro'); return toast(T('pr_cfgok'), 5000);
  }
  if (a === 'fpsmode') {                       // kuchsiz kompyuter: grafikani pasaytiramiz
    E.detail = 0; E.shadows = 0; E.dyn = 0; E.vsync = 0; if (E.fps < 200) E.fps = 200;
    showSetTab('pro'); return toast(T('pr_fpsok'), 5000);
  }
  if (a === 'vmdef') { each(['vmx', 'vmy', 'vmz', 'vmshift', 'lagst', 'lagsc', 'lagsp', 'camint', 'vmfov', 'bob'], function (k) { E[k] = DEF[k]; }); return showSetTab('hud'); }
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
  if (a === 'passwd') return ask(T('a_oldnew'), function (o, n) { api('profile', { oldpass: o, newpass: n }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); toast(T('saved')); showSetTab('account'); }); }, true, true);
  if (a === 'avpick') { var fi = $('avFile'); if (!fi) return; fi.value = ''; try { fi.click(); } catch (e) { toast(T('a_photo_na')); } return; }
  if (a === 'avdel') return api('avatar', { img: 'none' }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); });
  if (a === 'cloudsave') return cloudSave(true);
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
var MUSIC_ON = false;
function musicSync() {
  var want = !!(S && S.mmusic && !CONNECTED && hasApi());
  if (want && !MUSIC_ON) { cmd('mp3volume ' + (S.mp3off ? 0 : S.mus)); cmd('mp3 loop media/gamestartup.mp3'); MUSIC_ON = true; }
  else if (!want && MUSIC_ON) { cmd('mp3 stop'); MUSIC_ON = false; }
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

/* ---- menyu ovozlari: o'yin sound/xclient/*.wav ni chaladi (XCLauncher.exe ularni o'yin papkasiga qo'yadi) ---- */
var SFX_ATTR = ['data-act', 'data-tab', 'data-hsub', 'data-seg', 'data-tg', 'data-otg', 'data-ohud', 'data-dd', 'data-ddv', 'data-xchk', 'data-pack',
  'data-sort', 'data-flt', 'data-theme', 'data-lang', 'data-prload', 'data-prsave', 'data-style', 'data-calc', 'data-avc', 'data-demo', 'data-copyip'];
var SFX_QUIET = false, sfxLast = null, sfxT = 0;
function sfx(n) {
  if (!S || S.uisnd === 0 || !hasApi()) return;
  var t = now();
  if (n === 'hover' && t - sfxT < 45) return;
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
  if ((el = closest(t, 'data-frdel'))) { api('friend_del', { login: el.getAttribute('data-frdel') }, function () { loadFriends(); }); return; }
  if ((el = closest(t, 'data-dbtg'))) { var dk = el.getAttribute('data-dbtg'); var cur = dk === 'autosave' ? !!DB[dk] : DB[dk] !== 0; DB[dk] = cur ? 0 : 1; persist(); if (dk === 'fx') { FX.off = 0; FX.slow = 0; sparks(); } if (dk === 'autosave') $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local')); el.className = 'tg' + (DB[dk] ? ' on' : ''); return; }
  if ((el = closest(t, 'data-misclaim'))) {
    var mid = el.getAttribute('data-misclaim');
    api('mission_claim', { id: mid }, function (r) {
      if (!r.ok) return toast(r.msg || 'Xato');
      if (ME) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); }
      MIS.done.push(mid); renderMissions(); toast(T('ms_ok').replace('{n}', r.got), 4000);
    });
    return;
  }
  if ((el = closest(t, 'data-ohud'))) { OPTS.hud = Number(el.getAttribute('data-ohud')); saveOpts(T('h_size4')); showSetTab('hud'); return; }
  if ((el = closest(t, 'data-otg'))) { var ok2 = el.getAttribute('data-otg'); OPTS[ok2] = OPTS[ok2] ? 0 : 1; el.className = 'tg' + (OPTS[ok2] ? ' on' : ''); saveOpts(); return; }
  if ((el = closest(t, 'data-tg'))) { var k = el.getAttribute('data-tg'); E[k] = E[k] ? 0 : 1; el.className = 'tg' + (E[k] ? ' on' : ''); if (setTab === 'hud') { drawXhair(); var cd = $('xCode'); if (cd) cd.value = xcode(E); } return; }
  if ((el = closest(t, 'data-avc'))) { api('avatar', { color: el.getAttribute('data-avc') }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); return; }
  if ((el = closest(t, 'data-annx'))) { DB.annHide = (DB.annHide || []).concat([el.getAttribute('data-annx')]).slice(-50); persist(); renderAnn(); return; }
  if ((el = closest(t, 'data-theme'))) { DB.theme = el.getAttribute('data-theme'); persist(); cloudSave(); applyTheme(DB.theme); showSetTab('cont'); return; }
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
  if ((el = closest(t, 'data-copyip'))) { copyIp(el.getAttribute('data-copyip'), el.parentNode.querySelector('input')); return; }
  if ((el = closest(t, 'data-demo'))) { closeModal(); cmd('playdemo ' + el.getAttribute('data-demo').replace(/[^\w\-]/g, '')); return; }
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
  if ((el = closest(t, 'data-lang'))) { DB.lang = el.getAttribute('data-lang'); persist(); cloudSave(); setLang(DB.lang); showSetTab('system'); return; }
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
document.addEventListener('keyup', function (e) { var t = e.target || e.srcElement; if (t && t.id === 'calcIn') { CALC_V = t.value; var o = $('calcOut'); if (o) o.innerHTML = calcOut(); } }, false);
document.addEventListener('mousedown', function (e) {
  if (!KEYWAIT || closest(e.target || e.srcElement, 'data-bind') || closest(e.target || e.srcElement, 'data-bind2')) return;
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
  if (curModal === 'mdSide' && k === 13 && $('frIn')) { act('fradd'); return false; }
  if (k === 27 && curModal) { closeModal(); return false; }
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
step('reapply', function () { if (DB.set) { var ra = function () { applySettings(S); applyBinds(); }; setTimeout(ra, 2500); setTimeout(ra, 12000); } });
step('fit();', function () { fit(); });
step('window.onresize = fit;', function () { window.onresize = fit; });
step('fxLoop();', function () { fxLoop(); });
step('beat', function () { if (DB.beat !== new Date().toDateString()) api('beat', { nick: MYNAME || (S && S.name) || '', res: (screen.width || 0) + 'x' + (screen.height || 0), mv: VERSION }, function (r) { if (r.ok) { DB.beat = new Date().toDateString(); persist(); } }); });   // statistika: menyu ochildi
step('loadAnn', function () { loadAnn(); });
step('music', function () { setTimeout(musicSync, 3000); });
step('whatsnew', function () { setTimeout(loadWhatsNew, 4000); });
step('applyTheme', function () { if (DB.theme && DB.theme !== 'red') applyTheme(DB.theme); });
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
  try { if (NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('show', function () { each(TOP.concat(PINNED), function (ip) { query(ip); }); loadFriends(); }); } catch (e) {}
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

setInterval(function () {
  each(TOP.slice(0, 6).concat(PINNED).concat(DB.fav), function (ip) { query(ip); });
  if (curModal === 'mdServers') each(tabIps(), function (ip) { query(ip); });
}, 30000);
setInterval(pingPresence, 60000);
setInterval(function () { loadFriends(); loadWeek(); }, 60000);
setInterval(loadTop, 10 * 60 * 1000);
setInterval(loadAnn, 5 * 60 * 1000);
setTimeout(sendStats, 90000); setInterval(sendStats, 10 * 60 * 1000);
})();
