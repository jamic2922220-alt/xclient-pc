/* F11 skrinshotlar: launcher ro'yxat (hello &sl=), yangi skrinshot (vadd t=s) va kichik rasm (vthumb t=s) yuboradi ->
 * menyu Demo bo'limida rasmlar ko'rinadi -> bosilsa launcher navbatiga "sopen", o'chirilsa "sdel" */
const { page, BASE } = require('./lib');
const zlib = require('zlib');
const A = BASE + '/xc_api.php', PC = 'testpc0000001';
// kichik haqiqiy JPEG (Pillow bo'lmasa ham): 1x1 piksel JPEG baytlari + to'ldiruvchi izoh
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
const body = Buffer.concat([JPG.slice(0, 2), Buffer.from([0xFF, 0xFE, 0x01, 0x02]), Buffer.alloc(256, 0x20), JPG.slice(2)]);   // COM bo'limi - 200 baytdan katta bo'lsin
(async () => {
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  const get = (q) => fetch(A + '?' + q).then(r => r.text());
  await get('a=hello&d=' + PC + '&v=1.0.138&lang=uz&sl=xc_20261109_213010~850,xc_20261109_213005_2~790,../bad~1');
  ok((await get('a=vadd&t=s&d=' + PC + '&n=xc_20261109_213020&kb=900')) === 'ok', 'launcher: yangi skrinshot ro\'yxatga (vadd t=s)');
  for (const n of ['xc_20261109_213020', 'xc_20261109_213010']) {
    const r = await fetch(A + '?a=vthumb&t=s&d=' + PC + '&n=' + n, { method: 'POST', body }).then(r => r.text());
    ok(r === 'ok', 'launcher: kichik rasm yuklandi ' + n + ' (' + r + ')');
  }
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 0, lang: 'ru' } });
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  await act('settings'); await p.waitForTimeout(500);
  await p.click('#setTabs a[data-tab="demo"]'); await p.waitForTimeout(1500);
  const names = await p.$$eval('#setBody [data-sopen]', a => a.map(x => x.getAttribute('data-sopen')));
  ok(names.join(',') === 'xc_20261109_213020,xc_20261109_213010,xc_20261109_213005_2', 'menyu: 3 ta skrinshot, eng yangisi birinchi, yaroqsiz nom yo\'q (' + names.join(',') + ')');
  const img = await p.evaluate(() => { const e = document.querySelector('#setBody .ssi'); const m = /url\(["']?([^"')]+)/.exec(e.style.backgroundImage); return m ? fetch(m[1]).then(r => r.status + ' ' + r.headers.get('content-type')) : 'yo\'q'; });
  ok(img === '200 image/jpeg', 'menyu: kichik rasm saytdan ochiladi (' + img + ')');
  const st = await fetch(A + '?a=vth&t=s&d=' + PC + '&n=xc_20261109_213020').then(r => r.status);
  ok(st === 404, 'kalitsiz begona odam rasmni ololmaydi (' + st + ')');
  const vis = await p.evaluate(() => { const e = document.querySelector('#setBody .ssi'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h === e; });
  ok(vis, 'menyu: rasm ko\'rinadi, ustini hech narsa yopmagan');
  await p.click('#setBody [data-sopen="xc_20261109_213010"]'); await p.waitForTimeout(800);
  let q = await get('a=vpoll&d=' + PC);
  ok(/sopen xc_20261109_213010/.test(q), 'bosilganda launcherga "sopen" buyrug\'i (' + q.trim() + ')');
  await p.click('#setBody [data-sdel="xc_20261109_213010"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('askYes').click(); }); await p.waitForTimeout(900);
  q = await get('a=vpoll&d=' + PC);
  const left = await p.$$eval('#setBody [data-sopen]', a => a.length);
  ok(/sdel xc_20261109_213010/.test(q) && left === 2, 'o\'chirish: launcherga "sdel", ro\'yxatda 2 ta qoldi (' + q.trim() + ', ' + left + ')');
  await p.click('#setBody [data-sfold]'); await p.waitForTimeout(700);
  ok(/sfold/.test(await get('a=vpoll&d=' + PC)), '"Открыть папку" -> launcherga "sfold"');
  ok((await get('a=vadd&t=s&d=' + PC + '&n=..%2F..%2Fx')) === '', 'yaroqsiz nom qabul qilinmaydi');
  const fails = res.filter(r => r.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' shots (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
