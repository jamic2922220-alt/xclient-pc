/* Shaxsiy murabbiy, chit shikoyati (⚑ - o'yin paytida), Yangi yil iventi (vazifalar), daraja tabrigi */
const { page } = require('./lib');
(async () => {
  const t0 = Date.now(), G = (k, x, h, map, w) => ({ ip: '6.6.6.6:27015', name: 'S', map: map, t: t0 - 3600e3, d: 900, k: k, x: x, h: h, w: w, wh: { ak47: Math.round(h * .8), deagle: 0 } });
  const hist = [G(20, 10, 3, 'de_dust2', { ak47: 14, deagle: 6 }), G(18, 12, 2, 'de_dust2', { ak47: 12, deagle: 6 }), G(8, 15, 1, 'de_nuke', { ak47: 5, deagle: 3 }),
    G(6, 14, 1, 'de_nuke', { ak47: 4, deagle: 2 }), G(5, 12, 0, 'de_nuke', { ak47: 3, deagle: 2 }), G(22, 9, 4, 'de_inferno', { ak47: 16, deagle: 6 })];
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 0, lang: 'uz', dnd: 1, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3, hist: hist, fav: ['6.6.6.6:27015'], set: { name: 'testa', tag: '' } }, wait: 2500 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  const clk = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  /* murabbiy */
  await clk('[data-act=stats]'); await p.waitForTimeout(800);
  const cc = await p.evaluate(() => { const c = document.querySelector('.coach'); return c ? c.textContent : ''; });
  ok(/SHAXSIY MURABBIY/.test(cc) && /Headshot/.test(cc) && /de_nuke/.test(cc), 'murabbiy: headshot va eng zaif xarita (de_nuke)');
  await clk('.coach [data-act=coach_nade]'); await p.waitForTimeout(400);
  ok(/Granata mashqi/.test(await p.evaluate(() => document.getElementById('sideBody').textContent)) && await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).bots.map) === 'de_nuke', 'murabbiy tugmasi: granata mashqi de_nuke da ochildi');
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  /* Yangi yil iventi (sayt javobi soxta - sana dekabr) */
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=missions&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, day: '2026-12-20', list: [{ id: 'kills', goal: 20, xp: 105 }], prog: { kills: 25 }, done: [], ny: { y: 2027, end: 1799611199, goal: 5, n: 4, has: false, now: 1797000000 } }) });
    if (/^a=mission_claim&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, xp: 900, level: 2, lvlxp: 0, got: 105, ny: { n: 5, goal: 5, got: true } }) });
    return r.continue(); });
  await clk('[data-act=missions]'); await p.waitForTimeout(800);
  const ny = await p.evaluate(() => (document.querySelector('.nyev') || {}).textContent || '');
  ok(/YANGI YIL 2027/.test(ny) && /4 \/ 5/.test(ny) && /x1\.5/.test(ny), 'Yangi yil kartasi: 4/5, XP x1.5 (' + ny.replace(/\s+/g, ' ').slice(0, 80) + ')');
  await clk('[data-misclaim]'); await p.waitForTimeout(2500);
  ok(/sizda/.test(await p.evaluate(() => (document.querySelector('.nyev') || {}).textContent || '')), '5-vazifadan keyin ramka olindi');
  await p.screenshot({ path: '/tmp/claude-0/-home-user/c174bc30-11c3-5deb-b9e4-d277fe0ca5fd/scratchpad/ny.png' });
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  /* chit shikoyati: serverga ulangan, o'yinchilar ro'yxatida ⚑ */
  await p.route('**/srvq.php*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, name: 'S', map: 'de_dust2', pl: 3, max: 32, players: [{ name: 'Hacker', score: 40, time: 600 }, { name: 'testa', score: 3, time: 600 }] }) }));
  await p.evaluate(() => (window.L.putinserver || []).forEach(f => f({ detail: { address: '6.6.6.6:27015' } })));
  await p.evaluate(() => { (window.L.ui_show || []).forEach(f => f()); });
  await clk('#menu [data-act="servers"]'); await p.waitForTimeout(300); await clk('#mdServers [data-tab="favs"]'); await p.waitForTimeout(800);
  await clk('#mdServers [data-ip="6.6.6.6:27015"]'); await p.waitForTimeout(2500);
  const flags = await p.evaluate(() => Array.from(document.querySelectorAll('[data-cheat]')).map(e => e.getAttribute('data-cheat')));
  ok(flags.length === 1 && flags[0] === 'Hacker', 'o\'yinchilar ro\'yxatida ⚑ faqat boshqalarda (' + flags.join(',') + ')');
  const sent = []; p.on('request', r => { const d = r.postData() || ''; if (/a=cheat_rep/.test(d)) sent.push(decodeURIComponent(d)); });
  await clk('[data-cheat="Hacker"]'); await p.waitForTimeout(300); await p.evaluate(() => { window.LOG.length = 0; }); await clk('[data-chwhy="wh"]'); await p.waitForTimeout(800);
  ok(sent.length === 1 && /nick=Hacker/.test(sent[0]) && /why=wh/.test(sent[0]), 'shikoyat yuborildi (Hacker, wallhack)');
  ok((await p.evaluate(() => window.LOG)).some(x => /^record xc_/.test(x)), 'dalil uchun demo yozuvi boshlandi');
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' feat2 (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
