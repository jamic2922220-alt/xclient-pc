/* X CLIENT — o'yin ichidagi bosh menyu logikasi. Faqat ES5 (CEF1 / Chrome 17). */
(function () {
'use strict';

/* ------------------------------------------------------------ Promise (CEF1 da yo'q) */
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

/* ------------------------------------------------------------ yordamchilar */
function $(id) { return document.getElementById(id); }
function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function now() { return new Date().getTime(); }
function hasApi() { return !!(window.nextclient && typeof nextclient.exec === 'function'); }
function hasMM() { return !!(window.nextclient && nextclient.matchmaking && nextclient.matchmaking.getServerInfo); }
function closest(el, attr) { while (el && el !== document) { if (el.getAttribute && el.getAttribute(attr) != null) return el; el = el.parentNode; } return null; }
var DEBUG = /[?&]debug=1/.test(location.search);
function dbg(m) { if (!DEBUG) return; var d = $('dbg'); d.style.display = 'block'; d.innerHTML = esc(m) + '<br>' + d.innerHTML.slice(0, 2000); }

function cmd(c) {
  dbg('exec: ' + c);
  try { if (hasApi()) { nextclient.exec(c + '\n'); return true; } } catch (e) { dbg('exec xato ' + e); }
  return false;
}
function toast(msg) {
  var t = $('toast'); t.innerHTML = esc(msg); t.style.display = 'block';
  clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.style.display = 'none'; }, 2600);
}
function normIp(ip) {
  ip = String(ip || '').replace(/\s+/g, '');
  if (!/^[\w.\-]+(:\d{1,5})?$/.test(ip)) return '';
  if (ip.indexOf(':') < 0) ip += ':27015';
  return ip;
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  if (L === LANG.ru) return h ? h + ' \u0447 ' + m + ' \u043c\u0438\u043d' : m + ' \u043c\u0438\u043d';
  if (L === LANG.en) return h ? h + ' h ' + m + ' min' : m + ' min';
  return h ? h + ' soat ' + m + ' daq' : m + ' daq';
}
function fmtTime(ts) {
  var d = new Date(ts), n = new Date();
  var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  if (d.toDateString() === n.toDateString()) return hm;
  return d.getDate() + '.' + (d.getMonth() + 1) + ' ' + hm;
}

/* ------------------------------------------------------------ til */
var LANG = window.XC_LANG || { uz: {} };
var L = LANG.uz;
function T(k) { return (L && L[k] != null) ? L[k] : (LANG.uz[k] != null ? LANG.uz[k] : k); }
function applyLang() {
  each(document.querySelectorAll('[data-t]'), function (el) { el.innerHTML = esc(T(el.getAttribute('data-t'))); });
  $('srvSearch').setAttribute('placeholder', T('search'));
  renderAll();
}
function setLang(code) {
  code = String(code || '').toLowerCase();
  var map = { uzbek: 'uz', uz: 'uz', russian: 'ru', ukrainian: 'ru', ru: 'ru', english: 'en', en: 'en' };
  var c = map[code] || 'uz';
  L = LANG[c] || LANG.uz; CUR_LANG = c;
  applyLang();
}
var CUR_LANG = 'uz';

/* ------------------------------------------------------------ saqlash (shu kompyuterda) */
var DB = { fav: [], hist: [], set: null, lang: '' };
function load() {
  try { var x = JSON.parse(localStorage.getItem('xclient') || '{}'); for (var k in x) if (x.hasOwnProperty(k)) DB[k] = x[k]; } catch (e) {}
  if (!DB.fav || !DB.fav.length) DB.fav = [];
  if (!DB.hist || !DB.hist.length) DB.hist = [];
}
function persist() { try { localStorage.setItem('xclient', JSON.stringify(DB)); } catch (e) {} }

/* ------------------------------------------------------------ ekranga moslash (1600x900 dizayn) */
function fit() {
  var w = window.innerWidth || document.documentElement.clientWidth || 1600;
  var h = window.innerHeight || document.documentElement.clientHeight || 900;
  var z = Math.min(w / 1600, h / 900);
  var app = $('app');
  app.style.zoom = z;
  // keng ekranda chap/o'ng chetlar bo'sh qolmasin: app kengligini ekran nisbatiga cho'zamiz
  var W = Math.round(w / z), H = Math.round(h / z);
  app.style.width = W + 'px'; app.style.height = H + 'px';
  each(document.querySelectorAll('.modal'), function (m) { m.style.width = W + 'px'; m.style.height = H + 'px'; });
  each(document.querySelectorAll('.win'), function (m) { m.style.left = Math.round((W - 1180) / 2) + 'px'; m.style.top = Math.max(10, Math.round((H - 52 - 780) / 2)) + 'px'; });
  var ask = document.querySelector('.ask'); ask.style.left = Math.round((W - 480) / 2) + 'px'; ask.style.top = Math.round((H - 180) / 2) + 'px';
  $('toast').style.left = Math.round((W - 400) / 2) + 'px';
}

/* ------------------------------------------------------------ serverlar */
var PINNED = ['157.22.130.26:27015'];       // X CLIENT o'z serverlari
var SRV = {};                                // ip -> {ip, name, map, pl, max, bots, pass, ping, ok, fail, ts}
var MASTER = [];                             // Internet ro'yxati
var TOP = [];                                // boost-top reklama TOP
var queue = [], running = 0, MAXQ = 12;

