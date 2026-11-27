/* Ko'rinish rejimi: Win10/11 + Avto o'lcham + o'yinchi tanlamagan -> "Chegarasiz" belgilangan va tushuntirish; tanlasa winx=1 saqlanadi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { device: 'testdev0007', fx: 1, lang: 'uz', pcid: 'testpc0000001', pck: 'k' }, wait: 1000 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  let saved = null, O = { ver: '1.0.155', win: 0, res: '', hw: { ram: 8000, cpu: 4, gpu: 'Intel' }, os: 'Windows 11 Pro 25H2', age: 5 };
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=opts&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, d: 'testpc0000001', o: O }) });
    if (/^a=opts_set&/.test(d)) { saved = JSON.parse(decodeURIComponent(/o=([^&]*)/.exec(d)[1])); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    return r.continue(); });
  const open = async () => { await p.reload(); await p.waitForTimeout(3500); await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-act', 'settings'); document.body.appendChild(e); e.click(); e.remove(); }); await p.waitForTimeout(400); await p.click('#setTabs a[data-tab="video"]'); await p.waitForTimeout(500); };
  const sel = () => p.evaluate(() => { const e = document.querySelector('#setBody [data-vseg="win"].on'); return e ? e.getAttribute('data-v') : ''; });
  const txt = () => p.textContent('#setBody');
  await open();
  ok(await sel() === '2' && /Alt\+Tab bir zumda/.test(await txt()), 'Win11 + Avto: Chegarasiz belgilangan, tushuntirish bor');
  O = Object.assign({}, O, { os: 'Windows 7 Ultimate' }); await open();
  ok(await sel() === '0' && /1-3 soniya qorayadi/.test(await txt()), 'Win7: To\'liq qoladi, ogohlantirish bor');
  O = Object.assign({}, O, { os: 'Windows 10 Pro', res: '1024x768' }); await open();
  ok(await sel() === '0', 'cho\'zilgan o\'lcham (1024x768): To\'liq qoladi');
  O = Object.assign({}, O, { res: '' }); await open();
  await p.click('#setBody [data-vseg="win"][data-v="0"]'); await p.waitForTimeout(500);
  ok(saved && saved.win === 0 && saved.winx === 1, 'o\'yinchi "To\'liq" ni tanlasa: winx=1 saqlanadi');
  ok(!errs.length, 'JS xato yo\'q' + (errs.length ? ': ' + errs[0] : ''));
  console.log(res.join('\n')); const bad = res.filter(x => /^XATO/.test(x)).length;
  console.log((bad ? 'FAIL' : 'PASS') + ' winm (' + (res.length - bad) + '/' + res.length + ')');
  await b.close(); process.exit(bad ? 1 : 0);
})();
