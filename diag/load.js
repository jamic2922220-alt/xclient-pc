const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const log = []; p.on('pageerror', e => log.push('PAGEERROR ' + e.message)); p.on('console', m => log.push('console.' + m.type() + ' ' + m.text()));
  p.on('requestfailed', r => log.push('FAIL ' + r.url() + ' ' + (r.failure() || {}).errorText));
  p.on('response', r => { if (r.status() >= 400) log.push('HTTP ' + r.status() + ' ' + r.url()); });
  await p.addInitScript(() => { window.nextclient = { exec() {}, getCvarValue() { return null; }, matchmaking: { getServerInfo() { return Promise.resolve({ hostname: 'S', map: 'de_dust2', playersOnline: 1, playersMax: 32 }); }, getPlayersInfo() { return Promise.resolve([]); } }, addEventListener() {}, gameUi: { shown: true, addEventListener() {} } }; });
  const t = Date.now();
  try { await p.goto('http://mmb.boost-top.com/xc.html', { timeout: 60000 }); } catch (e) { log.push('GOTO ' + e.message); }
  await p.waitForTimeout(12000);
  log.push('loaded in ' + (Date.now() - t) + 'ms; XC_V=' + await p.evaluate(() => window.XC_V).catch(() => '?') + ' menu items=' + await p.evaluate(() => document.querySelectorAll('#menu .mi').length).catch(() => '?') + ' body=' + await p.evaluate(() => document.body ? document.body.innerText.slice(0, 200).replace(/\s+/g, ' ') : 'nobody').catch(e => e.message));
  await p.screenshot({ path: 'diag/out/shot.png' }).catch(() => {});
  console.log(log.join('\n')); await b.close();
})();
