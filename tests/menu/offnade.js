/* Granata mashqi (botsiz, F3 granatalar, F4 uchish, xarita joylari) va internetsiz oflayn menyu (offline.html) */
const { page } = require('./lib');
const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3, bots: { m: 'nade', map: 'de_dust2', lan: 0 } }, wait: 1500 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  const clk = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  await clk('.mi[data-act=bots]'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => document.getElementById('sideBody').textContent);
  ok(/Granata mashqi/.test(t) && /F3/.test(t) && /Mid doors/.test(t), 'granata mashqi: tugmalar va de_dust2 joylari ko\'rinadi');
  ok(!/Botlar darajasi/.test(t), 'botlar soni/darajasi yashirin (botsiz rejim)');
  await p.evaluate(() => { window.LOG.length = 0; }); await clk('[data-act=botgo]'); await p.waitForTimeout(300);
  const log = await p.evaluate(() => window.LOG);
  ok(log.includes('sv_cheats 1') && log.includes('bind F3 xcnade') && log.includes('bind F4 noclip'), 'sv_cheats 1, F3/F4 tugmalari');
  ok(log.includes('bot_quota 0') && log.includes('map de_dust2'), 'botsiz (bot_quota 0), xarita ochiladi');
  await clk('.mi[data-act=bots]'); await p.waitForTimeout(300); await clk('[data-bm=std]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.LOG.length = 0; }); await clk('[data-act=botgo]'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.LOG)).includes('sv_cheats 0'), 'oddiy botlar o\'yinida sv_cheats 0 qaytadi');
  /* oflayn menyu: kompyuterdagi fayl, LAN ro'yxati lan.js dan */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xcoff'));
  fs.copyFileSync(path.join(__dirname, '../../theme/platform/xclient/offline.html'), path.join(dir, 'offline.html'));
  fs.writeFileSync(path.join(dir, 'lan.js'), 'window.XC_LAN = "192.168.1.7:27015|Ali \\"LAN\\" сервер|de_dust2|3|12";\n');
  const q = await b.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.addInitScript(() => { window.EX = []; window.nextclient = { exec: c => window.EX.push(c.trim()) }; });
  await q.goto('file://' + dir + '/offline.html');
  await q.click('[data-a=lan]'); await q.waitForTimeout(400);
  const rows = await q.locator('.srv').allInnerTexts();
  ok(rows.length === 1 && /Ali "LAN" сервер/.test(rows[0]), 'oflayn: LAN server ro\'yxatda (' + rows.join('|').replace(/\s+/g, ' ') + ')');
  await q.click('.srv'); await q.click('[data-a=bots]'); await q.click('[data-a=botgo]');
  const ex = await q.evaluate(() => window.EX);
  ok(ex.includes('connect 192.168.1.7:27015') && ex.includes('map de_dust2') && ex.includes('sv_lan 1'), 'oflayn: LAN serverga ulanish va botlar bilan o\'yin');
  ok(!e2.length, 'oflayn menyuda JS xato yo\'q' + (e2.length ? ': ' + e2.join('|') : ''));
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' offnade (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
