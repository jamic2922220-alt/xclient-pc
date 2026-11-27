/* O'yin o'lchami: monitor 1920x1080, o'yin eski 800x600 da qolib ketgan - Video bo'limida ogohlantirish va "Monitor o'lchamiga" tugmasi;
 * "Avto" yonida monitor o'lchami; lagni tuzatish ataylab kichraytirgan o'lchamda ogohlantirish chiqmaydi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { device: 'testdev0005', fx: 1, lang: 'uz', pcid: 'testpc0000001', pck: 'k' }, wait: 1000 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  let saved = null, lagres = '', ores = '800x600', extra = {};
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=opts&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, d: 'testpc0000001', o: Object.assign({ res: lagres || ores, scr: '1920x1080', win: 0, age: 5 }, extra) }) });
    if (/^a=opts_set&/.test(d)) { saved = JSON.parse(decodeURIComponent(/o=([^&]*)/.exec(d)[1])); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    return r.continue(); });
  await p.reload(); await p.waitForTimeout(4000);
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  await act('settings'); await p.waitForTimeout(400); await p.click('#setTabs a[data-tab="video"]'); await p.waitForTimeout(500);
  const t = await p.evaluate(() => { const e = document.querySelector('#setBody .chk.bad'); return e ? e.textContent : ''; });
  ok(/1920×1080/.test(t) && /800×600/.test(t), 'ogohlantirish: monitor 1920×1080, o\'yin 800×600 (' + t.slice(0, 70) + ')');
  ok((await p.textContent('#setBody [data-dd="res"]')).indexOf('800') >= 0, 'tanlangan o\'lcham ko\'rinadi');
  const b43 = await p.evaluate(() => { const e = document.querySelector('#setBody [data-act="res43"]'); return e ? e.textContent : ''; });
  ok(/1280×960/.test(b43), '4:3 da "4:3 qolsin, lekin tiniq: 1280×960" tugmasi (' + b43 + ')');
  await p.click('#setBody [data-act="res43"]'); await p.waitForTimeout(600);
  ok(saved && saved.res === '1280x960', 'tiniq 4:3 bosilsa - 1280x960 saqlanadi');
  await p.click('#setBody [data-act="resauto"]'); await p.waitForTimeout(600);
  ok(saved && saved.res === '', '"Monitor o\'lchamiga" bosilsa - Avto saqlanadi (o\'yin monitor o\'lchamida ochiladi)');
  await p.click('#setBody [data-dd="res"]'); await p.waitForTimeout(300);
  const dd = await p.evaluate(() => document.getElementById('ddList').textContent);
  ok(/\(1920 × 1080\)/.test(dd) && dd.indexOf('1920 × 1080') >= 0, 'ro\'yxatda "Avto (1920 × 1080)" - monitor o\'lchami, o\'yinniki emas');
  /* lib har yuklashda localStorage ni tiklaydi - belgilarni sessionStorage orqali undan keyin qo'yamiz */
  await p.addInitScript(() => { try { const x = JSON.parse(sessionStorage.getItem('xdbx') || 'null'); if (!x) return; const d = JSON.parse(localStorage.getItem('xclient')); for (const k in x) { if (x[k] === null) delete d[k]; else d[k] = x[k]; } localStorage.setItem('xclient', JSON.stringify(d)); } catch (e) {} });
  const setDb = (o) => p.evaluate((o) => sessionStorage.setItem('xdbx', JSON.stringify(o)), o);
  /* kichik o'lcham endi o'zi "Avto" ga o'tmaydi (FPS tushardi) */
  saved = null; ores = '1280x720'; extra = { hw: { cpu: 8, ram: 16000, gpu: 'NVIDIA GeForce GTX 1060' }, os: 'Windows 10 Pro' };
  await setDb({ natfix: null, fpsrev: 1 }); await p.reload(); await p.waitForTimeout(4000);
  ok(!saved, '1280x720 (monitor 1920x1080) - o\'zgartirilmadi (' + (saved ? saved.res : '-') + ')');
  /* avval monitor o'lchamiga o'tkazilgan + ichki videokarta - bir marta 1280x720 ga qaytadi */
  saved = null; ores = ''; extra = { hw: { cpu: 4, ram: 8000, gpu: 'Intel(R) UHD Graphics' }, os: 'Windows 10 Pro' };
  await setDb({ natfix: 1, fpsrev: null }); await p.reload(); await p.waitForTimeout(4000);
  ok(saved && saved.res === '1280x720', 'ichki videokarta: o\'lcham 1280x720 ga qaytdi (' + (saved ? saved.res : '-') + ')');
  /* kuchli kompyuter: tegilmaydi */
  saved = null; extra = { hw: { cpu: 8, ram: 16000, gpu: 'NVIDIA GeForce GTX 1060' }, os: 'Windows 10 Pro' };
  await setDb({ natfix: 1, fpsrev: null, lagres: null }); await p.reload(); await p.waitForTimeout(4000);
  ok(!saved || saved.res === '', 'kuchli kompyuter: Avto qoladi');
  /* chegarasizga o'tkazilgan ichki videokarta - yana To'liq */
  saved = null; extra = { win: 2, winx: 1, hw: { cpu: 4, ram: 8000, gpu: 'Intel(R) HD Graphics 620' }, os: 'Windows 10 Pro' };
  await setDb({ natfix: null, blfix: 1, fpsrev: null }); await p.reload(); await p.waitForTimeout(4000);
  ok(saved && saved.win === 0, 'ichki videokarta: chegarasizdan yana To\'liq ga (' + (saved ? saved.win : '-') + ')');
  /* qo'lda "To'liq" (winx) + Windows 10 + kuchli kompyuter - bir marta Chegarasiz; ichki videokartada - yo'q */
  saved = null; extra = { winx: 1, hw: { cpu: 8, ram: 16000, gpu: 'NVIDIA GeForce GTX 1060' }, os: 'Windows 10 Pro' };
  await setDb({ blfix: null, natfix: null, fpsrev: 1 }); await p.reload(); await p.waitForTimeout(4000);
  ok(saved && saved.win === 2, "kuchli: qo'lda To'liq - o'zi Chegarasiz ga o'tdi (" + (saved ? saved.win : '-') + ')');
  saved = null; extra = { winx: 1, hw: { cpu: 4, ram: 8000, gpu: 'Intel(R) UHD Graphics' }, os: 'Windows 10 Pro' };
  await setDb({ blfix: null, fpsrev: 1 }); await p.reload(); await p.waitForTimeout(4000);
  ok(!saved, "ichki videokarta: To'liq qoladi");
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' res (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
