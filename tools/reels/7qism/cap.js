const { page } = require('./lib');
const R9 = process.env.R9;
(async () => {
  const db = { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3, pcid: 'testpc0000001', pck: 'k', set: { name: 'Sardor', tag: '' } };
  const { b, p, errs, close } = await page({ db, wait: 6000 });
  const act = (a) => p.evaluate((a) => { const e = document.createElement('a'); e.setAttribute('data-act', a); document.body.appendChild(e); e.click(); e.remove(); }, a);
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: R9 + '/shots/' + n + '.png' }); console.log('shot', n); };
  await close(); await shot('home');
  await act('mobapp'); await p.waitForTimeout(5000); console.log('box?', await p.evaluate(() => { const b = document.getElementById('mcBox'); return b ? b.outerHTML.slice(0,300) : 'none'; })); p.on('response', async r => { if (/xc_api/.test(r.url()) && /a=mcode/.test(r.request().postData()||'')) console.log('mcode resp', await r.text()); }); await act('mcode'); await p.waitForTimeout(1200); await p.evaluate(() => { const b = document.getElementById('mcBox'); b && b.scrollIntoView({ block: 'center' }); }); await shot('mobapp'); await p.evaluate(() => { const b = document.querySelectorAll('#mcBox'); return b.length + ' | ' + Array.from(b).map(x => x.outerHTML.slice(0,200)).join(' || '); }).then(t => console.log('mc', t));
  await close(); await act('lagfix'); await p.waitForTimeout(800); await shot('lagfix');
  await close(); await p.evaluate(() => { const e = document.querySelector('.mi[data-act=bots]'); e && e.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.querySelector('[data-bm=aimt]'); e && e.click(); }); await shot('aimt');
  await p.evaluate(() => { const e = document.querySelector('[data-bm=nade]'); e && e.click(); }); await shot('nade');
  await close(); await act('missions'); await shot('missions');
  await close(); await p.evaluate(() => { const e = document.querySelector('.mi[data-act=servers]'); e && e.click(); }); await shot('servers');
  console.log('errs', errs.slice(0, 3));
  await b.close();
})();
