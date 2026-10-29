/* O'yin ichi (serverga ulangan, ESC menyusi): gameUi.shown bo'lmasa ham serverlar yangilanadi, effektlar o'chadi, menyu yopilsa so'rov to'xtaydi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ noShown: true, db: { fav: ['9.9.9.9:27015', '8.8.8.8:27015'] } });
  const fails = [];
  await p.evaluate(() => (window.L.putinserver || []).forEach(f => f({ detail: { address: '1.2.3.4:27015' } }))); await p.waitForTimeout(400);
  if (!await p.evaluate(() => / lowfx/.test(document.documentElement.className))) fails.push('o\'yinda effektlar o\'chmadi');
  await p.evaluate(() => { (window.L.ui_hide || []).forEach(f => f()); (window.L.ui_show || []).forEach(f => f()); });
  await p.click('#menu [data-act="servers"]'); await p.evaluate(() => document.querySelector('#mdServers [data-tab="favs"]').click());
  await p.waitForTimeout(1500); const q1 = await p.evaluate(() => window.QN); await p.waitForTimeout(16000); const q2 = await p.evaluate(() => window.QN);
  if (q2 - q1 < 2) fails.push('ESC menyusida serverlar yangilanmadi (' + q1 + ' -> ' + q2 + ')');
  await p.evaluate(() => (window.L.ui_hide || []).forEach(f => f())); const q3 = await p.evaluate(() => window.QN); await p.waitForTimeout(16000);
  if (await p.evaluate(() => window.QN) !== q3) fails.push('o\'yin paytida (menyu yopiq) serverlar so\'ralyapti');
  if (errs.length) fails.push('JS xatolar: ' + errs.join(' | '));
  console.log(fails.length ? 'FAIL ingame\n  ' + fails.join('\n  ') : 'PASS ingame');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
