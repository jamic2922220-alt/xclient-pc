/* Telegram ulash: kirgandan keyin taklif (QR + kod), QR - t.me/bot?start=KOD, ulanish o'zi aniqlanadi (tg_st) */
const { page, qrDecode } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x' }, wait: 1500 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  let st = 0;
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=tg_code&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, code: '123456', bot: 'xclient_bot', link: 'https://t.me/xclient_bot?start=123456', linked: false, gift: true }) });
    if (/^a=tg_st&/.test(d)) { st++; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, linked: st >= 2, chests: 3 }) }); }
    if (/^a=daily&/.test(d)) return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"got":0}' });
    return r.continue(); });
  await p.reload(); await p.waitForTimeout(19000);   // kirgandan ~16 s keyin taklif
  const side = await p.evaluate(() => ({ on: document.getElementById('mdSide').className, t: (document.getElementById('sideBody') || {}).textContent || '', qr: document.querySelectorAll('#sideBody .tgqr .qrr').length }));
  ok(/on/.test(side.on) && /Telegram'ni ulang/.test(side.t), 'kirgandan keyin Telegram ulash taklifi o\'zi chiqdi');
  const qtxt = await qrDecode(p, '#sideBody .tgqr');
  ok(side.qr > 20 && qtxt === 'https://t.me/xclient_bot?start=123456', 'QR kod skanerlanadi (' + qtxt + ')');
  ok(/123456/.test(side.t) && /sandiq/.test(side.t), 'kod va sovg\'a (sandiq) yozilgan');
  await p.screenshot({ path: '/tmp/claude-0/-home-user/c174bc30-11c3-5deb-b9e4-d277fe0ca5fd/scratchpad/tgwin.png' });
  const vc = []; p.on('request', r => { const d = r.postData() || ''; if (/a=vcmd/.test(d)) vc.push(decodeURIComponent(d)); });
  await p.evaluate(() => { const e = document.querySelector('#sideBody .qrl'); if (e) e.click(); }); await p.waitForTimeout(600);
  ok(vc.some(x => /c=utg/.test(x) && /n=123456/.test(x)), 'pastdagi havola Telegram botni brauzerda ochadi (utg)');
  await p.waitForTimeout(9500);
  const done = await p.evaluate(() => (document.getElementById('tgSt') || {}).className + ' | ' + (document.getElementById('tgSt') || {}).textContent);
  ok(/ok/.test(done) && /ulandi/i.test(done), 'QR skanerlangach "Ulandi" o\'zi chiqadi (' + done + ')');
  const db = await p.evaluate(() => JSON.parse(localStorage.getItem('xclient')));
  ok(db.tgAskN === 1 && db.tgAsk > 0, 'taklif eslab qolinadi (3 kunda bir, ko\'pi bilan 3 marta)');
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' tg (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
