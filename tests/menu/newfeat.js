/* Yangi: Video bo'limi (NextClient kabi), LAN, "+ IP" tugmasi hamma bo'limda, Demo matnida F11 (F9 yo'q) */
const { page } = require('./lib');
let window_lan_cmd = false;
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 0 } });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  await p.route('**/xc_api.php*', async (r) => {     // launcher LAN da 2 ta server topdi
    const d = r.request().postData() || '';
    if (d.includes('a=langet')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, t: Math.floor(Date.now() / 1000), now: Math.floor(Date.now() / 1000), list: [{ ip: '192.168.1.5:27015', name: 'Klub LAN #1', map: 'de_dust2', pl: 7, max: 32 }, { ip: '192.168.1.9:27016', name: 'Ikkinchi LAN', map: 'de_inferno', pl: 2, max: 20 }] }) });
    if (d.includes('a=vcmd')) { window_lan_cmd = true; return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    return r.continue();
  });
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  await act('settings'); await p.waitForTimeout(500);
  await p.click('#setTabs a[data-tab="video"]'); await p.waitForTimeout(400);
  ok(await p.$('[data-vseg="ar"][data-v="43"]'), 'ekran formati 4:3/16:9/16:10');
  ok(await p.$('[data-vseg="win"][data-v="2"]'), "ko'rinish rejimi (chegarasiz)");
  for (const k of ['hdm', 'addons', 'lowgfx', 'detail', 'vsync', 'hor']) ok(await p.$('[data-tg="' + k + '"]'), 'tugma ' + k);
  for (const k of ['stretch', 'ontop', 'flash']) ok(await p.$('[data-otg="' + k + '"]'), 'launcher tugmasi ' + k);
  ok(await p.$('[data-sl="bright"]') && await p.$('[data-sl="gamma"]'), 'yorqinlik va gamma');
  await p.click('[data-vseg="ar"][data-v="43"]'); await p.waitForTimeout(300);
  await p.click('[data-dd="res"]'); await p.waitForTimeout(200);
  const items = await p.$$eval('#ddList a', a => a.map(x => x.getAttribute('data-ddv')));
  ok(items.indexOf('1024x768') >= 0 && items.indexOf('1920x1080') < 0, "4:3 tanlansa faqat 4:3 o'lchamlar (" + items.slice(1, 4).join(',') + ')');
  await p.evaluate(() => document.body.click()); await p.waitForTimeout(200);
  await p.click('[data-tg="hdm"]'); await p.click('[data-tg="addons"]'); await p.click('[data-tg="lowgfx"]');
  await p.evaluate(() => { window.LOG.length = 0; }); await act('save'); await p.waitForTimeout(600);
  const log = await p.evaluate(() => window.LOG.join(' | '));
  ok(log.includes('_sethdmodels 1'), 'HD modellar -> _sethdmodels 1');
  ok(log.includes('_setaddons_folder 1'), 'tashqi kontent -> _setaddons_folder 1');
  ok(log.includes('_set_vid_level 1'), 'past grafika -> _set_vid_level 1');
  ok(/brightness [\d.]+/.test(log), 'yorqinlik -> brightness');
  // Demo matni
  await act('settings'); await p.waitForTimeout(400); await p.click('#setTabs a[data-tab="demo"]'); await p.waitForTimeout(300);
  const dt = await p.$eval('.f10box', e => e.textContent);
  ok(dt.includes('F11') && !dt.includes('F9'), 'Demo: F11 bor, F9 yo\'q');
  await act('close'); await p.waitForTimeout(300);
  // Serverlar: LAN va + IP
  /* tugma haqiqatan ko'rinadimi: o'lchami bor, oyna ichida, markazidagi nuqtada aynan shu tugma (boshqa panel yopmagan) */
  const seen = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.offsetParent) return 'yo\'q';
    const r = e.getBoundingClientRect(), w = e.closest('.win').getBoundingClientRect();
    if (r.width < 20 || r.height < 16) return 'kichik';
    if (r.left < w.left || r.right > w.right || r.top < w.top || r.bottom > w.bottom) return 'oynadan tashqarida';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && (hit === e || e.contains(hit)) ? 'ok' : 'ustini yopgan: ' + (hit ? (hit.id || hit.className) : '-'); }, sel);
  for (const lang of ['uz', 'ru', 'en']) {
    await p.evaluate((l) => { const e = document.createElement('a'); e.setAttribute('data-lang', l); document.body.appendChild(e); e.click(); e.remove(); }, lang);
    await p.waitForTimeout(300);
    await act('servers'); await p.waitForTimeout(600);
    for (const tab of ['internet', 'favs', 'history', 'lan', 'friends', 'top']) {
      await p.click('#srvTabs a[data-tab="' + tab + '"]'); await p.waitForTimeout(250);
      for (const sel of ['#addIpBtn', '[data-act="refresh"]', '#favBtn', '#mdServers [data-act="join"]'].concat(tab === 'internet' ? ['#quickBtn'] : []).concat(tab === 'history' ? ['#clearHist'] : [])) {
        const v = await seen(sel); if (v !== 'ok') ok(false, lang + '/' + tab + ': ' + sel + ' - ' + v);
      }
    }
    ok(true, lang + ": serverlar oynasidagi hamma tugmalar ko'rinadi va ochiq");
    await act('close'); await p.waitForTimeout(200);
  }
  await p.evaluate(() => { const e = document.createElement('a'); e.setAttribute('data-lang', 'uz'); document.body.appendChild(e); e.click(); e.remove(); });
  await act('servers'); await p.waitForTimeout(500);
  await p.click('#addIpBtn'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('mdAsk').classList.contains('on') || getComputedStyle(document.getElementById('mdAsk')).display !== 'none'), '+ IP bosilganda IP kiritish oynasi ochiladi');
  await p.evaluate(() => { const i = document.getElementById('askI'); i.value = '192.168.1.77:27015'; document.getElementById('askYes').click(); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('#srvList [data-ip="192.168.1.77:27015"], #srvList .on')), 'kiritilgan IP sevimlilarga qo\'shildi');
  await p.click('#srvTabs a[data-tab="lan"]'); await p.waitForTimeout(600);
  const scanTxt = await p.$eval('#srvList', e => e.textContent);
  ok(/qidirilyapti|launcher|192\.168/i.test(scanTxt), 'LAN: bo\'lim ochildi (qidiruv yoki oldingi natija)');
  await p.waitForTimeout(4500);
  const lanTxt = await p.$eval('#srvList', e => e.textContent);
  ok(lanTxt.includes('192.168.1.5') && lanTxt.includes('192.168.1.9'), 'LAN: topilgan 2 ta server ro\'yxatda');
  ok(window_lan_cmd, 'LAN: launcherga skanerlash buyrug\'i yuborildi');
  /* Sozlamalarning har bir bo'limida: har bir tugma/almashtirgich ko'rinadi (aylantirib), ustini hech narsa yopmagan */
  await act('settings'); await p.waitForTimeout(400);
  const tabs = await p.$$eval('#setTabs a', a => a.map(x => x.getAttribute('data-tab')));
  let bad = [];
  for (const tb of tabs) {
    await p.click('#setTabs a[data-tab="' + tb + '"]'); await p.waitForTimeout(250);
    bad = bad.concat(await p.evaluate((tb) => {
      const out = [];
      document.querySelectorAll('#setBody .tg, #setBody .btn, #setBody [data-seg], #setBody [data-vseg], #setBody [data-ovq], #setBody [data-ovf], #setBody .dd').forEach(e => {
        if (!e.offsetParent) return;
        e.scrollIntoView({ block: 'center' });
        const r = e.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return;
        const hit = document.elementFromPoint(Math.min(r.right - 3, r.left + r.width / 2), r.top + r.height / 2);
        if (!hit || !(hit === e || e.contains(hit) || hit.contains(e))) out.push(tb + ': ' + (e.getAttribute('data-tg') || e.getAttribute('data-act') || e.textContent.trim().slice(0, 20)) + ' <- ' + (hit ? (hit.id || hit.className) : '-'));
      });
      return out;
    }, tb));
  }
  ok(!bad.length, 'Sozlamalar: ' + tabs.length + " bo'limdagi hamma tugmalar ko'rinadi" + (bad.length ? ' | ' + bad.slice(0, 6).join(' ; ') : ''));
  await act('close');
  const fails = res.filter(r => r.startsWith('XATO'));
  console.log(res.join('\n'));
  console.log((fails.length || errs.length ? 'FAIL' : 'PASS') + ' newfeat (' + (res.length - fails.length) + '/' + res.length + (errs.length ? ', JS xato: ' + errs.join('|') : '') + ')');
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
