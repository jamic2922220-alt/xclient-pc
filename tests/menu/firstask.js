/* Birinchi o'yindan keyin (60+ s) "qanday bo'ldi?" savoli chiqadi, javob feedback ga ketadi, ikkinchi marta chiqmaydi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: {} });
  // vaqtni surish: now() Date.now() ga tayanadi
  await p.evaluate(() => { window.__off = 0; const gt = Date.prototype.getTime; Date.prototype.getTime = function () { return gt.call(this) + window.__off; }; });
  const play = async (sec) => {
    await p.evaluate(() => (window.L.putinserver || []).forEach(f => f({ detail: { address: '5.5.5.5:27015' } })));
    await p.waitForTimeout(500); await p.evaluate((s) => { window.__off += s * 1000; }, sec);
    await p.evaluate(() => (window.L.disconnect || []).forEach(f => f({})));
  };
  const fb = []; p.on('request', r => { if (r.url().includes('xc_api.php') && (r.postData() || '').includes('a=feedback')) fb.push(r.postData()); });
  await play(90);
  let shown = false;
  for (let i = 0; i < 30 && !shown; i++) { await p.waitForTimeout(1000); shown = await p.evaluate(() => !!document.querySelector('[data-fq="lag"]') && document.querySelector('[data-fq="lag"]').offsetParent !== null);
    if (!shown) await p.evaluate(() => document.querySelectorAll('.modal.on [data-act="close"]').forEach(c => c.click())); }
  if (shown) { await p.click('[data-fq="lag"]'); await p.waitForTimeout(1500); }
  await play(90); await p.waitForTimeout(12000);
  const again = await p.evaluate(() => !!document.querySelector('[data-fq]') && document.querySelector('[data-fq]').offsetParent !== null);
  const ok = shown && fb.some(x => x.includes('kind=first')) && !again && !errs.length;
  console.log((ok ? 'PASS' : 'FAIL') + ' firstask (chiqdi=' + shown + ', yuborildi=' + fb.some(x => x.includes('kind=first')) + ', qayta=' + again + ', xato=' + errs.join('|') + ')');
  await b.close(); process.exit(ok ? 0 : 1);
})();
