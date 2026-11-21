/* "Sodda" (lite) menyu: launcher ko'rinmagan kompyuterda oddiy boost-top sahifasi (index.html) - sodda menyu,
 * X CLIENT o'rnatgan o'yin sahifasi (xc.html) - har doim to'liq menyu (o'yin launchersiz ochilgan bo'lsa ham) */
const { chromium } = require('playwright');
const BASE = process.env.XC_BASE || 'http://127.0.0.1:8791';
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [path, wantLite] of [['/index.html', true], ['/xc.html', false]]) {
    const p = await (await b.newContext()).newPage();
    await p.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await p.addInitScript(() => {                                   // o'yin brauzeri (NextClient) - bo'lmasa sahifa saytga yo'naltiradi
      const ui = { shown: true, addEventListener() {} };
      window.nextclient = { exec() {}, getCvarValue() { return null; }, addEventListener() {}, gameUi: ui,
        matchmaking: { getServerInfo() { return Promise.resolve({}); }, getPlayersInfo() { return Promise.resolve([]); } } };
    });
    await p.goto(BASE + path); await p.waitForTimeout(4000);
    const lite = await p.evaluate(() => /(^|\s)lite(\s|$)/.test(document.documentElement.className));
    if (lite !== wantLite) { bad++; console.log('FAIL lite ' + path + ': lite=' + lite + ', kutilgan ' + wantLite); }
  }
  await b.close();
  if (!bad) console.log('PASS lite (index.html sodda, xc.html to\'liq)');
  process.exit(bad ? 1 : 0);
})();
