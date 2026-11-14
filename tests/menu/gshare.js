/* Ulashish sahifasi (g.php): Telegram'da havola karta rasmi + sarlavha + cssborka.uz/xclient bilan chiqadi, sahifada yuklab olish tugmasi */
const fs = require('fs'), path = require('path');
const { BASE } = require('./lib');
(async () => {
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  const W = path.dirname(process.env.XC_SHOTS || '/tmp/x/shots');
  fs.mkdirSync(W + '/xc_data/gs', { recursive: true });
  fs.writeFileSync(W + '/xc_data/gs/abcdef123456.php', "<?php exit; ?>\n" + JSON.stringify({ login: 'testa', name: 'Aziz', k: 23, d: 11, t: 1500, h: 9, bs: 5, a: 2, fav: 'ak47', srv: 'UZB ARENA', map: 'de_dust2', ts: 1 }));
  const r = await fetch(BASE + '/g.php?g=abcdef123456'); const h = await r.text();
  ok(r.status === 200, 'g.php ochiladi');
  ok(/og:image" content="[^"]*gcard\.php\?g=abcdef123456/.test(h), 'Telegram ko\'rinishi: karta rasmi (og:image)');
  ok(/og:title" content="Aziz: 23 kill · K\/D 2\.09/.test(h), 'sarlavha: nik, kill, K/D');
  ok(/og:description" content="[^"]*cssborka\.uz\/xclient/.test(h) && /href="https:\/\/cssborka\.uz\/xclient"/.test(h), 'cssborka.uz/xclient: tavsifda va yuklab olish tugmasida');
  ok(/class="code">testa</.test(h), 'taklif kodi (ulashgan o\'yinchi)');
  ok((await fetch(BASE + '/g.php?g=zzz')).status === 404, 'noto\'g\'ri havola - 404');
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length ? 'FAIL' : 'PASS') + ' gshare (' + (res.length - fails.length) + '/' + res.length + ')');
  process.exit(fails.length ? 1 : 0);
})();
