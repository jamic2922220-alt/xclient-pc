/* cssborka.uz bosh sahifasi: tepada X CLIENT va Android bannerlari, keyin sborkalar, ruletka pastda.
 * bottom.php dagi </body> dan oldin ulanadi:  <script src="/xclient/home-banner.js?v=1"></script>
 * Faqat bosh sahifada ishlaydi (#roulette va #android bo'lgan sahifa), boshqa sahifalarga tegmaydi. */
(function () {
  var roulette = document.getElementById('roulette');
  var android = document.getElementById('android');
  var hero = document.querySelector('section.hero');
  if (!roulette || !android || !hero || document.getElementById('xclient')) return;

  var uz = /^\/uz(\/|$)/.test(location.pathname);
  var T = uz ? {
    tag: 'YANGI · BEPUL', t1: 'X CLIENT', t2: 'CS 1.6 uchun yangi launcher',
    d: "Zamonaviy menyu, pro sozlamalar, do'stlar, kunlik vazifalar va avtomatik yangilanish — hammasi bitta launcherda.",
    p: ['🔄 Avto-yangilanish', '⚡ PRO CFG', '🎯 Pritsel va HUD', '👥 Do\'stlar'], b: 'Bepul yuklab olish', m: 'Batafsil →'
  } : {
    tag: 'НОВИНКА · БЕСПЛАТНО', t1: 'X CLIENT', t2: 'новый лаунчер для CS 1.6',
    d: 'Современное меню, про-настройки, друзья, ежедневные задания и автообновление — всё в одном лаунчере.',
    p: ['🔄 Автообновление', '⚡ PRO CFG', '🎯 Прицел и HUD', '👥 Друзья'], b: 'Скачать бесплатно', m: 'Подробнее →'
  };

  var css = document.createElement('style');
  css.textContent =
    '.xc-section{padding-top:22px;padding-bottom:10px}' +
    '.xc-card{position:relative;display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:26px;overflow:hidden;padding:28px 30px;border-radius:28px;text-decoration:none!important;color:#f3eef0!important;' +
    'background:radial-gradient(520px 320px at 85% 40%,rgba(255,40,40,.24),transparent 60%),radial-gradient(420px 260px at 0% 0%,rgba(255,106,0,.14),transparent 60%),linear-gradient(135deg,#160c10,#0b0a10);' +
    'border:1px solid rgba(255,59,59,.38);box-shadow:0 24px 60px rgba(0,0,0,.35);transition:transform .25s,box-shadow .25s,border-color .25s}' +
    '.xc-card:hover{transform:translateY(-4px);border-color:#ff3b3b;box-shadow:0 30px 70px rgba(0,0,0,.4),0 0 40px rgba(255,59,59,.2)}' +
    '.xc-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,#ff3b3b,#ff9a39)}' +
    '.xc-tag{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:900;letter-spacing:.6px;color:#ff5a5a;background:rgba(255,59,59,.12);border:1px solid rgba(255,59,59,.38)}' +
    '.xc-tag i{width:8px;height:8px;border-radius:50%;background:#ff3b3b;animation:xcPulse 1.8s infinite}' +
    '@keyframes xcPulse{0%{box-shadow:0 0 0 0 rgba(255,59,59,.7)}70%{box-shadow:0 0 0 10px rgba(255,59,59,0)}100%{box-shadow:0 0 0 0 rgba(255,59,59,0)}}' +
    '.xc-head{display:flex;align-items:center;gap:14px;margin:14px 0 6px}' +
    '.xc-head img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 8px 18px rgba(255,40,40,.45))}' +
    '.xc-title{margin:0;font-size:clamp(26px,3.4vw,42px);line-height:1.08;font-weight:900;color:#fff}' +
    '.xc-title b{color:#ff3b3b}' +
    '.xc-title span{display:block;margin-top:4px;font-size:.55em;color:#ffc9b0;font-weight:800}' +
    '.xc-desc{margin:12px 0 14px;color:#cfc4ca;font-size:16px;max-width:560px}' +
    '.xc-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}' +
    '.xc-pills span{font-size:13px;font-weight:700;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#efe6ea}' +
    '.xc-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px}' +
    '.xc-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:14px;font-weight:900;font-size:17px;color:#fff;background:linear-gradient(180deg,#ff4a4a,#c4262e);box-shadow:0 12px 28px rgba(255,40,40,.35),inset 0 -3px 0 rgba(0,0,0,.18)}' +
    '.xc-btn svg{width:20px;height:20px;fill:currentColor}' +
    '.xc-more{font-weight:800;color:#ff9a39}' +
    '.xc-img{position:relative;display:flex;align-items:center;justify-content:center}' +
    '.xc-img img{width:100%;max-width:520px;height:auto;border-radius:16px;transform:rotate(1.5deg);box-shadow:0 24px 50px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);transition:transform .3s}' +
    '.xc-card:hover .xc-img img{transform:rotate(0) scale(1.02)}' +
    '@media(max-width:820px){.xc-card{grid-template-columns:1fr;padding:22px 18px;gap:16px}.xc-img{order:-1}.xc-desc{font-size:15px}.xc-btn{width:100%;justify-content:center}.xc-head img{width:52px;height:52px}}';
  document.head.appendChild(css);

  var sec = document.createElement('section');
  sec.className = 'section xc-section';
  sec.id = 'xclient';
  sec.innerHTML =
    '<div class="site-shell"><a class="xc-card" href="/xclient/index.html">' +
      '<div class="xc-text">' +
        '<span class="xc-tag"><i></i>' + T.tag + '</span>' +
        '<div class="xc-head"><img src="/xclient/spray_logo.png" alt="" width="64" height="64">' +
          '<h2 class="xc-title"><b>X</b> CLIENT<span>' + T.t2 + '</span></h2></div>' +
        '<p class="xc-desc">' + T.d + '</p>' +
        '<div class="xc-pills"><span>' + T.p.join('</span><span>') + '</span></div>' +
        '<div class="xc-actions"><span class="xc-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3Zm-7 15h16v2H4v-2Z"/></svg>' + T.b + '</span>' +
        '<span class="xc-more">' + T.m + '</span></div>' +
      '</div>' +
      '<div class="xc-img"><img src="/xclient/img/m/home.jpg" width="1200" height="675" alt="X CLIENT — CS 1.6" loading="lazy" decoding="async"></div>' +
    '</a></div>';

  /* Tartib: X CLIENT, Android, sborkalar ..., ruletka (FAQ dan oldin) */
  var parent = hero.parentNode;
  parent.insertBefore(sec, hero);
  parent.insertBefore(android, hero);
  var faq = document.getElementById('faq');
  var cta = document.querySelector('section.site-shell > .cta');
  if (cta) cta.parentNode.style.display = 'none';   // "Tasodifiy tanlash" chaqiruvi endi kerak emas - ruletka shu yerda
  if (faq && faq.parentNode === parent) parent.insertBefore(roulette, faq);
  else parent.appendChild(roulette);
  /* ruletka joyi o'zgardi - kartalarni markazga qaytaramiz */
  try { window.dispatchEvent(new Event('resize')); } catch (e) {}
})();
