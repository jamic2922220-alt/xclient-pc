/* Eski launcher: menyuda "yangilang" kartasi (opts.lver), avto-yangilash o'chiq bo'lsa - bir bosishda yoqish;
 * sozlamalarda "Eng oxirgi versiya" faqat haqiqatan oxirgi bo'lsa; akkaunt kartasi yopilsa 5 kundan keyin qaytadi */
const { page } = require('./lib');
(async () => {
  const { b, p, errs } = await page({ db: { device: 'testdev0006', fx: 1, lang: 'uz', pcid: 'testpc0000001', pck: 'k', dnd: 0, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3 }, wait: 1000 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  let saved = null, ver = '1.0.138';
  await p.route('**/xc_api.php*', r => { const d = r.request().postData() || '';
    if (/^a=opts&/.test(d)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, d: 'testpc0000001', o: { ver: ver, lver: '1.0.152', auto: 0, age: 5 } }) });
    if (/^a=opts_set&/.test(d)) { saved = JSON.parse(decodeURIComponent(/o=([^&]*)/.exec(d)[1])); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    return r.continue(); });
  await p.reload(); await p.waitForTimeout(4000);
  const vis = s => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, s);
  const clk = s => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, s);
  ok(await vis('#updCard'), 'eski launcher (1.0.138): bosh ekranda yangilash kartasi');
  ok(/1\.0\.138/.test(await p.textContent('#updT')) && /1\.0\.152/.test(await p.textContent('#updT')), 'kartada eski va yangi versiya');
  await clk('#updCard'); await p.waitForTimeout(500);
  const t = await p.evaluate(() => document.getElementById('sideBody').textContent);
  ok(/avto-yangilash o'chirilgan/.test(t) && /cssborka\.uz\/xclient/.test(t), 'oynada: avto-yangilash o\'chiq + sayt manzili');
  await clk('#sideBody [data-act=updauto]'); await p.waitForTimeout(600);
  ok(saved && saved.auto === 1, 'bir bosishda avto-yangilash yoqildi (opts_set auto=1)');
  await p.evaluate(() => { document.querySelectorAll('[data-act="close"]').forEach(c => { if (c.offsetParent) c.click(); }); });
  await clk('#updCard .cx'); await p.waitForTimeout(300);
  ok(!(await vis('#updCard')), 'x bosilsa karta yashirinadi');
  /* yangi launcher - karta yo'q, sozlamalarda "eng oxirgi" */
  ver = '1.0.152'; await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(4000);
  ok(!(await vis('#updCard')), 'oxirgi versiyada karta chiqmaydi');
  /* akkaunt kartasi (localStorage orqali): eski belgi acx=1 - qayta ko'rinadi; yangi yopish - 5 kun; 3-yopishdan keyin yo'q */
  await p.addInitScript(() => { try { const v = sessionStorage.getItem('acset'); if (v) { const d = JSON.parse(localStorage.getItem('xclient') || '{}'); const o = JSON.parse(v); d.acx = o[0]; d.acn = o[1]; delete d.token; localStorage.setItem('xclient', JSON.stringify(d)); } } catch (e) {} });
  const acct = async (acx, acn) => { await p.evaluate(v => sessionStorage.setItem('acset', JSON.stringify(v)), [acx, acn]); await p.reload(); await p.waitForTimeout(3500); return vis('#acct'); };
  const N = Date.now();
  ok(await acct(1, 0), 'akkaunt kartasi: eski yopilgan belgi bo\'lsa ham qayta ko\'rinadi');
  ok(!(await acct(N, 1)), 'yopilgandan keyin 5 kun ichida ko\'rinmaydi');
  ok(await acct(N - 6 * 864e5, 1), '6 kundan keyin yana ko\'rinadi');
  ok(!(await acct(N - 60 * 864e5, 3)), '3 marta yopilgandan keyin chiqmaydi');
  ok(!errs.length, 'JS xato yo\'q' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  console.log(res.join('\n')); const bad = res.filter(x => /^XATO/.test(x)).length;
  console.log((bad ? 'FAIL' : 'PASS') + ' upd (' + (res.length - bad) + '/' + res.length + ')');
  await b.close(); process.exit(bad ? 1 : 0);
})();
