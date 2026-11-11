/* O'yinchilar fikri: "Lag" javobi -> bir bosishda tuzatish; "Botlar bilan mashq" -> oflayn server buyruqlari */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, set: { fps: 60, vsync: 1, dyn: 1, aimnet: 0 } } });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  ok(await p.$('#menu [data-act="bots"]'), 'chap menyuda "Botlar bilan mashq"');
  await p.click('#menu [data-act="bots"]'); await p.waitForTimeout(500);
  await p.click('[data-bmap="de_nuke"]'); await p.click('[data-bn="13"]'); await p.click('[data-bd="0"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="botgo"]'); await p.waitForTimeout(400);
  const L = await p.evaluate(() => window.LOG);
  const iq = L.indexOf('bot_quota 13'), im = L.indexOf('map de_nuke');
  ok(L.includes('maxplayers 14') && L.includes('bot_difficulty 0') && iq >= 0 && im > iq, 'Boshlash: maxplayers 14, bot_quota 13, oson, keyin map de_nuke');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).bots.map === 'de_nuke'), 'tanlov eslab qolinadi');
  await p.evaluate(() => { window.LOG = []; }); await p.waitForTimeout(5600);
  const L3 = await p.evaluate(() => window.LOG);
  ok(L3.includes('bot_quota 13') && L3.includes('bot_join_after_player 0'), 'xarita yuklangach bot soni qayta yuboriladi (server.cfg 0 qilsa ham)');
  // "Lag / qotdi" javobi
  await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-fq', 'lag'); document.body.appendChild(e); e.click(); e.remove(); }); await p.waitForTimeout(500);
  ok(await p.$('#mdSide.on [data-act="lagfix"]'), '"Lag" javobidan keyin "Bir bosishda tuzatish" oynasi');
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="lagfix"]'); await p.waitForTimeout(500);
  const L2 = await p.evaluate(() => window.LOG.join('\n'));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).set);
  ok(st.aimnet === 1 && st.vsync === 0 && st.dyn === 0 && st.fps >= 100, 'sozlamalar: aniq tegish yoqildi, vsync/dinamik yorug\'lik o\'chdi, fps 100+ (' + JSON.stringify({ a: st.aimnet, v: st.vsync, d: st.dyn, f: st.fps }) + ')');
  ok(/gl_vsync 0/.test(L2) && /fps_max 1\d\d/.test(L2), 'o\'yinga darhol yuborildi (gl_vsync 0, fps_max)');
  const fails = res.filter(r => r.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' fbfix (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
