/* BOOST-TOP: tuzatishlar qatlami (2026-11-28) - boshqa fayllarga tegmasdan, sahifa chizilgandan keyin ishlaydi.
 *  1) rasmi yo'q xarita (404): avval o'xshash nomli xarita rasmi (de_inferno_harnas_lite_winter -> de_inferno), bo'lmasa noimage
 *  2) (server nomlari o'zgartirilmaydi - egasi qanday yozgan bo'lsa shunday)
 *  3) ruscha son bilan so'z: "124 игроков" -> "124 игрока", "4 серв." -> "4 сервера"
 *  4) bo'sh "Свободное место" kataklari: bittasi "Serveringiz shu yerda" taklifiga aylanadi, qolganlari yashiriladi
 *  5) "Подключиться" (steam://) yoniga "X CLIENT orqali kirish" (mmb.boost-top.com/j.php - X CLIENT o'zi ochilib ulanadi)
 *  6) alt yo'q rasmlarga alt
 * O'chirish: main.tpl dagi bt-fix.css / bt-fix.js qatorlarini olib tashlash kifoya. */
(function () {
  'use strict';
  var NOIMG = 'media/maps/cs16/noimage.png';
  var XC_JOIN = 'https://mmb.boost-top.com/j.php?s=';
  function lang() {
    var l = '';
    try { l = localStorage.getItem('boost_lang') || localStorage.getItem('bt-lang') || ''; } catch (e) {}
    l = (l || document.documentElement.lang || 'ru').slice(0, 2).toLowerCase();
    return l === 'uz' || l === 'en' ? l : 'ru';
  }
  var TXT = {
    ru: { xc: 'Через X CLIENT', xcT: 'Подключиться через X CLIENT (откроется сам)', promoT: 'Здесь может быть ваш сервер', promoS: 'Место в ТОП — больше игроков каждый день', promoB: 'Занять место' },
    uz: { xc: 'X CLIENT orqali', xcT: "X CLIENT orqali kirish (o'zi ochiladi)", promoT: "Serveringiz shu yerda bo'lishi mumkin", promoS: "TOP dagi joy - har kuni ko'proq o'yinchi", promoB: 'Joyni olish' },
    en: { xc: 'Via X CLIENT', xcT: 'Join via X CLIENT (opens automatically)', promoT: 'Your server could be here', promoS: 'A TOP spot means more players every day', promoB: 'Get this spot' }
  };
  function tx(k) { return (TXT[lang()] || TXT.ru)[k]; }

  /* ---------- 1) xarita rasmi topilmasa ---------- */
  function mapCandidates(src) {
    var m = String(src).match(/^(.*\/media\/maps\/[^\/]+\/)([^\/?#]+?)\.(jpg|jpeg|png)/i);
    if (!m) return [];
    var base = m[1], name = m[2].toLowerCase(), out = [], seen = {};
    function add(n) { if (n && n !== name && !seen[n]) { seen[n] = 1; out.push(base + n + '.jpg'); } }
    var parts = name.split('_');
    for (var i = parts.length - 1; i >= 2; i--) add(parts.slice(0, i).join('_'));   /* de_inferno_harnas_lite_winter -> de_inferno_harnas_lite ... de_inferno */
    add(name.replace(/_(v\d+|final|fix|new|winter|snow|2x2|lite|beta|\d+)$/g, ''));
    /* nomida mashhur xarita bo'lsa (de_winterdust2 -> de_dust2) - saytda bor rasmlar */
    var KW = [['dust2', 'de_dust2'], ['dust', 'de_dust'], ['inferno', 'de_inferno'], ['nuke', 'de_nuke'], ['train', 'de_train'], ['aztec', 'de_aztec'], ['cbble', 'de_cbble'],
      ['italy', 'cs_italy'], ['office', 'cs_office'], ['assault', 'cs_assault'], ['militia', 'cs_militia'], ['snow', 'fy_snow']];
    for (var k = 0; k < KW.length; k++) if (name.indexOf(KW[k][0]) >= 0) { add(KW[k][1]); break; }
    return out;
  }
  window.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var src = img.getAttribute('src') || '';
    if (src.indexOf('/maps/') < 0 || src.indexOf('noimage') >= 0) return;
    if (!img.__btTry) img.__btTry = mapCandidates(img.src);
    var next = img.__btTry.shift();
    e.stopPropagation();                           /* o'zining onerror'i noimage qo'ymasin - avval o'xshash xaritani sinaymiz */
    img.src = next || NOIMG;
  }, true);

  /* hujjatga qo'shilmasdan oldin (innerHTML bilan yasalgan kartochkada) yiqilgan rasm yuqoridagi tinglovchiga yetmaydi -
   * noimage bo'lib qolgan xarita rasmlarini nomi (alt) bo'yicha qayta sinaymiz */
  function retryNoimg() {
    [].forEach.call(document.querySelectorAll('img[src*="noimage"]'), function (img) {
      if (img.__btScan) return; img.__btScan = 1;
      var nm = (img.getAttribute('alt') || '').trim();
      if (!/^[A-Za-z0-9_\-]{3,60}$/.test(nm)) return;
      var c = mapCandidates('/media/maps/cs16/' + nm + '.jpg');
      if (!c.length) return;
      img.__btTry = c;
      img.src = c.shift();
    });
  }

  /* ---------- 3): ruscha son + so'z ---------- */
  var FORMS = {
    'игрок': ['игрок', 'игрока', 'игроков'], 'сервер': ['сервер', 'сервера', 'серверов'], 'слот': ['слот', 'слота', 'слотов'],
    'голос': ['голос', 'голоса', 'голосов'], 'страна': ['страна', 'страны', 'стран'], 'круг': ['круг', 'круга', 'кругов'],
    'балл': ['балл', 'балла', 'баллов'], 'карта': ['карта', 'карты', 'карт']
  };
  var WORD2KEY = {};
  Object.keys(FORMS).forEach(function (k) { FORMS[k].forEach(function (w) { WORD2KEY[w] = k; }); });
  WORD2KEY['серв.'] = 'сервер';
  var PL = /(^|[^\d.,\/])(\d{1,7})((?:\s| )+)(игроков|игрока|игрок|серверов|сервера|сервер|серв\.|слотов|слота|слот|голосов|голоса|голос|стран|страны|страна|кругов|круга|круг|баллов|балла|балл|карт|карты|карта)(?![а-яё])/gi;
  function form(n, k) {
    var f = FORMS[k], a = n % 100, b = n % 10;
    if (a >= 11 && a <= 14) return f[2];
    if (b === 1) return f[0];
    if (b >= 2 && b <= 4) return f[1];
    return f[2];
  }
  function fixText(s) {
    var t = s;
    if (/[а-яё]/i.test(t) && /\d/.test(t)) t = t.replace(PL, function (m, pre, n, sp, w) {
      var k = WORD2KEY[w.toLowerCase()]; if (!k) return m;
      var r = form(parseInt(n, 10), k);
      if (w.charAt(0) !== w.charAt(0).toLowerCase()) r = r.charAt(0).toUpperCase() + r.slice(1);
      return pre + n + sp + r;
    });
    return t;
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  function walk(root) {
    if (!root || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return p && !SKIP[p.nodeName] && !(p.isContentEditable) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    var n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (node) { var v = node.nodeValue; if (!v || v.length > 600) return; var f = fixText(v); if (f !== v) node.nodeValue = f; });
  }
  function fixTitles(root) {
    [].forEach.call((root || document).querySelectorAll('[title]'), function (el) { var v = el.getAttribute('title'); var f = v && fixText(v); if (f && f !== v) el.setAttribute('title', f); });
  }

  /* ---------- 4) bo'sh TOP kataklari ---------- */
  function fixFreeSlots() {
    var boxes = [].slice.call(document.querySelectorAll('.tm-top-a .top-box'));
    if (!boxes.length) return;
    var free = boxes.filter(function (b) { return b.querySelector('.top-free-hostname'); });
    if (!free.length) return;
    var col = function (b) { return b.closest('[class*="uk-width"]') || b.parentElement; };
    free.forEach(function (b, i) {
      var c = col(b);
      if (i > 0) { c.style.display = 'none'; return; }
      c.classList.add('bt-fix-promo-col');
      if (b.querySelector('.bt-fix-promo')) return;
      var p = document.createElement('a');
      p.className = 'bt-fix-promo'; p.href = '/listing/';
      p.innerHTML = '<span class="bt-fix-promo-plus">+</span><b></b><small></small><em></em>';
      p.querySelector('b').textContent = tx('promoT'); p.querySelector('small').textContent = tx('promoS'); p.querySelector('em').textContent = tx('promoB') + ' →';
      b.classList.add('bt-fix-promo-box');
      b.appendChild(p);
    });
  }

  /* ---------- 5) X CLIENT orqali kirish ---------- */
  function addXc(root) {
    [].forEach.call((root || document).querySelectorAll('a[href^="steam://connect/"]'), function (a) {
      if (a.__btXc || (a.nextElementSibling && a.nextElementSibling.classList.contains('bt-xc'))) return;
      a.__btXc = 1;
      var ip = a.getAttribute('href').replace('steam://connect/', '').replace(/\/.*$/, '');
      if (!/^[A-Za-z0-9.\-]+:\d{2,5}$/.test(ip)) return;
      var x = document.createElement('a');
      var wide = a.offsetWidth > 110;
      x.className = 'bt-xc' + (wide ? ' bt-xc-wide' : '');
      x.href = XC_JOIN + encodeURIComponent(ip); x.target = '_blank'; x.rel = 'noopener';
      x.title = tx('xcT');
      x.innerHTML = '<img class="bt-xc-logo" src="https://mmb.boost-top.com/logo.png" alt="X CLIENT" width="18" height="18">' + '<span class="bt-xc-t"></span>';
      var inTable = !!a.closest('.boost-server-connect, td');
      if (inTable) { x.className += ' bt-xc-ico'; x.removeChild(x.querySelector('.bt-xc-t')); }   /* jadvalda - faqat belgi (joy kam) */
      else x.querySelector('.bt-xc-t').textContent = wide ? tx('xc') : 'X CLIENT';
      a.parentNode.insertBefore(x, a.nextSibling);
    });
  }

  /* ---------- 6) alt ---------- */
  function addAlt(root) {
    [].forEach.call((root || document).querySelectorAll('img:not([alt])'), function (img) {
      var s = img.getAttribute('src') || '', m = s.match(/\/maps\/[^\/]+\/([^\/?#]+)\.\w+/), f = s.match(/\/flags\/(\w+)\./);
      img.setAttribute('alt', m ? m[1] : f ? f[1].toUpperCase() : (img.getAttribute('title') || ''));
    });
  }

  var busy = false, pending = false;
  function run() {
    if (busy) { pending = true; return; }
    busy = true;
    try { retryNoimg(); walk(document.body); fixTitles(document); fixFreeSlots(); addXc(document); addAlt(document); } catch (e) {}
    busy = false;
    if (pending) { pending = false; setTimeout(run, 300); }
  }
  var t = null;
  function later() { if (t) return; t = setTimeout(function () { t = null; run(); }, 400); }
  function start() {
    run();
    [800, 2000, 4500].forEach(function (d) { setTimeout(run, d); });
    try {
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var n = ms[i].target; if (n && n.nodeType === 3) n = n.parentNode;
          if (n && n.closest && n.closest('.bt-xc, .bt-clock, .bt-globe, .bt-globe-label, .boost-ticker-track')) continue;   /* soat va globus har soniyada o'zgaradi */
          later(); return;
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
