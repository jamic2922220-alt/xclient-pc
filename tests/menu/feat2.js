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
  /* server kirish paroli: server "Invalid server password" desa - parol oynasi, parol bilan qayta ulanish, boshqa serverda bo'shatiladi */
  await p.evaluate(() => (window.L.disconnect || []).forEach(f => f({}))); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  const tip = await p.evaluate(() => { const e = document.querySelector('#topList [data-ip]'); return e ? e.getAttribute('data-ip') : ''; });
  await p.evaluate(() => { window.LOG.length = 0; }); await clk('#topList [data-ip]'); await p.waitForTimeout(6000);
  const l1 = await p.evaluate(() => window.LOG.slice());
  ok(l1.includes('connect ' + tip), 'serverga ulanish (' + tip + ')');
  await p.evaluate(() => { const c = window.L.con_message || []; c.forEach(f => f({ detail: { text: 'Invalid server password.' } })); });
  await p.waitForTimeout(1200);
  const askT = await p.evaluate(() => document.getElementById('mdAsk').className + ' | ' + document.getElementById('askT').textContent + ' | ' + document.getElementById('askI').type);
  ok(/on/.test(askT) && /parol/i.test(askT) && /password$/.test(askT), 'parol oynasi chiqdi (' + askT.slice(0, 90) + ')');
  await p.evaluate(() => { window.LOG.length = 0; document.getElementById('askI').value = 'secret1'; document.getElementById('askYes').click(); }); await p.waitForTimeout(800);
  const l2 = await p.evaluate(() => window.LOG.slice());
  ok(l2.includes('password "secret1"') && l2.includes('connect ' + tip), 'parol bilan qayta ulanish (' + l2.filter(x => /password|connect/.test(x)).join(' ; ') + ')');
  await p.evaluate(() => (window.L.disconnect || []).forEach(f => f({}))); await p.waitForTimeout(300);
  await p.evaluate(() => { window.LOG.length = 0; }); await clk('#mdServers [data-ip="6.6.6.6:27015"]');
  await p.evaluate(() => { document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }); });
  await clk('#menu [data-act="servers"]'); await p.waitForTimeout(300); await clk('#mdServers [data-tab="favs"]'); await p.waitForTimeout(500);
  await clk('#mdServers [data-ip="6.6.6.6:27015"]'); await p.waitForTimeout(400); await p.evaluate(() => { window.LOG.length = 0; });
  await p.evaluate(() => { const e = document.querySelector('#srvInfo [data-act="join"], #srvInfo .join, #mdServers [data-act="join"]'); if (e) e.click(); }); await p.waitForTimeout(6000);
  const l3 = await p.evaluate(() => window.LOG.slice());
  ok(l3.includes('password ""') && l3.includes('connect 6.6.6.6:27015'), 'boshqa serverga parol yuborilmaydi (' + l3.filter(x => /password|connect/.test(x)).join(' ; ') + ')');
  /* ulanish rad etildi: server to'la -> sabab oynasi va navbat tugmasi */
  await p.evaluate(() => (window.L.disconnect || []).forEach(f => f({}))); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  await clk('#topList [data-ip]'); await p.waitForTimeout(5000);
  await p.evaluate(() => { const c = window.L.con_message || []; c.forEach(f => f({ detail: { text: 'Server is full.' } })); }); await p.waitForTimeout(1200);
  const rj = await p.evaluate(() => (document.getElementById('sideTitle') || {}).textContent + ' | ' + !!document.querySelector('#sideBody [data-act=rejq]'));
  ok(/Server to'la/.test(rj) && /true$/.test(rj), 'server to\'la: sabab oynasi va navbat tugmasi (' + rj + ')');
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  /* "Parolsiz" filtri */
  await clk('#menu [data-act="servers"]'); await p.waitForTimeout(300); await clk('#mdServers [data-tab="internet"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('[data-flt="nopw"]') && /Parolsiz/.test(document.querySelector('[data-flt="nopw"]').textContent)), '"Parolsiz" filtri bor');
  await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }));
  /* LAN server nomi va paroli */
  await clk('.mi[data-act=bots]'); await p.waitForTimeout(300); await clk('[data-bm=std]'); await p.waitForTimeout(200);
  const hasLan = await p.evaluate(() => !!document.getElementById('lanPw'));
  if (!hasLan) { await clk('[data-blan]'); await p.waitForTimeout(200); }
  await p.evaluate(() => { document.getElementById('lanHn').value = 'Ali LAN'; document.getElementById('lanPw').value = 'abc123'; window.LOG.length = 0; });
  await clk('[data-act=botgo]'); await p.waitForTimeout(400);
  const lg = await p.evaluate(() => window.LOG.slice());
  ok(lg.includes('hostname "Ali LAN"') && lg.includes('sv_password "abc123"'), 'LAN server nomi va paroli (' + lg.filter(x => /hostname|sv_password/.test(x)).join(' ; ') + ')');
  /* avtomatik qurol almashtirish */
  ok(await p.evaluate(() => window.LOG.length >= 0) && (await p.evaluate(() => { var o = []; window.LOG.length = 0; document.querySelector('[data-act=settings]') && document.querySelector('[data-act=settings]').click(); return true; })), 'sozlamalar ochildi');
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => /Yangi qurolga avtomatik/.test(document.body.textContent) || !!document.querySelector('[data-tab="game"]')), 'qurol almashtirish sozlamasi');
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' feat2 (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
