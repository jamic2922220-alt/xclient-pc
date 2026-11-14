/* Aniq tegish: serverga kirganda ping/yo'qotishga mos tarmoq sozlamalari yuboriladi */
const { page } = require('./lib');
(async () => {
  const { b, p } = await page({ db: {} });
  const run = (nh) => p.evaluate((nh) => { window.LOG.length = 0; var ip = '7.7.7.' + nh.length + ':27015'; window.XC_NETHIST(ip, nh);
    (window.L.putinserver || []).forEach(f => f({ detail: { address: ip } })); return ip; }, nh);
  const res = [];
  for (const [nm, nh, want] of [['yaxshi', [30, 32, 31, 29], 'cl_updaterate 101'], ['o\'rta', [95, 100, 90, 98], 'rate 50000'], ['yomon', [60, -1, 70, -1, 65, 62, 61, 60, 59, 58], 'rate 30000']]) {
    await run(nh); await p.waitForTimeout(2200);
    const log = await p.evaluate(() => window.LOG.join(' | '));
    const ok = log.indexOf(want) >= 0 && log.indexOf('cl_lc 1') >= 0;
    res.push((ok ? 'PASS ' : 'FAIL ') + nm + ': ' + (log.match(/rate \d+ \| cl_updaterate \d+ \| cl_cmdrate \d+ \| ex_interp [\d.]+/) || ['-'])[0]);
    await p.evaluate(() => (window.L.disconnect || []).forEach(f => f({})));
    await p.waitForTimeout(300);
  }
  console.log(res.join('\n')); await b.close(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
