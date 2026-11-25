/* Menyu turli o'yin o'lchamlarida: 0.6+ da zoom (tiniq matn), kichikda transform; hech bir bo'limda panel tashqarisiga chiqish yo'q */
const { page, layoutProblems } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3, set: { name: 'testa', tag: '' } }, wait: 2500 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  for (const [w, h, mode] of [[1920, 1080, 'zoom'], [1366, 768, 'zoom'], [1280, 720, 'zoom'], [1024, 768, 'zoom'], [800, 600, 'transform']]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(1800);
    const st = await p.evaluate(() => { const a = document.getElementById('app'); return { z: a.style.zoom, t: a.style.transform, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; });
    const m = st.t ? 'transform' : 'zoom';
    ok(m === mode, w + 'x' + h + ': ' + m + ' (z=' + st.z + ')');
    ok(st.sw <= w + 2 && st.sh <= h + 2, w + 'x' + h + ': sahifa ekrandan chiqmaydi (' + st.sw + 'x' + st.sh + ')');
    await p.evaluate(() => { const e = document.querySelector('[data-act="settings"]'); if (e) e.click(); }); await p.waitForTimeout(400);
    for (const t of ['game', 'keys', 'video', 'system']) {
      await p.evaluate(t => { const e = document.querySelector('#mdSettings [data-tab="' + t + '"]'); if (e) e.click(); }, t); await p.waitForTimeout(250);
      const lp = await layoutProblems(p); ok(!lp.length, w + 'x' + h + ' sozlamalar/' + t + (lp.length ? ': ' + lp.join(', ') : ''));
    }
    await p.evaluate(() => document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); })); await p.waitForTimeout(200);
  }
  ok(!errs.length, 'JS xatolari yo\'q ' + errs.join(' | '));
  await b.close(); console.log('== Menyu o\'lchamlari'); res.forEach(r => console.log(r));
  process.exit(res.some(r => r.startsWith('XATO')) ? 1 : 0);
})();
