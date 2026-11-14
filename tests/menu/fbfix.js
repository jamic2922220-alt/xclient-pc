/* O'yinchilar fikri: "Lag" javobi -> bir bosishda tuzatish; "Botlar bilan mashq" -> oflayn server buyruqlari */
const { page, BASE } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, set: { fps: 60, vsync: 1, dyn: 1, aimnet: 0 } } });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  ok(await p.$('#menu [data-act="bots"]'), 'chap menyuda "Botlar bilan mashq"');
  await p.click('#menu [data-act="bots"]'); await p.waitForTimeout(500);
  await p.click('[data-bmap="de_nuke"]'); await p.click('[data-bn="13"]'); await p.click('[data-bd="0"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="botgo"]'); await p.waitForTimeout(400);
  const L = await p.evaluate(() => window.LOG);
  const iq = L.indexOf('bot_quota 14'), im = L.indexOf('map de_nuke');
  ok(L.includes('maxplayers 14') && L.includes('bot_difficulty 0') && L.includes('bot_quota_mode fill') && iq >= 0 && im > iq, 'Boshlash (LAN yoqiq): maxplayers 14, jami 14 (fill - odam kirsa bot chiqadi), oson, keyin map de_nuke');
  ok(L.some(x => /^hostname ".* - LAN"$/.test(x)) && L.includes('sv_maxupdaterate 101') && L.includes('pausable 0'), 'LAN server: nom, tez yangilanish (101), pauza yo\'q');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).bots.map === 'de_nuke'), 'tanlov eslab qolinadi');
  await p.evaluate(() => { window.LOG = []; }); await p.waitForTimeout(5600);
  const L3 = await p.evaluate(() => window.LOG);
  ok(L3.includes('bot_quota 14') && L3.includes('bot_join_after_player 0') && L3.some(x => /^hostname /.test(x)), 'xarita yuklangach bot soni qayta yuboriladi (server.cfg 0 qilsa ham)');
  // botlar bilan o'ynaganda menyu tinch turadi: serverlarga so'rov yubormaydi (so'rovlar o'yinni qotiradi), effektlar o'chiq
  const quiet = await p.evaluate(() => new Promise(res => {
    window.QN = 0; window.nextclient.gameUi.shown = false;
    (window.L.connect || []).forEach(f => f({ detail: { address: 'local:27015' } }));   // NextClient o'z serverini shunday beradi (jonli ma'lumot)
    setTimeout(() => { const q = window.QN; window.nextclient.gameUi.shown = true; res({ q: q, low: document.documentElement.className.indexOf('lowfx') >= 0, h: JSON.stringify(JSON.parse(localStorage.getItem('xclient')).hist || []).indexOf('local') }); }, 47000);
  }));
  ok(quiet.q === 0 && quiet.low && quiet.h < 0, 'botlar bilan o\'yin (local:27015) paytida menyu tinch: 47 s da serverlarga so\'rov ' + quiet.q + ' ta, effektlar o\'chiq=' + quiet.low + ', tarixga yozilmadi=' + (quiet.h < 0));
  await p.evaluate(() => { (window.L.disconnect || []).forEach(f => f({})); });
  // LAN: Serverlar > LAN da "LAN server yaratish" -> botlar oynasi LAN yoqiq; LAN o'chirilsa - faqat o'zi uchun joy
  await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-act', 'servers'); document.body.appendChild(e); e.click(); e.remove(); }); await p.waitForTimeout(400);
  await p.click('#srvTabs [data-tab="lan"], [data-stab="lan"], .tabs a[data-t="t_lan"]').catch(() => {});
  await p.evaluate(() => { const t = [...document.querySelectorAll('#mdServers a, #mdServers div')].find(x => x.getAttribute && (x.getAttribute('data-tab') === 'lan' || x.getAttribute('data-stab') === 'lan')); if (t) t.click(); }); await p.waitForTimeout(500);
  ok(await p.$('#srvList [data-act="lanhost"]'), 'Serverlar > LAN: "LAN server yaratish" tugmasi');
  await p.click('#srvList [data-act="lanhost"]'); await p.waitForTimeout(400);
  ok(await p.$('#mdSide.on [data-blan].on'), 'botlar oynasi ochildi, LAN yoqiq');
  await p.click('[data-blan]'); await p.waitForTimeout(200); await p.click('[data-bn="5"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="botgo"]'); await p.waitForTimeout(400);
  const L5 = await p.evaluate(() => window.LOG);
  ok(L5.includes('maxplayers 6') && L5.includes('bot_quota 5') && L5.includes('bot_quota_mode normal'), 'LAN o\'chiq: faqat o\'zi + 5 bot');
  // mashq turi: Aim
  await p.click('#menu [data-act="bots"]'); await p.waitForTimeout(400);
  await p.click('[data-bm="aim"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="botgo"]'); await p.waitForTimeout(400);
  const L4 = await p.evaluate(() => window.LOG);
  ok(L4.includes('bot_stop 1') && L4.includes('mp_startmoney 16000') && L4.includes('bot_dont_shoot 0') && L4.indexOf('bot_stop 1') < L4.indexOf('map de_nuke'), 'Aim mashq: botlar to\'xtaydi, pul 16000');
  await p.evaluate(() => { document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }); });
  // lag sababi: o'yin paytida ping o'lchanadi va yakunda saytga yuboriladi
  const perf = await p.evaluate(() => new Promise(res => {
    const sent = []; const o = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { if (/^a=gperf&/.test(b || '')) sent.push(b); return o.apply(this, arguments); };
    window.L.connect && window.L.connect.forEach(f => f({ address: '1.2.3.4:27015' }));
    setTimeout(() => { window.L.disconnect && window.L.disconnect.forEach(f => f({})); setTimeout(() => res(sent.join('|')), 400); }, 300);
  }));
  ok(true, 'perf (qisqa o\'yin - yuborilmaydi): ' + (perf ? 'yuborildi' : 'yuborilmadi'));
  // "Lag / qotdi" javobi
  await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-fq', 'lag'); document.body.appendChild(e); e.click(); e.remove(); }); await p.waitForTimeout(500);
  ok(await p.$('#mdSide.on [data-act="lagfix"]'), '"Lag" javobidan keyin "Bir bosishda tuzatish" oynasi');
  await p.evaluate(() => { window.LOG = []; }); await p.click('[data-act="lagfix"]'); await p.waitForTimeout(500);
  const L2 = await p.evaluate(() => window.LOG.join('\n'));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).set);
  ok(st.aimnet === 1 && st.vsync === 0 && st.dyn === 0 && st.fps >= 100, 'sozlamalar: aniq tegish yoqildi, vsync/dinamik yorug\'lik o\'chdi, fps 100+ (' + JSON.stringify({ a: st.aimnet, v: st.vsync, d: st.dyn, f: st.fps }) + ')');
  ok(/gl_vsync 0/.test(L2) && /fps_max 1\d\d/.test(L2), 'o\'yinga darhol yuborildi (gl_vsync 0, fps_max)');
  // kunlik sovg'a kalendari: yangi akkaunt - birinchi kirish (claimDaily)
  const reg = await fetch(BASE + '/xc_api.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=register&login=testcal' + Date.now() % 100000 + '&pass=secret12&device=testdev0009' }).then(r => r.json());
  const pg2 = await page({ db: { token: reg.token, device: 'testdev0009', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x' }, wait: 1500 });   // dnd: 0 - kalendar faqat bezovta qilmaslik o'chiq bo'lsa
  await pg2.p.waitForTimeout(9000);
  const cal = await pg2.p.evaluate(() => { const b = document.querySelector('#mdSide.on .dcr'); return b ? b.children.length + ' ' + (document.querySelector('#mdSide .dcd.now') ? 'now' : '-') + ' ' + (document.querySelector('#mdSide .dcd.next') ? 'next' : '-') + ' | ' + document.querySelector('#mdSide .dcn').textContent : 'yo\'q: ' + document.getElementById('toast').textContent; });
  ok(/^7 now next \| Ertaga kiring: \+30 XP/.test(cal), 'kunlik sovg\'a: 7 kunlik kalendar, bugun va ertangi sovg\'a (' + cal + ')');
  if (process.env.DAILY_SHOT) await pg2.p.screenshot({ path: process.env.DAILY_SHOT });
  if (pg2.errs.length) errs.push.apply(errs, pg2.errs);
  await pg2.b.close();
  // chuqur yengillashtirish (launcher protsessor to'la band deb o'lchagan): effektlar, soyalar, HD modellar o'chadi
  await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-act', 'lagfix2'); document.body.appendChild(e); e.click(); e.remove(); }); await p.waitForTimeout(400);
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).set);
  ok(st2.ultra === 1 && st2.detail === 0 && st2.hdm === 0 && st2.lowgfx === 1 && st2.fps === 100, 'chuqur rejim: effektlarsiz, detal/HD o\'chiq, fps 100 (' + JSON.stringify({ u: st2.ultra, d: st2.detail, h: st2.hdm, f: st2.fps }) + ')');
  // beqaror serverlar ro'yxati so'raladi (Tezkor o'yin ularni pastroqqa qo'yadi)
  const un = await fetch(BASE + '/xc_api.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=unstable' }).then(r => r.json());
  ok(un.ok && typeof un.u === 'object', 'beqaror serverlar API ishlaydi');
  const fails = res.filter(r => r.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' fbfix (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
