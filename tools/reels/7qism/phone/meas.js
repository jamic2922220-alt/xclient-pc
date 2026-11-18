const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 1170 } });
 for (const m of ['acc', 'off', 'login']) { await p.goto('file://' + __dirname + '/app.html?m=' + m);
  const r = await p.evaluate(() => Array.from(document.querySelectorAll('.card,.dlg')).map(e => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.top), Math.round(r.height)]; }));
  console.log(m, JSON.stringify(r)); }
 await b.close(); })();
