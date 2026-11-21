const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 1170 }, deviceScaleFactor: 2 });
 for (const m of ['acc', 'login', 'off']) { await p.goto('file://' + __dirname + '/app.html?m=' + m); await p.waitForTimeout(300); await p.screenshot({ path: __dirname + '/ph_' + m + '.png' }); }
 await b.close(); })();
