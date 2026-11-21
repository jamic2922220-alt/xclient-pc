/* O'yin o'lchami: monitor 1920x1080, o'yin eski 800x600 da qolib ketgan - Video bo'limida ogohlantirish va "Monitor o'lchamiga" tugmasi;
 * "Avto" yonida monitor o'lchami; lagni tuzatish ataylab kichraytirgan o'lchamda ogohlantirish chiqmaydi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { device: 'testdev0005', fx: 1, lang: 'uz', pcid: 'testpc0000001', pck: 'k' }, wait: 1000 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  let saved = null, lagres = '';
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=opts&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, d: 'testpc0000001', o: { res: lagres || '800x600', scr: '1920x1080', win: 0, age: 5 } }) });
    if (/^a=opts_set&/.test(d)) { saved = JSON.parse(decodeURIComponent(/o=([^&]*)/.exec(d)[1])); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    return r.continue(); });
  await p.reload(); await p.waitForTimeout(4000);
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  await act('settings'); await p.waitForTimeout(400); await p.click('#setTabs a[data-tab="video"]'); await p.waitForTimeout(500);
  const t = await p.evaluate(() => { const e = document.querySelector('#setBody .chk.bad'); return e ? e.textContent : ''; });
  ok(/1920×1080/.test(t) && /800×600/.test(t), 'ogohlantirish: monitor 1920×1080, o\'yin 800×600 (' + t.slice(0, 70) + ')');
  ok((await p.textContent('#setBody [data-dd="res"]')).indexOf('800') >= 0, 'tanlangan o\'lcham ko\'rinadi');
  await p.click('#setBody [data-act="resauto"]'); await p.waitForTimeout(600);
  ok(saved && saved.res === '', '"Monitor o\'lchamiga" bosilsa - Avto saqlanadi (o\'yin monitor o\'lchamida ochiladi)');
  await p.click('#setBody [data-dd="res"]'); await p.waitForTimeout(300);
  const dd = await p.evaluate(() => document.getElementById('ddList').textContent);
  ok(/\(1920 × 1080\)/.test(dd) && dd.indexOf('1920 × 1080') >= 0, 'ro\'yxatda "Avto (1920 × 1080)" - monitor o\'lchami, o\'yinniki emas');
  const fails = res.filter(x => x.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' res (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
