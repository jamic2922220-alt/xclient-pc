/* ESC (o'yin ustida menyu ochilishi) - kuchsiz kompyuter (CPU x6) da eng uzun qotish, ms */
const { page } = require('./lib');
(async () => {
  const { b, p } = await page({ noShown: true, db: { fx: 0, fav: ['9.9.9.9:27015', '8.8.8.8:27015'] } });
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.evaluate(() => (window.L.putinserver || []).forEach(f => f({ detail: { address: '1.2.3.4:27015' } }))); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__lt = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt = Math.max(window.__lt, e.duration); }).observe({ entryTypes: ['longtask'] }); });
  const res = [];
  for (let k = 0; k < 3; k++) {
    await p.evaluate(() => { (window.L.ui_hide || []).forEach(f => f()); window.__lt = 0; }); await p.waitForTimeout(1500);
    await cdp.send('Performance.enable'); const m0 = (await cdp.send('Performance.getMetrics')).metrics;
    const sync = await p.evaluate(() => { var t = performance.now(); (window.L.ui_show || []).forEach(f => f()); return performance.now() - t; });
    await p.waitForTimeout(3500); const m1 = (await cdp.send('Performance.getMetrics')).metrics;
    const g = (m, k) => (m.find(x => x.name === k) || {}).value || 0;
    res.push('birdan ' + Math.round(sync) + ' ms, 3.5s ichida jami skript ' + Math.round((g(m1, 'ScriptDuration') - g(m0, 'ScriptDuration')) * 1000) + ' ms, chizish ' + Math.round((g(m1, 'LayoutDuration') + g(m1, 'RecalcStyleDuration') - g(m0, 'LayoutDuration') - g(m0, 'RecalcStyleDuration')) * 1000) + ' ms');
  }
  console.log(res.join(' | '));
  await b.close();
})();