function srv(ip) { if (!SRV[ip]) SRV[ip] = { ip: ip }; return SRV[ip]; }
function query(ip, force) {
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
      function fin() { if (done) return; done = true; running--; s.q = 0; s.ts = now(); renderSoon(); pump(); }
      var tm = setTimeout(function () { if (!done) { s.ok = false; s.fail = true; fin(); } }, 6000);
      if (!hasMM()) { clearTimeout(tm); s.fail = true; fin(); return; }
      try {
        nextclient.matchmaking.getServerInfo(ip).then(function (r) {
          clearTimeout(tm);
          r = r || {};
          s.ok = true; s.fail = false; s.ping = now() - t0;
          s.name = clean(r.hostname) || ip; s.map = clean(r.map);
          s.pl = r.playersOnline || 0; s.max = r.playersMax || 0; s.bots = r.botsOnline || 0; s.pass = !!r.isPasswordProtected;
          fin();
        }, function () { clearTimeout(tm); s.ok = false; s.fail = true; fin(); });
      } catch (e) { clearTimeout(tm); s.fail = true; fin(); }
    })(queue.shift());
  }
}
function clean(v) { return String(v || '').replace(/[\u0000-\u001f\u007f-\u009f\ufffd\u2580-\u259f]/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, ''); }
function isX(s) { return PINNED.indexOf(s.ip) >= 0 || /x\s*client/i.test(s.name || ''); }
function isFav(ip) { return DB.fav.indexOf(ip) >= 0; }

var rTimer = 0;
function renderSoon() { if (rTimer) return; rTimer = setTimeout(function () { rTimer = 0; renderAll(); }, 250); }

