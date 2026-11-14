/* Eski "menyu tezligi" o'lchovi (admin > Tezlik) hali ishlaydi: 120 s dan keyin a=perf&v=... yuboriladi (yangi o'yin pingi - a=gperf).
 * F11 ro'yxati "galereyaga yuklash" belgisini (shots) buzmaydi */
const { chromium } = require('playwright');
const { BASE } = require('./lib');
(async () => {
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m), errs = [];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  const sent = [];
  await p.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(BASE)) return r.abort(); const d = r.request().postData() || ''; if (/^a=g?perf&/.test(d)) sent.push(d.replace(/&device=[^&]*/, '')); return r.continue(); });
  await p.addInitScript(() => { localStorage.setItem('xclient', JSON.stringify({ wnSeen: 'x', lang: 'uz', dnd: 1, tour: 1 }));
    window.nextclient = { exec() {}, getCvarValue() { return null; }, matchmaking: { getServerInfo() { return Promise.resolve(null); }, getPlayersInfo() { return Promise.resolve([]); } }, addEventListener() {}, gameUi: { shown: true, addEventListener() {} } }; });
  await p.goto(BASE + '/xc.html');
  await p.clock.runFor(5000); await p.clock.runFor(125000); await p.waitForTimeout(1500);
  const old = sent.find(x => /^a=perf&/.test(x));
  ok(old && /v=\d+/.test(old) && /load=\d+/.test(old), 'menyu tezligi o\'lchovi yuborildi (' + (old || 'yo\'q').slice(0, 80) + ')');
  ok(!sent.some(x => /^a=perf&.*(pm=|ip=)/.test(x)), 'o\'yin pingi eski "perf" ga aralashmaydi');
  await b.close();
  const fails = res.filter(r => r.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' perfold (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  process.exit(fails.length || errs.length ? 1 : 0);
})();
