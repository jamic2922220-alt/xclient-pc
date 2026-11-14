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
function persist() { try { localStorage.setItem('xclient', JSON.stringify(DB)); } catch (e) {} }

/* ============================================================ ekranga moslash (1600x900 dizayn) */
function fit() {
  var w = window.innerWidth || document.documentElement.clientWidth || 1600;
  var h = window.innerHeight || document.documentElement.clientHeight || 900;
  var z = Math.min(w / 1600, h / 900);
  var app = $('app');
  app.style.zoom = z;
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
function fxLoop() {
  intro();
  try { if (NC && NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('show', intro); } catch (e) {}
}
/* ============================================================ XClient.exe bilan aloqa
 * XClient.exe bosh menyu manziliga ?xc=<kompyuter id>&v=<versiya>&c=<kesh MB> qo'shadi.
 * Tizim sozlamalari (beta, Windows bilan ishga tushish, ekran, kesh, fayllarni tekshirish)
 * xc_api.php ga yoziladi va XClient.exe ularni keyingi ishga tushishda bajaradi. */
function qparam(k) { var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search || ''); return m ? decodeURIComponent(m[1]) : ''; }
var PCID = /^[a-z0-9]{8,40}$/.test(qparam('xc')) ? qparam('xc') : '';
var OPTS = { beta: 0, auto: 1, start: 0, res: '', win: 0, clean: 0, verify: 0 }, CACHE_MB = parseInt(qparam('c'), 10) || 0;
function loadOpts() {
  // id berilmasa server shu IP dan oxirgi ulangan XClient.exe ni topadi
  api('opts', PCID ? { d: PCID } : {}, function (r) {
    if (!r.ok || !r.o) return;
    if (r.d) PCID = r.d;
    for (var k in r.o) if (r.o.hasOwnProperty(k) && OPTS.hasOwnProperty(k)) OPTS[k] = r.o[k];
    if (r.o.ver && !qparam('v')) { VERSION = r.o.ver; renderBar(); }
    if (r.o.cachemb != null && !qparam('c')) CACHE_MB = r.o.cachemb;
    if (curModal === 'mdSettings' && setTab === 'system') showSetTab('system');
  });
}
function saveOpts(msg) {
  if (!PCID) { toast(T('sy_nolaunch'), 4000); return; }
  api('opts_set', { d: PCID, o: JSON.stringify(OPTS) }, function (r) { toast(r.ok ? (msg || T('sy_next')) : (r.msg || 'Xato'), 3500); });
}

/* ============================================================ akkaunt API (xc_api.php) */
var ME = null, FRIENDS = [], WEEK = [];
function api(a, params, cb) {
  var body = 'a=' + encodeURIComponent(a) + '&device=' + DB.device + (DB.token ? '&token=' + DB.token : '');
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
function cloudData() { return { set: DB.set, binds: DB.binds, fav: DB.fav, lang: DB.lang }; }
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
  if (c.binds) { DB.binds = c.binds; loadBinds(); applyBinds(); }
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
function pingPresence() {
  if (!ME) return;
  var s = CONNECTED ? srv(CONNECTED) : null;
  api('ping', { server: CONNECTED || '', map: (s && s.map) || '' }, function (r) {
    if (r.ok && ME) { ME.xp = r.xp; ME.level = r.level; ME.lvlxp = r.lvlxp; renderBar(); }
  });
}

/* ============================================================ serverlar */
var PINNED = ['157.22.130.26:27015'];       // X CLIENT o'z serverlari
var SRV = {}, MASTER = [], TOP = [];
var queue = [], running = 0, MAXQ = 12;
function srv(ip) { if (!SRV[ip]) SRV[ip] = { ip: ip }; return SRV[ip]; }
function query(ip, force) {
  if (!ip) return;
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
var PROMO_FAV = [];
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
  loadList(['fav.php'], 'BOOST_FAV', function (l) { if (l) setPromoFav(l); });
}
function itemIp(it) { if (typeof it === 'string') it = { ip: it }; var ip = normIp(it && (it.ip || it.addr || it.address)); if (ip && it.title && !srv(ip).name) srv(ip).name = it.title; return ip; }
function setTop(list) {
  TOP = []; var fav = [];
  each(list || [], function (it) {
    var ip = itemIp(it); if (!ip) return;
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
function onConnectEvt(addr) {
  addr = normIp(addr);
  if (!addr || addr === CONNECTED) return;
  CONNECTED = addr; startGame(addr);
  if (S.demo) setTimeout(function () { var d = new Date(); cmd('record xc_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes())); }, 4000);
  pingPresence(); renderAll();
}
function onDisconnectEvt() {
  var was = CONNECTED;
  if (CUR) { CUR.d = Math.round((now() - CUR.t) / 1000); persist(); }
  if (S.demo) cmd('stop');
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
  if (!CUR || !MYNAME) return;
  var m = /^(.+?) killed (.+?) with ([\w\-]+)/.exec(txt.replace(/^\s+/, ''));
  if (!m) return;
  if (m[1] === MYNAME && m[2] !== MYNAME) { CUR.k = (CUR.k || 0) + 1; persist(); }
  else if (m[2] === MYNAME) { CUR.x = (CUR.x || 0) + 1; persist(); }
}
function bestServer() {
  var best = null;
  function score(s) { return (isX(s) ? 1000 : 0) + (s.pl || 0) * 10 - (s.ping || 300) / 10; }
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
      '<div class="nm">' + esc(s.name || ip) + (isX(s) ? '<span class="xb">X</span>' : '') + '</div><div class="mt">' + meta + '</div>' +
      '<div class="go">' + esc(T('join')) + '</div></div>';
  });
  $('topList').innerHTML = html || '<div class="empty">' + esc(T('no_top')) + '</div>';
  // TOP hafta
  var wk = '';
  each(WEEK.slice(0, 3), function (u, i) {
    wk += '<div class="tr' + (i === 0 ? ' r1' : '') + '" style="cursor:default"><div class="rk c">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>' +
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
    fr += '<div class="tr"' + (f.server ? ' data-ip="' + esc(f.server) + '"' : ' style="cursor:default"') + '><div class="rk c">' + esc(f.name.charAt(0).toUpperCase()) + '</div>' +
      '<div class="nm">' + esc(f.name) + '</div><div class="mt"><span class="gm">\u25cf</span> ' + esc(f.server ? ((s && s.name) || f.server) + (f.map ? ' \u00b7 ' + f.map : '') : T('fr_menu')) + '</div>' +
      (f.server ? '<div class="go">' + esc(T('join')) + '</div>' : '') + '</div>';
  });
  $('frList').innerHTML = fr || '<div class="empty">' + (ME ? esc(T('no_fr')) : '<a data-act="login">' + esc(T('no_fr_login')) + '</a>') + '</div>';
  $('frCnt').innerHTML = on ? on : '';
  $('mFriends').innerHTML = on ? esc(T('fr_on').replace('{n}', on)) : '';
  renderBar();
}
function renderBar() {
  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('bOnline').innerHTML = on; $('bServers').innerHTML = cnt || MASTER.length;
  var nm = ME ? ME.name : ((S && S.name) || T('guest_name'));
  $('meName').innerHTML = esc(nm);
  $('meAv').innerHTML = esc(nm.charAt(0).toUpperCase() || 'X');
  $('meLvl').innerHTML = ME ? esc(T('lvl').replace('{n}', ME.level)) : '';
  $('meXp').style.width = ME ? Math.round(ME.lvlxp * 100 / (ME.lvlmax || 1000)) + '%' : '0';
  $('meVip').style.display = ME && ME.vip ? '' : 'none';
  $('bCloud').innerHTML = esc(CONNECTED ? T('st_in') + (srv(CONNECTED).name || CONNECTED) : (ME ? (ME.cloudt ? T('b_saved') : '') : T('b_guest')));
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

/* ============================================================ SERVERLAR oynasi */
var srvTab = 'internet', srvSel = '', srvSort = 'pl', srvDesc = true;
var FLT = { ping: false, notempty: false, notfull: false };
function openServers(tab) { openModal('mdServers'); setSrvTab(tab || 'internet'); }
function setSrvTab(tab) {
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
  return MASTER.slice();
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
  } else if (kind === 'res') {
    out.push(['', T('sy_res_auto')]);
    var sw = screen.width || 1920, sh = screen.height || 1080, seen = {};
    each([sw + 'x' + sh, '1920x1080', '1680x1050', '1600x900', '1440x900', '1366x768', '1280x1024', '1280x960', '1280x720', '1024x768', '800x600'], function (r) {
      if (!seen[r]) { seen[r] = 1; out.push([r, r.replace('x', ' \u00d7 ')]); }
    });
  }
  return out;
}
function ddValue(kind) { return kind === 'map' ? FMAP : kind === 'mode' ? FMODE : OPTS.res || ''; }
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
  each(rows, function (s) {
    var pc = s.ping < 50 ? 'g' : s.ping < 100 ? 'y' : 'r', h = (isHist || isFav) ? histOf(s.ip) : null, c5 = '', c6 = '';
    if (h) c5 = isHist ? fmtTime(h.t) + (h.d ? ' \u00b7 ' + fmtDur(h.d) : '') : fmtTime(h.t);
    if (isFr) c5 = esc(friendsAt(s.ip).join(', '));
    if (isHist && h) c6 = (h.k || h.x) ? (h.k || 0) + ' / ' + (h.x || 0) : '\u2014';
    html += '<div class="sr' + (s.ip === srvSel ? ' on' : '') + '" data-ip="' + esc(s.ip) + '">' +
      '<span class="c0' + (isFavIp(s.ip) ? ' f' : '') + '" data-fav="' + esc(s.ip) + '">\u2605</span>' +
      '<span class="c1">' + esc(s.name || (h && h.name) || s.ip) + (isX(s) ? '<span class="xb">X</span><span class="vb">VIP</span>' : '') + (s.pass ? '<span class="vb">PW</span>' : '') + (isFav && PROMO_FAV.indexOf(s.ip) >= 0 ? '<span class="vb">' + esc(T('ad')) + '</span>' : '') + '</span>' +
      '<span class="c2">' + (s.ok ? pbar(s) + s.pl + '/' + s.max : (s.fail ? '<span class="rd">' + T('offline') + '</span>' : '...')) + '</span>' +
      '<span class="c3">' + esc(s.map || (h && h.map) || '') + '</span>' +
      '<span class="c4">' + (s.ok ? '<i class="dot ' + pc + '"></i>' + s.ping : '') + '</span>' +
      '<span class="c5">' + c5 + '</span><span class="c6">' + c6 + '</span></div>';
  });
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
  if (!NC || !NC.matchmaking || !NC.matchmaking.getPlayersInfo) return;
  try {
    NC.matchmaking.getPlayersInfo(ip).then(function (list) {
      list = list || [];
      list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      PLAYERS[ip] = list; if (ip === srvSel) renderInfo();
    }, function () { PLAYERS[ip] = []; if (ip === srvSel) renderInfo(); });
  } catch (e) {}
}
function renderInfo() {
  var box = $('srvInfo');
  if (!srvSel) { box.innerHTML = '<div class="empty">' + esc(T('empty_list')) + '</div>'; return; }
  var s = srv(srvSel), pl = PLAYERS[srvSel], ph = '', h = histOf(srvSel);
  if (pl && pl.length) each(pl.slice(0, 40), function (p) { ph += '<div class="pl">' + esc(clean(p.name) || '...') + '<span>' + (p.score || 0) + ' \u00b7 ' + fmtDur(p.timePlayedSeconds) + '</span></div>'; });
  else ph = '<div class="empty" style="padding:8px 0">' + esc(pl ? T('no_players') : T('loading')) + '</div>';
  var pc = s.ping < 50 ? 'gr' : s.ping < 100 ? 'ye' : 'rd', mode = modeOf(s), fr = friendsAt(srvSel);
  box.innerHTML = '<div class="mp' + (mode === 'zm' ? ' zm' : mode === 'awp' ? ' aw' : '') + '"><span>' + esc(s.map || (h && h.map) || '?') + '</span></div>' +
    '<h3>' + esc(s.name || (h && h.name) || srvSel) + '</h3><div class="ip">' + esc(srvSel) + '</div>' +
    '<div class="ln">' + esc(T('ph_players')) + ' <b>' + (s.ok ? s.pl + '/' + s.max : '-') + '</b><span class="r ' + pc + '">' + (s.ok ? '\u25cf ' + s.ping + ' ms' : esc(T('offline'))) + '</span></div>' +
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
    h += '<div class="tr" style="cursor:default"><div class="rk c" style="' + (f.online ? '' : 'background:#4a4048') + '">' + esc(f.name.charAt(0).toUpperCase()) + '</div>' +
      '<div class="nm">' + esc(f.name) + ' <span class="mut" style="font-weight:normal;font-size:12px">' + esc(T('lvl').replace('{n}', f.level)) + '</span></div>' +
      '<div class="mt">' + (f.online ? '<span class="gm">\u25cf</span> ' + esc(f.server ? T('fr_in') + ((s && s.name) || f.server) : T('fr_menu')) : esc(T('fr_off'))) + '</div>' +
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
  fps: 100, gamma: 2.5, fov: 90, vmfov: 90, hor: 1, vsync: 0, dyn: 1, decals: 300,
  xp: 'pro', xt: 0, xs: 'small', xc: '255 59 59', xtr: 0, xdyn: 0, netg: 0, hs: 1, radar: 1, cid: 1, nover: 1, dmax: 5,
  rscale: 115, ropac: 100, rnames: 0, rhp: 0
};
var S = null, E = null;
var CVARS = { sens: 'sensitivity', zoom: 'zoom_sensitivity_ratio', raw: 'm_rawinput', filter: 'm_filter', vol: 'volume', vscale: 'voice_scale', voice: 'voice_enable',
  fps: 'fps_max', gamma: 'gamma', fov: 'fov_angle', vmfov: 'viewmodel_fov', hor: 'fov_horplus', xt: 'cl_crosshair_type', xs: 'cl_crosshair_size',
  xc: 'cl_crosshair_color', xtr: 'cl_crosshair_translucent', xdyn: 'cl_dynamiccrosshair', hand: 'cl_righthand', fastsw: 'hud_fastswitch', dl: 'cl_allowdownload',
  spray: 'cl_allowupload', mute: 'snd_mute_losefocus', vsync: 'gl_vsync', dyn: 'r_dynamic', cid: 'hud_centerid', radar: 'cl_radartype', dmax: 'hud_deathnotice_max', decals: 'mp_decals',
  ropac: 'hud_radar_opacity', rnames: 'hud_radar_names', rhp: 'hud_radar_health' };
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
  var pitch = parseFloat(readCvar('m_pitch')); if (!isNaN(pitch)) S.inv = pitch < 0 ? 1 : 0;
  var ng = parseFloat(readCvar('net_graph')); if (!isNaN(ng)) S.netg = ng > 0 ? 1 : 0;
  var old = parseFloat(readCvar('hud_deathnotice_old')); if (!isNaN(old)) S.hs = old > 0 ? 0 : 1;
  var dv = parseFloat(readCvar('scr_drawversion')); if (!isNaN(dv)) S.nover = dv > 0 ? 0 : 1;
  var rs = parseFloat(readCvar('hud_radar_scale')); if (!isNaN(rs)) S.rscale = Math.round(rs * 100);
  // eski NextClient "extra_small" ni katta (auto) qilib chizadi - eng kichigi "small"
  if (S.xs !== 'small' && S.xs !== 'medium' && S.xs !== 'large' && S.xs !== 'auto') S.xs = 'small';
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
  c.push('cl_allowdownload ' + s.dl, 'cl_allowupload ' + s.spray, 'cl_righthand ' + s.hand, 'hud_fastswitch ' + s.fastsw);
  c.push('mp3volume ' + (s.mp3off ? 0 : s.mus));
  c.push('sensitivity ' + s.sens, 'zoom_sensitivity_ratio ' + s.zoom, 'm_rawinput ' + s.raw, 'm_filter ' + s.filter, 'm_pitch ' + (s.inv ? -0.022 : 0.022));
  c.push('volume ' + s.vol, 'voice_enable ' + s.voice, 'voice_scale ' + s.vscale, 'snd_mute_losefocus ' + s.mute);
  c.push('fps_max ' + s.fps, 'gamma ' + s.gamma, 'fov_angle ' + s.fov, 'viewmodel_fov ' + s.vmfov, 'fov_horplus ' + s.hor, 'gl_vsync ' + s.vsync, 'r_dynamic ' + s.dyn, 'mp_decals ' + s.decals);
  c.push('cl_crosshair_type ' + s.xt, 'cl_crosshair_size ' + s.xs, 'cl_crosshair_color ' + q(s.xc), 'cl_crosshair_translucent ' + s.xtr, 'cl_dynamiccrosshair ' + s.xdyn);
  c.push('net_graph ' + (s.netg ? 3 : 0), 'hud_deathnotice_old ' + (s.hs ? 0 : 1), 'hud_deathnotice_max ' + s.dmax, 'cl_radartype ' + s.radar, 'hud_centerid ' + s.cid, 'scr_drawversion ' + (s.nover ? 0 : 1));
  c.push('hud_radar_scale ' + (s.rscale / 100), 'hud_radar_opacity ' + s.ropac, 'hud_radar_names ' + s.rnames, 'hud_radar_health ' + s.rhp);
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
var XPRE = [['classic', 'x_classic', 0, 'medium'], ['pro', 'x_pro', 0, 'small'], ['dot', 'x_dot', 3, 'small'], ['t', 'x_t', 1, 'small'], ['circle', 'x_circle', 2, 'medium']];
function presetOf(s) {
  var i;
  for (i = 0; i < XPRE.length; i++) if (Number(s.xt) === XPRE[i][2] && s.xs === XPRE[i][3]) return XPRE[i][0];
  for (i = 0; i < XPRE.length; i++) if (Number(s.xt) === XPRE[i][2]) return XPRE[i][0];
  return 'classic';
}
var SZ = ['small', 'medium', 'large', 'auto'];
function xcode(s) {
  var hex = '';
  each(String(s.xc).split(' '), function (v) { var h = (Number(v) || 0).toString(16).toUpperCase(); hex += h.length < 2 ? '0' + h : h; });
  return 'X-' + s.xt + '-' + Math.max(0, SZ.indexOf(s.xs)) + '-' + (s.xtr ? 1 : 0) + '-' + (s.xdyn ? 1 : 0) + '-' + hex;
}
function applyCode(code) {
  var m = /^X-([0-3])-([0-3])-([01])-([01])-([0-9A-F]{6})$/i.exec(String(code).replace(/\s+/g, ''));
  if (!m) { toast(T('x_badcode')); return false; }
  E.xt = Number(m[1]); E.xs = SZ[Number(m[2])]; E.xtr = Number(m[3]); E.xdyn = Number(m[4]);
  E.xc = parseInt(m[5].slice(0, 2), 16) + ' ' + parseInt(m[5].slice(2, 4), 16) + ' ' + parseInt(m[5].slice(4, 6), 16);
  E.xp = presetOf(E);
  return true;
}

var setTab = 'game';
function openSettings(tab) {
  seedFromGame();
  E = copy(S);
  openModal('mdSettings');
  showSetTab(tab || setTab);
}
function showSetTab(tab) {
  var nm = $('fName'); if (nm && E) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
  setTab = tab;
  each(document.querySelectorAll('#setTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  $('setBody').innerHTML = (PANES[tab] || PANES.game)();
  $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local'));
  if (tab === 'hud') drawXhair();
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
      seg('tag', 'g_tag', [['X | ', 'X |'], ['[UZ] ', '[UZ]'], ['', 'g_none']]) + tg('spray', 'g_spray') +
      '<div class="ph2 m">' + esc(T('g_net')) + '</div><div class="big">' + nets + '</div>' +
      '<div class="mut" style="margin:10px 0 14px;font-size:12px">' + esc(T('g_net_note')) + '</div>' + tg('reconn', 'g_reconn') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('g_server')) + '</div>' +
      tg('queue', 'g_queue', 'g_queue2') + tg('dl', 'g_dl', 'g_dl2') + tg('mp3off', 'g_mp3', 'g_mp32') + tg('hand', 'g_hand') + tg('fastsw', 'g_fast') +
      '<div class="ph2 m">' + esc(T('g_demo')) + '</div>' + tg('demo', 'g_rec', 'g_rec2') + '</div>';
  },
  keys: function () {
    var rows = '';
    each(ACTIONS, function (ac) {
      var k = BINDS[ac[0]] || '';
      rows += '<div class="kb' + (KEYWAIT === ac[0] ? ' wait' : '') + '" data-bind="' + esc(ac[0]) + '">' + esc(CUR_LANG === 'ru' || LFALL[CUR_LANG] === 'ru' ? ac[2] : ac[1]) +
        '<span>' + (KEYWAIT === ac[0] ? esc(T('k_press')) : esc(keyLabel(k) || '\u2014')) + '</span></div>';
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
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('voice', 'so_voice') + tg('mute', 'so_mute') + '</div>';
  },
  video: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('v_title')) + '</div>' +
      seg('fps', 'v_fps', [[60, '60'], [100, '100'], [144, '144'], [200, '200'], [300, '300']]) +
      sl('gamma', 'v_bright', 1.8, 3, 0.1) + sl('fov', 'v_fov', 70, 100, 1, 'v_fov2') + sl('vmfov', 'v_vm', 70, 100, 1) + sl('decals', 'v_dec', 50, 1000, 50) + '</div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('hor', 'v_hor') + tg('vsync', 'v_vsync') + tg('dyn', 'v_dyn') + '</div>';
  },
  hud: function () {
    var types = '';
    each(XPRE, function (o) { types += '<a class="' + (E.xp === o[0] ? 'on' : '') + '" data-xpre="' + o[0] + '">' + esc(T(o[1])) + '</a>'; });
    var pal = ['255 59 59', '50 250 50', '0 230 255', '255 210 60', '255 80 220', '255 255 255'];
    if (pal.indexOf(E.xc) < 0 && /^\d+ \d+ \d+$/.test(E.xc)) pal.push(E.xc);
    var cols = '';
    each(pal, function (c) { cols += '<a class="' + (E.xc === c ? 'on' : '') + '" data-seg="xc" data-v="' + c + '" style="background:rgb(' + c.split(' ').join(',') + ')"></a>'; });
    var si = Math.max(0, SZ.indexOf(E.xs)), szl = [T('sz_s'), T('sz_m'), T('sz_l'), T('sz_auto')][si];
    return '<div class="pane l"><div class="ph2">' + esc(T('x_title')) + '</div>' +
      '<div style="position:relative;height:172px"><div id="xPrev"><canvas id="xCan" width="240" height="160"></canvas></div><div class="xl">' + types + '</div></div>' +
      '<div class="fr"><div class="lb">' + esc(T('x_size')) + '</div><div class="ct2"><div class="sl"><input type="range" min="0" max="3" step="1" value="' + si + '" data-xsz="1"><div class="vv" id="vv_xsz">' + esc(szl) + '</div></div></div></div>' +
      '<div class="fr"><div class="lb">' + esc(T('x_color')) + '</div><div class="ct2 sw">' + cols + '</div></div>' +
      tg('xtr', 'x_trans') +
      '<div class="fr cw"><div class="lb">' + esc(T('x_code')) + '</div><div class="ct2 code"><input id="xCode" value="' + esc(xcode(E)) + '"><a class="btn" data-act="xcopy">' + esc(T('x_copy')) + '</a><a class="btn b2" data-act="xcode">' + esc(T('x_apply')) + '</a></div></div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('h_title')) + '</div>' +
      sl('rscale', 'h_rscale', 50, 300, 5, null, '%') + sl('ropac', 'h_ropac', 0, 100, 5, null, '%') + sl('dmax', 'h_kills', 3, 10, 1) +
      tg('hs', 'h_hs') + tg('xdyn', 'x_dyn') + tg('netg', 'h_net') + tg('rnames', 'h_rnames') + tg('cid', 'h_cid') + tg('nover', 'h_draw') + '</div>';
  },
  account: function () {
    if (!ME) {
      return '<div class="pane full" style="text-align:center;padding-top:110px"><div class="prof"><div class="bigav">?</div><h2>' + esc(T('a_none')) + '</h2>' +
        '<div class="id" style="margin:10px 0 24px">' + esc(T('a_none2')) + '</div><a class="btn red" style="height:44px;line-height:42px;padding:0 30px" data-act="login">' + esc(T('a_login')) + '</a></div></div>';
    }
    var last = ME.cloudt ? (now() / 1000 - ME.cloudt < 120 ? T('a_now') : fmtTime(ME.cloudt * 1000)) : T('a_never');
    return '<div class="pane l"><div class="ph2">' + esc(T('a_profile')) + '</div><div class="prof"><div class="bigav">' + esc(ME.name.charAt(0).toUpperCase()) + '</div>' +
      '<h2>' + esc(ME.name) + '</h2><div class="id">ID: ' + esc(ME.id) + ' \u00b7 ' + esc(T('lvl').replace('{n}', ME.level)) + '</div>' +
      '<div class="xpw"><i style="width:' + Math.round(ME.lvlxp * 100 / ME.lvlmax) + '%"></i></div><div class="xpt">' + ME.lvlxp + ' / ' + ME.lvlmax + ' XP</div>' +
      '<a class="btn" data-act="rename" style="margin:0">' + esc(T('a_rename')) + '</a></div>' +
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
  var len = { small: 5, medium: 8, large: 11, auto: 11 }[E.xs] || 5, gap = 3, t = 2, type = Number(E.xt);
  if (type === 3) { g.fillRect(cx - 2, cy - 2, 4, 4); return; }
  if (type === 2) { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, len + 2, 0, Math.PI * 2); g.stroke(); g.fillRect(cx - 1, cy - 1, 2, 2); return; }
  g.fillRect(cx - gap - len, cy - 1, len, t); g.fillRect(cx + gap, cy - 1, len, t); g.fillRect(cx - 1, cy + gap, t, len);
  if (type !== 1) g.fillRect(cx - 1, cy - gap - len, t, len);
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
  ['radio1', 'Radio buyruqlar', '\u0420\u0430\u0434\u0438\u043e', 'z'], ['snapshot', 'Skrinshot', '\u0421\u043a\u0440\u0438\u043d\u0448\u043e\u0442', 'F5']
];
var BINDS = {}, KEYWAIT = '';
function loadBinds() {
  BINDS = {};
  each(ACTIONS, function (a) { BINDS[a[0]] = a[3]; });
  if (DB.binds) for (var k in DB.binds) if (DB.binds.hasOwnProperty(k)) BINDS[k] = DB.binds[k];
}
function applyBinds() { for (var a in BINDS) if (BINDS.hasOwnProperty(a) && BINDS[a]) cmd('bind ' + q(BINDS[a]) + ' ' + q(a)); }
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
function setBind(action, key) {
  var old = BINDS[action];
  for (var a in BINDS) if (BINDS.hasOwnProperty(a) && a !== action && BINDS[a] === key) BINDS[a] = '';
  BINDS[action] = key;
  if (old && old !== key) cmd('unbind ' + q(old));
  cmd('bind ' + q(key) + ' ' + q(action));
  DB.binds = BINDS; persist(); cloudSave();
}
function finishWait(key) {
  var a = KEYWAIT; KEYWAIT = '';
  if (key) { setBind(a, key); toast(keyLabel(key) + ' \u2192 ' + a); }
  showSetTab('keys');
}

/* ============================================================ oynalar */
var curModal = '';
function openModal(id) {
  closeModal();
  curModal = id; $(id).className = 'modal on';
}
function closeModal() {
  if (DD) ddClose();
  if (!curModal) return;
  KEYWAIT = '';
  $(curModal).className = 'modal'; curModal = '';
}
var askCb = null;
function ask(title, cb, two, pw) {
  askCb = cb; $('askT').innerHTML = esc(title); $('askI').value = ''; $('askI2').value = '';
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

/* ============================================================ amallar */
function act(a) {
  if (a === 'quick' || a === 'play') { closeModal(); return quick(); }
  if (a === 'servers') return openServers('internet');
  if (a === 'friends') return openFriends();
  if (a === 'weekall') return openServers('history');
  if (a === 'profile') return ME ? openSettings('account') : openLogin();
  if (a === 'login') return openLogin();
  if (a === 'settings') return openSettings();
  if (a === 'quit') return cmd('quit');
  if (a === 'close') return closeModal();
  if (a === 'guest') { DB.guest = 1; persist(); return closeModal(); }
  if (a === 'dologin') return doLogin();
  if (a === 'lgswitch') { lgReg = !lgReg; return renderLoginForm(); }
  if (a === 'forgot') return toast(T('lg_forgot2'), 5000);
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
  if (a === 'keysdef') { DB.binds = null; loadBinds(); applyBinds(); persist(); cloudSave(); toast(T('sy_ok')); return showSetTab('keys'); }
  if (a === 'cache') { OPTS.clean = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'verify') { OPTS.verify = 1; saveOpts(); return showSetTab('system'); }
  if (a === 'check') { if (!canRead()) return toast(T('chk_na')); return verifySettings(S); }
  if (a === 'report') return api('report', { log: CONLOG.join('\n'), who: ME ? ME.login : 'guest', ver: VERSION }, function (r) { toast(r.ok ? T('sy_repok') : (r.msg || 'Xato')); });
  if (a === 'xcopy') {
    var inp = $('xCode'); inp.value = xcode(E); inp.focus(); inp.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    return toast(ok ? T('x_copied') : T('x_copy2'));
  }
  if (a === 'xcode') { if (applyCode($('xCode').value)) showSetTab('hud'); return; }
  if (a === 'rename') return ask(T('a_newname'), function (v) { api('profile', { name: v }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); });
  if (a === 'email') return ask(T('a_newmail'), function (v) { api('profile', { email: v }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); showSetTab('account'); }); });
  if (a === 'passwd') return ask(T('a_oldnew'), function (o, n) { api('profile', { oldpass: o, newpass: n }, function (r) { if (!r.ok) return toast(r.msg); setMe(r.me); toast(T('saved')); showSetTab('account'); }); }, true, true);
  if (a === 'cloudsave') return cloudSave(true);
  if (a === 'cloudget') return api('me', {}, function (r) { if (!r.ok) return; ME = r.me; restoreCloud(r.me.cloud); if (curModal === 'mdSettings') { seedFromGame(); E = copy(S); showSetTab('account'); } });
  if (a === 'logout') { api('logout', {}); DB.token = ''; ME = null; FRIENDS = []; persist(); closeModal(); renderAll(); return openLogin(); }
  if (a === 'defaults') { var keep = E.name, tag = E.tag; E = copy(DEF); E.name = keep; E.tag = tag; return showSetTab(setTab); }
  if (a === 'save') {
    var nm = $('fName'); if (nm) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
    S = copy(E); DB.set = S; persist(); applySettings(S); closeModal(); renderBar(); cloudSave();
    setTimeout(function () { verifySettings(S); }, 700);
  }
}

/* ============================================================ hodisalar */
document.onclick = function (e) {
  var t = e.target || e.srcElement, el;
  if (t && t.id === 'lgRemember' || (t && t.parentNode && t.parentNode.id === 'lgRemember')) { var cb = $('lgRemember'); cb.className = cb.className.indexOf('on') >= 0 ? 'cb' : 'cb on'; return; }
  if ((el = closest(t, 'data-ddv'))) { ddPick(el.getAttribute('data-ddv')); return; }
  if ((el = closest(t, 'data-dd'))) { ddOpen(el); return; }
  if (DD) ddClose();
  if ((el = closest(t, 'data-bind'))) { KEYWAIT = KEYWAIT === el.getAttribute('data-bind') ? '' : el.getAttribute('data-bind'); showSetTab('keys'); return; }
  if ((el = closest(t, 'data-fav'))) { toggleFav(el.getAttribute('data-fav')); return; }
  if ((el = closest(t, 'data-frdel'))) { api('friend_del', { login: el.getAttribute('data-frdel') }, function () { loadFriends(); }); return; }
  if ((el = closest(t, 'data-dbtg'))) { var dk = el.getAttribute('data-dbtg'); var cur = dk === 'autosave' ? !!DB[dk] : DB[dk] !== 0; DB[dk] = cur ? 0 : 1; persist(); if (dk === 'autosave') $('setNote').innerHTML = esc(ME && DB.autosave ? T('note_cloud') : T('note_local')); el.className = 'tg' + (DB[dk] ? ' on' : ''); return; }
  if ((el = closest(t, 'data-otg'))) { var ok2 = el.getAttribute('data-otg'); OPTS[ok2] = OPTS[ok2] ? 0 : 1; el.className = 'tg' + (OPTS[ok2] ? ' on' : ''); saveOpts(); return; }
  if ((el = closest(t, 'data-tg'))) { var k = el.getAttribute('data-tg'); E[k] = E[k] ? 0 : 1; el.className = 'tg' + (E[k] ? ' on' : ''); if (setTab === 'hud') { drawXhair(); var cd = $('xCode'); if (cd) cd.value = xcode(E); } return; }
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
  if ((el = closest(t, 'data-sort'))) { var so = el.getAttribute('data-sort'); if (srvSort === so) srvDesc = !srvDesc; else { srvSort = so; srvDesc = so === 'pl'; } renderServers(); return; }
  if ((el = closest(t, 'data-act'))) { act(el.getAttribute('data-act')); return; }
  if ((el = closest(t, 'data-ip'))) {
    var ip = el.getAttribute('data-ip');
    if (el.className.indexOf('sr') === 0) { srvSel = ip; loadPlayers(ip); query(ip, true); renderServers(); }
    else { closeModal(); connect(ip); }
    return;
  }
  if (t && t.className === 'modal on' && t.id !== 'mdAsk' && t.id !== 'mdLogin') closeModal();
};
document.ondblclick = function (e) {
  var el = closest(e.target || e.srcElement, 'data-ip');
  if (el && el.className.indexOf('sr') === 0) { closeModal(); connect(el.getAttribute('data-ip')); }
};
function onSlide(e) {
  var t = e.target || e.srcElement;
  if (t && t.getAttribute && t.getAttribute('data-xsz')) {
    var i = Number(t.value); E.xs = SZ[i]; E.xp = presetOf(E);
    $('vv_xsz').innerHTML = esc([T('sz_s'), T('sz_m'), T('sz_l'), T('sz_auto')][i]); drawXhair(); var cd = $('xCode'); if (cd) cd.value = xcode(E);
    return;
  }
  if (!t || !t.getAttribute || !t.getAttribute('data-sl')) return;
  var k = t.getAttribute('data-sl');
  E[k] = Math.round(Number(t.value) * 100) / 100; $('vv_' + k).innerHTML = E[k] + (t.getAttribute('data-u') || '');
}
document.addEventListener('change', function (e) { onSlide(e); var t = e.target || e.srcElement; if (t && (t.id === 'fMap' || t.id === 'fMode')) renderServers();  }, false);
document.addEventListener('input', onSlide, false);
document.addEventListener('mousedown', function (e) {
  if (!KEYWAIT || closest(e.target || e.srcElement, 'data-bind')) return;
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
  if (k === 27 && curModal && curModal !== 'mdLogin') { closeModal(); return false; }
};
$('askYes').onclick = function () { askDone(true); };
$('askNo').onclick = function () { askDone(false); };
$('srvSearch').onkeyup = function () { renderServers(); };

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
step('loadBinds();', function () { loadBinds(); });
step('seedFromGame();', function () { seedFromGame(); });
step('fit();', function () { fit(); });
step('window.onresize = fit;', function () { window.onresize = fit; });
step('fxLoop();', function () { fxLoop(); });
step('detectLang();', function () { detectLang(); });
step('loadMaster();', function () { loadMaster(); });
step('loadTop();', function () { loadTop(); });
step('loadWeek();', function () { loadWeek(); });
step('loadOpts();', function () { loadOpts(); });
step('each(PINNED.concat(DB.fav).concat(DB.his', function () { each(PINNED.concat(DB.fav).concat(DB.hist.slice(0, 5).map(function (h) { return h.ip; })), function (ip) { query(ip); }); });
step('renderAll();', function () { renderAll(); });

if (DB.token) api('me', {}, function (r) { if (r.ok) { setMe(r.me); loadFriends(); pingPresence(); } else if (r.err === 'auth' && !DB.guest) openLogin(); });
else if (!DB.guest) openLogin();

if (NC) {
  try { if (NC.gameUi && NC.gameUi.addEventListener) NC.gameUi.addEventListener('show', function () { each(TOP.concat(PINNED), function (ip) { query(ip); }); loadFriends(); }); } catch (e) {}
  try {
    if (NC.addEventListener) {
      NC.addEventListener('connect', function (e) { onConnectEvt(e && e.detail && e.detail.address); });
      NC.addEventListener('putinserver', function (e) { onConnectEvt(e && e.detail && e.detail.address); });
      NC.addEventListener('disconnect', function () { onDisconnectEvt(); });
    }
    if (NC.connectedHost) onConnectEvt(NC.connectedHost);
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
})();