/* master ro'yxat: launcher yozgan master.js + (iloji bo'lsa) saytdan yangisi */
function loadMaster() {
  var list = window.XC_MASTER && window.XC_MASTER.length ? window.XC_MASTER : [];
  setMaster(list);
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

/* boost-top TOP reklama ro'yxati (script orqali — CORS kerak emas) */
function loadScript(src, ok, fail) {
  var done = false, el = document.createElement('script');
  el.src = src;
  el.onload = function () { if (!done) { done = true; ok(); } };
  el.onerror = function () { if (!done) { done = true; fail(); } };
  setTimeout(function () { if (!done) { done = true; fail(); } }, 6000);
  document.getElementsByTagName('head')[0].appendChild(el);
}
function loadTop() {
  var urls = ['https://boost-top.com/mmb/top.php', 'http://boost-top.com/mmb/top.php'], n = 0;
  function next() {
    if (n >= urls.length) { setTop([]); return; }
    window.BOOST_TOP = null;
    loadScript(urls[n++] + '?t=' + now(), function () {
      if (window.BOOST_TOP && window.BOOST_TOP.length != null) setTop(window.BOOST_TOP); else next();
    }, next);
  }
  next();
}
function setTop(list) {
  TOP = [];
  each(list || [], function (it) {
    if (typeof it === 'string') it = { ip: it };
    var ip = normIp(it && it.ip);
    if (ip) { TOP.push(ip); if (it.title && !srv(ip).name) srv(ip).name = it.title; }
  });
  each(TOP.slice(0, 6), function (ip) { query(ip); });
  renderSoon();
}

/* ------------------------------------------------------------ ulanish va tarix */
var CONNECTED = '';
function connect(ip) {
  ip = normIp(ip);
  if (!ip) return;
  addHist(ip);
  toast(T('connecting') + (srv(ip).name || ip));
  if (!cmd('connect ' + ip)) toast(T('no_api'));
}
function addHist(ip) {
  var s = srv(ip);
  DB.hist.unshift({ ip: ip, name: s.name || ip, map: s.map || '', t: now(), d: 0 });
  if (DB.hist.length > 200) DB.hist.length = 200;
  persist(); renderSoon();
}
function onConnectEvt(addr) {
  addr = normIp(addr);
  if (!addr) return;
  CONNECTED = addr;
  var h = DB.hist[0];
  if (!h || h.ip !== addr || now() - h.t > 60000) addHist(addr);
  DB.cur = { ip: addr, t: now() }; persist(); renderBar();
}
function onDisconnectEvt() {
  if (DB.cur) {
    for (var i = 0; i < DB.hist.length; i++) {
      if (DB.hist[i].ip === DB.cur.ip && DB.hist[i].t >= DB.cur.t - 60000) { DB.hist[i].d = Math.round((now() - DB.cur.t) / 1000); break; }
    }
    DB.cur = null; persist();
  }
  CONNECTED = ''; renderBar(); renderSoon();
}
function bestServer() {
  var best = null;
  function score(s) { return (isX(s) ? 1000 : 0) + (s.pl || 0) * 10 - (s.ping || 300) / 10; }
  for (var ip in SRV) {
    var s = SRV[ip];
    if (!s.ok || s.pass || (s.max && s.pl >= s.max)) continue;
    if (!best || score(s) > score(best)) best = s;
  }
  return best;
}
function quick() {
  var b = bestServer();
  if (b) connect(b.ip); else toast(T('no_srv'));
}

/* ------------------------------------------------------------ bosh ekran */
function pbar(s) { var p = s.max ? Math.min(100, Math.round(s.pl * 100 / s.max)) : 0; return '<span class="pbar"><i style="width:' + p + '%"></i></span>'; }
function renderHome() {
  // O'YNASH kartasi
  var b = bestServer();
  $('playSub').innerHTML = b ? esc(b.name + (b.map ? ' \u00b7 ' + b.map : '')) : esc(T('loading'));
  $('playCnt').innerHTML = b ? b.pl + '/' + b.max : '--';
  // TOP
  var html = '', list = TOP.length ? TOP : PINNED;
  each(list.slice(0, 5), function (ip, i) {
    var s = srv(ip);
    var meta = s.ok ? pbar(s) + s.pl + '/' + s.max + ' \u00b7 ' + esc(s.map) : (s.fail ? T('offline') + ' \u00b7 ' + esc(ip) : esc(ip));
    html += '<div class="tr' + (i === 0 ? ' r1' : '') + '" data-ip="' + esc(ip) + '"><div class="rk">' + (i + 1) + '</div>' +
      '<div class="nm">' + esc(s.name || ip) + (isX(s) ? '<span class="xb">X</span>' : '') + '</div><div class="mt">' + meta + '</div>' +
      '<div class="go">' + esc(T('join')) + '</div></div>';
  });
  $('topList').innerHTML = html || '<div class="empty">' + esc(T('no_top')) + '</div>';
  // oxirgi o'ynalganlar (har serverdan bittadan)
  var seen = {}, rows = '', n = 0;
  each(DB.hist, function (h) {
    if (seen[h.ip] || n >= 3) return; seen[h.ip] = 1; n++;
    var s = srv(h.ip);
    rows += '<div class="tr" data-ip="' + esc(h.ip) + '"><div class="rk">' + esc((s.name || h.name || '?').charAt(0).toUpperCase()) + '</div>' +
      '<div class="nm">' + esc(s.name || h.name) + '</div><div class="mt">' + (s.ok ? s.pl + '/' + s.max + ' \u00b7 ' + esc(s.map) + ' \u00b7 ' : '') + fmtTime(h.t) + '</div>' +
      '<div class="go">' + esc(T('join')) + '</div></div>';
  });
  $('lastList').innerHTML = rows || '<div class="empty">' + esc(T('no_last')) + '</div>';
  $('mFavs').innerHTML = DB.fav.length ? DB.fav.length : '';
  renderBar();
}
function renderBar() {
  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('bOnline').innerHTML = on; $('bServers').innerHTML = cnt || MASTER.length;
  var nm = (S && S.name) || 'Player';
  $('meName').innerHTML = esc((S && S.tag ? S.tag : '') + nm);
  $('meAv').innerHTML = esc(nm.charAt(0).toUpperCase() || 'X');
  $('meState').innerHTML = esc(CONNECTED ? T('st_in') + (srv(CONNECTED).name || CONNECTED) : T('st_menu'));
}

/* ------------------------------------------------------------ SERVERLAR oynasi */
var srvTab = 'internet', srvSel = '', srvSort = 'pl', srvDesc = true;
var FLT = { ping: false, notempty: false, notfull: false, nopass: false };
function openServers(tab) {
  openModal('mdServers');
  setSrvTab(tab || 'internet');
}
function setSrvTab(tab) {
  srvTab = tab;
  each(document.querySelectorAll('#srvTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  var ips = tabIps();
  each(ips, function (ip) { query(ip); });
  if (!srvSel || ips.indexOf(srvSel) < 0) srvSel = ips[0] || '';
  if (srvSel) loadPlayers(srvSel);
  renderServers();
}
function tabIps() {
  if (srvTab === 'favs') return DB.fav.slice();
  if (srvTab === 'top') return TOP.slice();
  if (srvTab === 'history') { var seen = {}, out = []; each(DB.hist, function (h) { if (!seen[h.ip]) { seen[h.ip] = 1; out.push(h.ip); } }); return out; }
  return MASTER.slice();
}
function lastPlayed(ip) { for (var i = 0; i < DB.hist.length; i++) if (DB.hist[i].ip === ip) return DB.hist[i].t; return 0; }
function renderServers() {
  if (curModal !== 'mdServers') return;
  var isHist = srvTab === 'history';
  $('favCnt').innerHTML = DB.fav.length ? '(' + DB.fav.length + ')' : '';
  $('h5').innerHTML = esc(srvTab === 'internet' || srvTab === 'top' ? '' : T('h_last'));
  $('quickBtn').style.display = srvTab === 'internet' ? '' : 'none';
  $('addIpBtn').style.display = srvTab === 'favs' ? '' : 'none';
  $('clearHist').style.display = isHist ? '' : 'none';
  $('srvList').style.bottom = isHist ? '92px' : '10px';
  $('histStats').style.height = isHist ? '70px' : '0';
  each(document.querySelectorAll('#srvTools .chip'), function (c) { c.className = 'chip' + (FLT[c.getAttribute('data-flt')] ? ' on' : ''); });

  var q = ($('srvSearch').value || '').toLowerCase();
  var rows = [];
  each(tabIps(), function (ip) {
    var s = srv(ip);
    if (srvTab === 'internet' && !s.ok) return;                 // javob bermaganlar ko'rinmaydi
    if (q && ((s.name || '') + ' ' + ip + ' ' + (s.map || '')).toLowerCase().indexOf(q) < 0) return;
    if (FLT.ping && !(s.ok && s.ping < 50)) return;
    if (FLT.notempty && !(s.pl > 0)) return;
    if (FLT.notfull && s.max && s.pl >= s.max) return;
    if (FLT.nopass && s.pass) return;
    rows.push(s);
  });
  if (srvTab === 'internet' || srvTab === 'top') {
    rows.sort(function (a, b) {
      if (isX(a) !== isX(b)) return isX(a) ? -1 : 1;              // X CLIENT serverlari doim tepada
      var va = a[srvSort], vb = b[srvSort];
      if (srvSort === 'name' || srvSort === 'map') { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); return (va < vb ? -1 : va > vb ? 1 : 0) * (srvDesc ? -1 : 1); }
      va = va == null ? 9999 : va; vb = vb == null ? 9999 : vb;
      return (va - vb) * (srvDesc ? -1 : 1);
    });
  }
  var html = '';
  each(rows, function (s) {
    var pc = s.ping < 50 ? 'g' : s.ping < 100 ? 'y' : 'r';
    var last = srvTab === 'favs' || isHist ? lastPlayed(s.ip) : 0;
    html += '<div class="sr' + (s.ip === srvSel ? ' on' : '') + '" data-ip="' + esc(s.ip) + '">' +
      '<span class="c0' + (isFav(s.ip) ? ' f' : '') + '" data-fav="' + esc(s.ip) + '">\u2605</span>' +
      '<span class="c1">' + esc(s.name || s.ip) + (isX(s) ? '<span class="xb">X</span><span class="vb">VIP</span>' : '') + (s.pass ? '<span class="vb">PW</span>' : '') + '</span>' +
      '<span class="c2">' + (s.ok ? pbar(s) + s.pl + '/' + s.max : (s.fail ? '<span class="rd">' + T('offline') + '</span>' : '...')) + '</span>' +
      '<span class="c3">' + esc(s.map || '') + '</span>' +
      '<span class="c4">' + (s.ok ? '<i class="dot ' + pc + '"></i>' + s.ping : '') + '</span>' +
      '<span class="c5">' + (last ? fmtTime(last) : '') + '</span></div>';
  });
  var emptyMsg = srvTab === 'favs' ? T('empty_favs') : isHist ? T('empty_hist') : (srvTab === 'internet' && running ? T('loading') : T('empty_list'));
  var lst = $('srvList'), st = lst.scrollTop;
  lst.innerHTML = html || '<div class="empty">' + esc(emptyMsg) + '</div>';
  lst.scrollTop = st;

  var on = 0, cnt = 0;
  for (var ip in SRV) if (SRV[ip].ok) { cnt++; on += SRV[ip].pl || 0; }
  $('srvFoot').innerHTML = esc(T('srv_count').replace('{n}', cnt).replace('{p}', on));
  $('favBtn').innerHTML = '\u2605 ' + esc(isFav(srvSel) ? T('from_favs') : T('to_favs'));
  if (isHist) renderHistStats();
  renderInfo();
}
function renderHistStats() {
  var today = new Date().toDateString(), tSec = 0, all = 0, cnt = {}, best = '', bestN = 0, todayN = 0;
  each(DB.hist, function (h) {
    all += h.d || 0;
    if (new Date(h.t).toDateString() === today) { tSec += h.d || 0; todayN++; }
    cnt[h.ip] = (cnt[h.ip] || 0) + 1;
    if (cnt[h.ip] > bestN) { bestN = cnt[h.ip]; best = h.ip; }
  });
  var bn = best ? (srv(best).name || best) : '-';
  var box = function (i, k, v) { return '<div class="hs" style="left:' + (i * 212) + 'px"><small>' + esc(T(k)) + '</small><b>' + esc(v) + '</b></div>'; };
  $('histStats').innerHTML = box(0, 'hs_today', fmtDur(tSec)) + box(1, 'hs_games', String(todayN)) + box(2, 'hs_most', bn) + box(3, 'hs_total', fmtDur(all));
}
var PLAYERS = {};
function loadPlayers(ip) {
  if (!window.nextclient || !nextclient.matchmaking || !nextclient.matchmaking.getPlayersInfo) return;
  try {
    nextclient.matchmaking.getPlayersInfo(ip).then(function (list) {
      list = list || [];
      list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      PLAYERS[ip] = list; if (ip === srvSel) renderInfo();
    }, function () { PLAYERS[ip] = []; if (ip === srvSel) renderInfo(); });
  } catch (e) {}
}
function renderInfo() {
  var box = $('srvInfo');
  if (!srvSel) { box.innerHTML = '<div class="empty">' + esc(T('empty_list')) + '</div>'; return; }
  var s = srv(srvSel), pl = PLAYERS[srvSel], ph = '';
  if (pl && pl.length) {
    each(pl.slice(0, 40), function (p) {
      ph += '<div class="pl">' + esc(clean(p.name) || '...') + '<span>' + (p.score || 0) + ' \u00b7 ' + fmtDur(p.timePlayedSeconds) + '</span></div>';
    });
  } else ph = '<div class="empty" style="padding:8px 0">' + esc(pl ? T('no_players') : T('loading')) + '</div>';
  var pc = s.ping < 50 ? 'gr' : s.ping < 100 ? 'ye' : 'rd';
  box.innerHTML = '<div class="mp"><span>' + esc(s.map || '?') + '</span></div>' +
    '<h3>' + esc(s.name || srvSel) + '</h3><div class="ip">' + esc(srvSel) + '</div>' +
    '<div class="ln">' + esc(T('ph_players')) + ' <b>' + (s.ok ? s.pl + '/' + s.max : '-') + '</b><span class="r ' + pc + '">' + (s.ok ? '\u25cf ' + s.ping + ' ms' : esc(T('offline'))) + '</span></div>' +
    '<div class="ph">' + esc(T('ph_players')) + '</div><div class="pls">' + ph + '</div>' +
    (isX(s) ? '<div class="note">' + esc(T('vip_note')) + '</div>' : '');
}
function toggleFav(ip) {
  if (!ip) return;
  var i = DB.fav.indexOf(ip);
  if (i >= 0) { DB.fav.splice(i, 1); toast(T('removed')); } else { DB.fav.unshift(ip); query(ip); toast(T('added')); }
  persist(); renderAll();
}

/* ------------------------------------------------------------ SOZLAMALAR */
var DEF = {
  name: '', tag: 'X | ', net: 'fast', dl: 1, spray: 1, mp3off: 0, hand: 1, fastsw: 1, buykeys: 0,
  sens: 2.5, zoom: 1.2, raw: 1, filter: 0, inv: 0,
  vol: 0.8, mus: 0.4, voice: 1, vscale: 1, mute: 1,
  fps: 100, gamma: 2.5, fov: 90, vmfov: 90, hor: 1, vsync: 0,
  xt: 0, xs: 'small', xc: '255 59 59', xtr: 0, xdyn: 0, netg: 0, oldfeed: 0, cid: 1, nover: 1
};
var S = null, E = null;   // S - saqlangan, E - tahrirlanayotgan nusxa
function copy(o) { return JSON.parse(JSON.stringify(o)); }
var CVARS = { sens: 'sensitivity', zoom: 'zoom_sensitivity_ratio', raw: 'm_rawinput', filter: 'm_filter', vol: 'volume', vscale: 'voice_scale', voice: 'voice_enable',
  fps: 'fps_max', gamma: 'gamma', fov: 'fov_angle', vmfov: 'viewmodel_fov', hor: 'fov_horplus', xt: 'cl_crosshair_type', xs: 'cl_crosshair_size',
  xc: 'cl_crosshair_color', xtr: 'cl_crosshair_translucent', xdyn: 'cl_dynamiccrosshair', hand: 'cl_righthand', fastsw: 'hud_fastswitch', dl: 'cl_allowdownload' };
function seedFromGame() {
  if (DB.set || !window.nextclient || typeof nextclient.getCvarValue !== 'function') return;
  try {
    for (var k in CVARS) {
      if (!CVARS.hasOwnProperty(k)) continue;
      var v = nextclient.getCvarValue(CVARS[k]);
      if (v == null || v === '') continue;
      if (typeof DEF[k] === 'number') { var n = parseFloat(v); if (!isNaN(n)) S[k] = Math.round(n * 100) / 100; } else S[k] = String(v);
    }
    var nm = nextclient.getCvarValue('name');
    if (nm) { S.name = String(nm).replace(/^(X \| |\[UZ\] )/, ''); S.tag = /^X \| /.test(nm) ? 'X | ' : /^\[UZ\] /.test(nm) ? '[UZ] ' : ''; }
  } catch (e) { dbg('getCvarValue xato ' + e); }
  renderBar();
}
function loadSettings() {
  S = copy(DEF);
  if (DB.set) for (var k in DB.set) if (DB.set.hasOwnProperty(k) && DEF.hasOwnProperty(k)) S[k] = DB.set[k];
}
var NETS = { slow: [25000, 60, 60], mid: [50000, 101, 101], fast: [100000, 101, 105] };
var BUY = [['F1', 'buy m4a1; buy ak47; buyammo1; buyammo1'], ['F2', 'buy awp; buyammo1; buyammo1'], ['F3', 'buy vesthelm; buy defuser'], ['F4', 'buy hegren; buy flash; buy flash; buy sgren']];
function q(v) { return '"' + String(v).replace(/"/g, '') + '"'; }
function settingsCmds(s) {
  var n = NETS[s.net] || NETS.fast, c = [];
  if (s.name) c.push('name ' + q(((s.tag || '') + s.name).slice(0, 31)));
  c.push('rate ' + n[0], 'cl_updaterate ' + n[1], 'cl_cmdrate ' + n[2]);
  c.push('cl_allowdownload ' + s.dl, 'cl_allowupload ' + s.spray, 'cl_righthand ' + s.hand, 'hud_fastswitch ' + s.fastsw);
  c.push('mp3volume ' + (s.mp3off ? 0 : s.mus));
  c.push('sensitivity ' + s.sens, 'zoom_sensitivity_ratio ' + s.zoom, 'm_rawinput ' + s.raw, 'm_filter ' + s.filter, 'm_pitch ' + (s.inv ? -0.022 : 0.022));
  c.push('volume ' + s.vol, 'voice_enable ' + s.voice, 'voice_scale ' + s.vscale, 'snd_mute_losefocus ' + s.mute);
  c.push('fps_max ' + s.fps, 'gamma ' + s.gamma, 'fov_angle ' + s.fov, 'viewmodel_fov ' + s.vmfov, 'fov_horplus ' + s.hor, 'gl_vsync ' + s.vsync);
  c.push('cl_crosshair_type ' + s.xt, 'cl_crosshair_size ' + s.xs, 'cl_crosshair_color ' + q(s.xc), 'cl_crosshair_translucent ' + s.xtr, 'cl_dynamiccrosshair ' + s.xdyn);
  c.push('net_graph ' + (s.netg ? 3 : 0), 'hud_deathnotice_old ' + s.oldfeed, 'hud_centerid ' + s.cid, 'scr_drawversion ' + (s.nover ? 0 : 1));
  if (s.buykeys) each(BUY, function (b) { c.push('bind ' + b[0] + ' ' + q(b[1])); });
  return c;
}
function applySettings(s) { each(settingsCmds(s), function (c) { cmd(c); }); }

var setTab = 'game';
function openSettings(tab) {
  E = copy(S);
  openModal('mdSettings');
  showSetTab(tab || setTab);
}
function showSetTab(tab) {
  setTab = tab;
  each(document.querySelectorAll('#setTabs a'), function (a) { a.className = a.getAttribute('data-tab') === tab ? 'on' : ''; });
  var f = PANES[tab] || PANES.game;
  $('setBody').innerHTML = f();
  if (tab === 'hud') drawXhair();
}
/* kichik konstruktorlar */
function tg(key, label, sub) {
  return '<div class="fr w"><div class="lb">' + esc(T(label)) + (sub ? '<small>' + esc(T(sub)) + '</small>' : '') + '</div>' +
    '<div class="tg' + (E[key] ? ' on' : '') + '" data-tg="' + key + '"><i></i></div></div>';
}
function sl(key, label, min, max, step, sub) {
  return '<div class="fr"><div class="lb">' + esc(T(label)) + (sub ? '<small>' + esc(T(sub)) + '</small>' : '') + '</div><div class="ct2"><div class="sl">' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + E[key] + '" data-sl="' + key + '"><div class="vv" id="vv_' + key + '">' + E[key] + '</div></div></div></div>';
}
function seg(key, label, opts) {
  var h = '';
  each(opts, function (o) { h += '<a class="' + (String(E[key]) === String(o[0]) ? 'on' : '') + '" data-seg="' + key + '" data-v="' + esc(o[0]) + '">' + esc(T(o[1])) + '</a>'; });
  return '<div class="fr"><div class="lb">' + esc(T(label)) + '</div><div class="ct2 seg">' + h + '</div></div>';
}
function rowb(title, sub, act, btn) {
  return '<div class="rowb"><b>' + esc(T(title)) + '</b><small>' + esc(T(sub)) + '</small><a class="btn" data-act="' + act + '">' + esc(T(btn)) + '</a></div>';
}
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
      '<div class="mut" style="margin-top:10px;font-size:12px">' + esc(T('g_net_note')) + '</div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('g_server')) + '</div>' +
      tg('dl', 'g_dl', 'g_dl2') + tg('spray', 'g_spray') + tg('mp3off', 'g_mp3', 'g_mp32') + tg('hand', 'g_hand') + tg('fastsw', 'g_fast') + '</div>';
  },
  keys: function () {
    var rows = '';
    each([['W / A / S / D', '+forward / +moveleft / +back / +moveright'], ['SPACE', '+jump'], ['CTRL', '+duck'], ['SHIFT', '+speed'], ['R', '+reload'], ['E', '+use'],
          ['B', 'buy'], ['M', 'chooseteam'], ['TAB', '+showscores'], ['Y / U', 'say / say_team'], ['G', 'drop'], ['K', '+voicerecord']], function (k) {
      rows += '<div class="kb">' + esc(k[1]) + '<span>' + esc(k[0]) + '</span></div>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('k_title')) + '</div>' + rows + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('s_keys')) + '</div><div class="mut" style="margin-bottom:12px">' + esc(T('k_note')) + '</div>' +
      '<a class="btn red" style="margin:0 0 20px" data-act="native:keyboard">' + esc(T('k_open')) + '</a>' +
      '<div class="ph2 m">' + esc(T('k_buy')) + '</div>' + tg('buykeys', 'k_buy2') +
      '<div class="mut" style="font-size:12px;line-height:20px">F1: M4A1/AK-47 \u00b7 F2: AWP \u00b7 F3: ' + 'Kevlar+Helmet, Defuse kit \u00b7 F4: HE + 2\u00d7Flash + Smoke</div></div>';
  },
  mouse: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('mo_title')) + '</div>' +
      sl('sens', 'mo_sens', 0.5, 10, 0.1) + sl('zoom', 'mo_zoom', 0.2, 3, 0.05) +
      '<a class="btn" style="margin:16px 0 0" data-act="native:mouse">' + esc(T('mo_open')) + '</a></div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('raw', 'mo_raw', 'mo_raw2') + tg('filter', 'mo_filter') + tg('inv', 'mo_inv') + '</div>';
  },
  sound: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('so_title')) + '</div>' +
      sl('vol', 'so_vol', 0, 1, 0.05) + sl('mus', 'so_mus', 0, 1, 0.05) + sl('vscale', 'so_vscale', 0, 2, 0.1) +
      '<a class="btn" style="margin:16px 0 0" data-act="native:audio">' + esc(T('so_open')) + '</a></div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('voice', 'so_voice') + tg('mute', 'so_mute') + '</div>';
  },
  video: function () {
    return '<div class="pane l"><div class="ph2">' + esc(T('v_title')) + '</div>' +
      seg('fps', 'v_fps', [[60, '60'], [100, '100'], [144, '144'], [200, '200'], [300, '300']]) +
      sl('gamma', 'v_bright', 1.8, 3, 0.1) + sl('fov', 'v_fov', 70, 100, 1, 'v_fov2') + sl('vmfov', 'v_vm', 70, 100, 1) +
      '<a class="btn" style="margin:16px 0 0" data-act="native:video">' + esc(T('v_open')) + '</a></div>' +
      '<div class="pane r"><div class="ph2">&nbsp;</div>' + tg('hor', 'v_hor') + tg('vsync', 'v_vsync') + '</div>';
  },
  hud: function () {
    var types = '';
    each([[0, 'x_cross'], [1, 'x_t'], [2, 'x_circle'], [3, 'x_dot']], function (o) {
      types += '<a class="' + (Number(E.xt) === o[0] ? 'on' : '') + '" data-seg="xt" data-v="' + o[0] + '">' + esc(T(o[1])) + '</a>';
    });
    var cols = '';
    each(['255 59 59', '80 250 80', '0 230 255', '255 210 60', '255 80 220', '255 255 255'], function (c) {
      var p = c.split(' ');
      cols += '<a class="' + (E.xc === c ? 'on' : '') + '" data-seg="xc" data-v="' + c + '" style="background:rgb(' + p.join(',') + ')"></a>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('x_title')) + '</div>' +
      '<div style="position:relative;height:176px"><div id="xPrev"><canvas id="xCan" width="240" height="160"></canvas></div><div class="xl">' + types + '</div></div>' +
      seg('xs', 'x_size', [['extra_small', 'sz_xs'], ['small', 'sz_s'], ['medium', 'sz_m'], ['large', 'sz_l'], ['auto', 'sz_auto']]) +
      '<div class="fr"><div class="lb">' + esc(T('x_color')) + '</div><div class="ct2 sw">' + cols + '</div></div>' +
      tg('xtr', 'x_trans') + tg('xdyn', 'x_dyn') + '</div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('h_title')) + '</div>' +
      tg('netg', 'h_net') + tg('oldfeed', 'h_old') + tg('cid', 'h_cid') + tg('nover', 'h_draw') + '</div>';
  },
  system: function () {
    var langs = '';
    each([['uz', 'UZ', "O'zbekcha", '#1eb53a'], ['ru', 'RU', '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', '#0039a6'], ['en', 'EN', 'English', '#012169']], function (o) {
      langs += '<a class="' + (CUR_LANG === o[0] ? 'on' : '') + '" data-lang="' + o[0] + '"><b style="background:' + o[3] + '">' + o[1] + '</b>' + esc(o[2]) + '</a>';
    });
    return '<div class="pane l"><div class="ph2">' + esc(T('sy_lang')) + '</div><div class="lng">' + langs + '</div>' +
      '<div class="mut" style="font-size:12px">' + esc(T('sy_lang_note')) + '</div>' +
      '<div class="ph2 m">' + esc(T('sy_up')) + '</div><div class="rowb"><b>' + esc(T('sy_ver')) + ' <span id="verTxt">' + esc(VERSION) + '</span></b><small>' + esc(T('sy_auto')) + '</small></div></div>' +
      '<div class="pane r"><div class="ph2">' + esc(T('sy_srv')) + '</div>' +
      rowb('sy_con', 'sy_con2', 'console', 'sy_open') + rowb('sy_native', 'sy_native2', 'native:multiplayer', 'sy_open') + rowb('sy_cl', 'sy_cl2', 'clearall', 'sy_clb') + '</div>';
  }
};
/* pritsel ko'rinishi */
function drawXhair() {
  var c = $('xCan'); if (!c || !c.getContext) return;
  var g = c.getContext('2d'), w = c.width, h = c.height, cx = Math.round(w / 2), cy = Math.round(h / 2);
  g.clearRect(0, 0, w, h);
  var p = String(E.xc).split(' ');
  g.fillStyle = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (E.xtr ? 0.6 : 1) + ')';
  var len = { extra_small: 4, small: 6, medium: 8, large: 11, auto: 7 }[E.xs] || 6, gap = 3, t = 2;
  var type = Number(E.xt);
  if (type === 3) { g.fillRect(cx - 2, cy - 2, 4, 4); return; }
  if (type === 2) { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, len + 2, 0, Math.PI * 2); g.stroke(); g.fillRect(cx - 1, cy - 1, 2, 2); return; }
  g.fillRect(cx - gap - len, cy - 1, len, t);        // chap
  g.fillRect(cx + gap, cy - 1, len, t);              // o'ng
  g.fillRect(cx - 1, cy + gap, t, len);              // past
  if (type !== 1) g.fillRect(cx - 1, cy - gap - len, t, len);   // tepa (T-shaklda yo'q)
}

/* ------------------------------------------------------------ oynalar */
var curModal = '';
function openModal(id) {
  closeModal();
  curModal = id; $(id).className = 'modal on';
  each(document.querySelectorAll('.mi'), function (m) { m.className = 'mi'; });
}
function closeModal() {
  if (!curModal) return;
  $(curModal).className = 'modal'; curModal = '';
}
var askCb = null;
function ask(title, cb) {
  askCb = cb; $('askT').innerHTML = esc(title); $('askI').value = '';
  $('mdAsk').className = 'modal on';
  setTimeout(function () { try { $('askI').focus(); } catch (e) {} }, 50);
}
function askDone(ok) {
  $('mdAsk').className = 'modal';
  var cb = askCb; askCb = null;
  if (ok && cb) cb($('askI').value);
}

/* ------------------------------------------------------------ hodisalar */
function act(a, el) {
  if (a === 'quick' || a === 'play') return quick();
  if (a === 'servers') return openServers('internet');
  if (a === 'favs') return openServers('favs');
  if (a === 'history') return openServers('history');
  if (a === 'settings') return openSettings();
  if (a === 'quit') return cmd('quit');
  if (a === 'close') return closeModal();
  if (a === 'refresh') { each(tabIps(), function (ip) { query(ip, true); }); if (srvSel) loadPlayers(srvSel); return; }
  if (a === 'join') return srvSel && connect(srvSel);
  if (a === 'togglefav') return toggleFav(srvSel);
  if (a === 'clearhist') { DB.hist = []; persist(); return renderAll(); }
  if (a === 'clearall') { DB.hist = []; DB.fav = []; persist(); toast(T('sy_ok')); return renderAll(); }
  if (a === 'addip') return ask(T('ask_ip'), function (v) { var ip = normIp(v); if (!ip) return toast(T('bad_ip')); if (!isFav(ip)) toggleFav(ip); srvSel = ip; renderServers(); });
  if (a === 'console') { closeModal(); return cmd('toggleconsole'); }
  if (a.indexOf('native:') === 0) {
    try { nextclient.gameUi.optionsDialog.open(a.slice(7)); } catch (e) { dbg('optionsDialog xato ' + e); }
    return;
  }
  if (a === 'defaults') { var keep = E.name; E = copy(DEF); E.name = keep; return showSetTab(setTab); }
  if (a === 'save') {
    var nm = $('fName'); if (nm) E.name = nm.value.replace(/["\\;]/g, '').slice(0, 28);
    S = copy(E); DB.set = S; persist(); applySettings(S); toast(T('saved')); closeModal(); renderBar();
  }
}
document.onclick = function (e) {
  var t = e.target || e.srcElement, el;
  if ((el = closest(t, 'data-fav'))) { toggleFav(el.getAttribute('data-fav')); return; }
  if ((el = closest(t, 'data-tg'))) { var k = el.getAttribute('data-tg'); E[k] = E[k] ? 0 : 1; el.className = 'tg' + (E[k] ? ' on' : ''); if (setTab === 'hud') drawXhair(); return; }
  if ((el = closest(t, 'data-seg'))) {
    var key = el.getAttribute('data-seg'), v = el.getAttribute('data-v');
    var nm = $('fName'); if (nm) E.name = nm.value;
    E[key] = (typeof DEF[key] === 'number') ? Number(v) : v;
    showSetTab(setTab); return;
  }
  if ((el = closest(t, 'data-lang'))) { DB.lang = el.getAttribute('data-lang'); persist(); setLang(DB.lang); showSetTab('system'); return; }
  if ((el = closest(t, 'data-tab'))) {
    if (curModal === 'mdServers') setSrvTab(el.getAttribute('data-tab')); else { var n2 = $('fName'); if (n2) E.name = n2.value; showSetTab(el.getAttribute('data-tab')); }
    return;
  }
  if ((el = closest(t, 'data-flt'))) { var f = el.getAttribute('data-flt'); FLT[f] = !FLT[f]; renderServers(); return; }
  if ((el = closest(t, 'data-sort'))) { var so = el.getAttribute('data-sort'); if (srvSort === so) srvDesc = !srvDesc; else { srvSort = so; srvDesc = so === 'pl'; } renderServers(); return; }
  if ((el = closest(t, 'data-act'))) { act(el.getAttribute('data-act'), el); return; }
  if ((el = closest(t, 'data-ip'))) {
    var ip = el.getAttribute('data-ip');
    if (el.className.indexOf('sr') === 0) { srvSel = ip; loadPlayers(ip); query(ip, true); renderServers(); }
    else connect(ip);                       // bosh ekrandagi TOP / oxirgi o'ynalgan
    return;
  }
  if (t && t.className === 'modal on' && t.id !== 'mdAsk') closeModal();   // fonga bosilsa yopiladi
};
document.ondblclick = function (e) {
  var el = closest(e.target || e.srcElement, 'data-ip');
  if (el && el.className.indexOf('sr') === 0) connect(el.getAttribute('data-ip'));
};
function onSlide(e) {
  var t = e.target || e.srcElement;
  if (!t || !t.getAttribute || !t.getAttribute('data-sl')) return;
  var k = t.getAttribute('data-sl'), v = Number(t.value);
  E[k] = Math.round(v * 100) / 100; $('vv_' + k).innerHTML = E[k];
}
document.addEventListener('change', onSlide, false);
document.addEventListener('input', onSlide, false);
document.onkeydown = function (e) {
  var k = e.keyCode;
  if ($('mdAsk').className === 'modal on') { if (k === 13) askDone(true); if (k === 27) askDone(false); return; }
  if (k === 27 && curModal) { closeModal(); return false; }
};
$('askYes').onclick = function () { askDone(true); };
$('askNo').onclick = function () { askDone(false); };
$('srvSearch').onkeyup = function () { renderServers(); };

/* ------------------------------------------------------------ boshlash */
var VERSION = '';
function readText(path, cb) {
  try {
    var x = new XMLHttpRequest();
    x.open('GET', path + '?t=' + now(), true);
    x.onreadystatechange = function () { if (x.readyState === 4 && x.responseText) cb(x.responseText); };
    x.send(null);
  } catch (e) {}
}
function detectLang() {
  if (DB.lang) { setLang(DB.lang); return; }
  var m = /[?&]lang=([a-z]+)/i.exec(location.search || '');
  setLang(m ? m[1] : 'uzbek');
  readText('../../user_game_config.ini', function (txt) {     // o'yin tili
    var r = /^\s*language\s+"?([a-z]+)"?/im.exec(txt);
    if (r && !DB.lang) setLang(r[1]);
  });
}
function renderAll() { renderHome(); renderServers(); }

load();
loadSettings();
fit();
window.onresize = fit;
detectLang();
VERSION = window.XC_VERSION || '';
if (VERSION) $('bVer').innerHTML = 'X CLIENT v' + esc(VERSION);
loadMaster();
loadTop();
each(PINNED.concat(DB.fav).concat(DB.hist.slice(0, 5).map(function (h) { return h.ip; })), function (ip) { query(ip); });
renderAll();

// O'yinchining hozirgi sozlamalarini o'qiymiz (agar klient getCvarValue ni bersa) — o'yinga faqat "Saqlash" bilan yoziladi
seedFromGame();

if (window.nextclient) {
  try { if (nextclient.gameUi && nextclient.gameUi.addEventListener) nextclient.gameUi.addEventListener('show', function () { each(TOP.concat(PINNED), function (ip) { query(ip); }); }); } catch (e) {}
  try {
    if (nextclient.addEventListener) {
      nextclient.addEventListener('connect', function (e) { onConnectEvt(e && e.detail && e.detail.address); });
      nextclient.addEventListener('disconnect', function () { onDisconnectEvt(); });
    }
    if (nextclient.connectedHost) onConnectEvt(nextclient.connectedHost);
  } catch (e) {}
} else dbg('nextclient API yo\'q');
setInterval(function () {
  each(TOP.slice(0, 6).concat(PINNED), function (ip) { query(ip); });
  if (curModal === 'mdServers') each(tabIps(), function (ip) { query(ip); });
}, 30000);
setInterval(loadTop, 10 * 60 * 1000);
})();
