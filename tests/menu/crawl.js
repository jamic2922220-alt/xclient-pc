/* Hamma oyna va Sozlamalarning har bo'limini ochadi: JS xatolari, ko'rinish buzilishi, chat oynasi o'lchami */
const { page, layoutProblems } = require('./lib');
const SHOT = process.env.XC_SHOTS;
(async () => {
  const { b, p, errs, close } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 0 } });
  const fails = [];
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  for (const a of ['servers', 'friends', 'profile', 'missions', 'stats', 'clan', 'ref', 'chests', 'feedback', 'weekall', 'cfgtop']) {
    await act(a); await p.waitForTimeout(800);
    const lp = await layoutProblems(p); if (lp.length) fails.push('oyna ' + a + ': ' + lp.join(', '));
    if (SHOT) await p.screenshot({ path: SHOT + '/side_' + a + '.png' });
    await close();
  }
  await act('friends'); await p.waitForTimeout(1200);
  const chat = await p.$('#sideBody [data-chat]');
  if (chat) { await chat.click(); await p.waitForTimeout(1200); const r = await p.evaluate(() => { const e = document.getElementById('chatBox'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.width, b.height]; });
    if (!r || r[0] < 500 || r[1] < 250) fails.push('chat oynasi buzilgan: ' + JSON.stringify(r)); if (SHOT) await p.screenshot({ path: SHOT + '/chat.png' }); }
  await close();
  await act('settings'); await p.waitForTimeout(600);
  const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('#mdSettings [data-tab]')).map(e => e.getAttribute('data-tab')));
  for (const t of tabs) {
    await p.evaluate((t) => document.querySelector('#mdSettings [data-tab="' + t + '"]').click(), t); await p.waitForTimeout(500);
    const lp = await layoutProblems(p); if (lp.length) fails.push('sozlamalar/' + t + ': ' + lp.join(', '));
    if (SHOT) await p.screenshot({ path: SHOT + '/set_' + t + '.png' });
  }
  await close();
  if (SHOT) await p.screenshot({ path: SHOT + '/home.png' });
  if (errs.length) fails.push('JS xatolar: ' + errs.join(' | '));
  console.log(fails.length ? 'FAIL crawl\n  ' + fails.join('\n  ') : 'PASS crawl (' + tabs.length + ' bo\'lim, 11 oyna, chat)');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
