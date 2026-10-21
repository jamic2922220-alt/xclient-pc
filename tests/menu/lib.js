/* Umumiy: brauzer, soxta NextClient, akkaunt bilan kirish */
const { chromium } = require('playwright');
const BASE = process.env.XC_BASE || 'http://127.0.0.1:8791';
async function page(opts) {
  opts = opts || {};
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await p.addInitScript((o) => {
    window.LOG = []; window.QN = 0; window.L = {};
    localStorage.setItem('xclient', JSON.stringify(Object.assign({ wnSeen: 'x', lang: 'uz', dnd: 1 }, o.db || {})));
    const ui = { addEventListener(n, f) { (window.L['ui_' + n] = window.L['ui_' + n] || []).push(f); } };
    if (!o.noShown) ui.shown = true;
    window.nextclient = { exec(c) { window.LOG.push(String(c).trim()); }, getCvarValue() { return null; },
      matchmaking: { getServerInfo(ip) { window.QN++; return Promise.resolve({ hostname: 'S ' + ip, map: 'de_dust2', playersOnline: 12, playersMax: 32 }); }, getPlayersInfo() { return Promise.resolve([{ name: 'p1', score: 3 }]); } },
      addEventListener(n, f) { (window.L[n] = window.L[n] || []).push(f); }, gameUi: ui };
  }, opts);
  await p.goto(BASE + '/xc.html'); await p.waitForTimeout(opts.wait || 5000);
  const close = () => p.evaluate(() => { document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }); });
  await close();
  return { b, p, errs, close };
}
/* modal ichidagi bloklar o'z panelidan chiqib ketganmi (sichqoncha bo'limidagi kabi xato) */
function layoutProblems(p) {
  return p.evaluate(() => {
    const out = [];
    const sb = document.querySelector('.modal.on #setBody');      // Sozlamalar: hamma narsa panel ichida bo'lishi kerak
    if (sb) Array.from(sb.children).forEach(c => { if (!/(^|\s)(pane|hsub)(\s|$)/.test(c.className) && c.getBoundingClientRect().width) out.push((c.className || c.tagName) + ' panel tashqarisida'); });
    document.querySelectorAll('.modal.on .pane').forEach(pn => {
      const pr = pn.getBoundingClientRect(); if (!pr.width) return;
      Array.from(pn.children).forEach(c => { const r = c.getBoundingClientRect(); if (r.width && (r.left < pr.left - 6 || r.right > pr.right + 6)) out.push((c.className || c.tagName) + ' chiqib ketgan'); });
      const s = pn.nextElementSibling; if (s && /pane/.test(s.className)) { const sr = s.getBoundingClientRect(); if (sr.width && pr.right > sr.left + 6) out.push('panellar ustma-ust'); }
    });
    return out;
  });
}
module.exports = { page, layoutProblems, BASE };
