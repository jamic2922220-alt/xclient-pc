/* Zaxira kill hisobi: konsol jim bo'lsa ham, sayt orqali olingan frag (TAB) o'sishi kill bo'lib statistikaga ketadi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 0, set: { name: 'testa', tag: '' } } });
  let score = 3; const stats = [];
  await p.route('**/srvq.php*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, name: 'S', map: 'de_dust2', pl: 2, max: 32, players: [{ name: 'Boshqa', score: 9, time: 100 }, { name: 'testa', score: score, time: 100 }] }) }));
  p.on('request', r => { const d = r.postData() || ''; if (r.url().includes('xc_api.php') && d.includes('a=stat')) stats.push(d); });
  await p.evaluate(() => { window.__off = 0; const gt = Date.prototype.getTime; Date.prototype.getTime = function () { return gt.call(this) + window.__off; }; });
  await p.evaluate(() => (window.L.putinserver || []).forEach(f => f({ detail: { address: '6.6.6.6:27015' } })));
  for (const sc of [3, 5, 9, 0, 2]) {           // 3 = asos, +2, +4, xarita almashdi (0), +2  => 8 kill
    score = sc; await p.evaluate(() => { window.__off += 90000; }); await p.waitForTimeout(16000);
  }
  await p.evaluate(() => { window.__off += 60000; (window.L.disconnect || []).forEach(f => f({})); });
  await p.waitForTimeout(3000);
  const last = stats.length ? decodeURIComponent(stats[stats.length - 1]) : '';
  const k = +((/(?:^|&)k=(\d+)/.exec(last) || [])[1] || -1), ks = +((/(?:^|&)ks=(\d+)/.exec(last) || [])[1] || -1);
  const ok = k === 8 && ks === 8 && !errs.length;
  console.log((ok ? 'PASS' : 'FAIL') + ' scorekills (k=' + k + ', ks=' + ks + ', stat so\'rovlar=' + stats.length + (errs.length ? ', xato=' + errs.join('|') : '') + ')');
  await b.close(); process.exit(ok ? 0 : 1);
})();
