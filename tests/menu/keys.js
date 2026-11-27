/* Tugmalar: tasodifiy bosish otish tugmasini olib ketmasin, buzilgan bindlar tiklansin, Shift/E/kirill, g'ildirak, tanlash ro'yxati */
const { page } = require('./lib');
(async () => {
  /* buzilgan holat: otish MOUSE1 "Ishlatish" ga o'tib ketgan, yurish tugmasi yo'q */
  const binds = { '+attack': '', '+use': 'MOUSE1', '+forward': '' };
  const { b, p, errs } = await page({ db: { token: process.env.XC_TOKEN, device: 'testdev0001', fx: 1, lang: 'uz', dnd: 0, tour: 1, wnSeen: 'x', tgAsk: Date.now(), tgAskN: 3, binds, set: { name: 'testa', tag: '' } }, wait: 2500 });
  const res = []; const ok = (c, m) => res.push((c ? 'ok  ' : 'XATO') + ' ' + m);
  const B = () => p.evaluate(() => JSON.parse(localStorage.getItem('xclient')).binds || {});
  let st = await B(), log = await p.evaluate(() => window.LOG.join('\n'));
  ok(st['+attack'] === 'MOUSE1' && st['+use'] === '' && /bind "?MOUSE1"? "?\+attack"?/.test(log), 'buzilgan otish tugmasi ochilishda MOUSE1 ga qaytdi');
  ok(st['+forward'] === 'w' && /bind "?w"? "?\+forward"?/.test(log), "yo'qolgan oldinga yurish W ga qaytdi");
  const clk = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  await clk('[data-act="settings"]'); await p.waitForTimeout(500); await clk('#mdSettings [data-tab="keys"]'); await p.waitForTimeout(400);
  const slot = async (a, n) => { await clk('[data-bind' + (n === 2 ? '2' : '') + '="' + a + '"]'); await p.waitForTimeout(150); };
  const md = (sel, btn) => p.evaluate(([s, bt]) => { const e = document.querySelector(s); e.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: bt })); }, [sel, btn]);
  /* 1) "tugmani bosing" holatida boshqa joyga chap bosish - bekor, otish joyida qoladi */
  await slot('+use'); await md('#mdSettings .ph2', 0); await p.waitForTimeout(200);
  st = await B(); ok(st['+attack'] === 'MOUSE1' && !(await p.$('.kpick')), "boshqa joyga chap bosish - bekor qilinadi, otish MOUSE1 da qoladi");
  /* 2) tanlash ro'yxati ko'rinadi va ekran ichida, MOUSE1/MOUSE2/SHIFT bor */
  await slot('+use');
  const kp = await p.evaluate(() => { const e = document.querySelector('.kpick'); if (!e) return null; const r = e.getBoundingClientRect(); return { t: e.textContent, in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.width > 200,
    keys: [...e.querySelectorAll('[data-pickkey]')].map(a => a.getAttribute('data-pickkey')) }; });
  ok(kp && kp.in, "tanlash ro'yxati ekranda to'liq ko'rinadi");
  ok(kp && ['MOUSE1', 'MOUSE2', 'SHIFT', 'CTRL', 'e'].every(k => kp.keys.includes(k)), "ro'yxatda MOUSE1, MOUSE2, SHIFT, CTRL, E bor");
  /* 3) Shift tugmasi bosilsa - Ishlatish = SHIFT, Sekin yurishdan olinadi va bu aytiladi */
  await p.keyboard.press('Shift'); await p.waitForTimeout(250);
  st = await B(); const tt = await p.evaluate(() => document.body.textContent);
  ok(st['+use'] === 'SHIFT' && st['+speed'] === '', "Shift bosilsa: Ishlatish = SHIFT (Sekin yurishdan olindi)");
  ok(/olindi/.test(tt), "qaysi vazifadan olingani aytiladi");
  /* 4) ro'yxatdan SHIFT tanlash ham ishlaydi */
  await slot('+speed'); await md('.kpick [data-pickkey="SHIFT"]', 0); await p.waitForTimeout(200);
  st = await B(); ok(st['+speed'] === 'SHIFT' && st['+use'] === '', "ro'yxatdan SHIFT tanlash ishlaydi");
  /* 5) E harfi: lotin, kirill (у), harf kodi bilan */
  await slot('+use'); await p.keyboard.press('e'); await p.waitForTimeout(200); st = await B(); ok(st['+use'] === 'e', 'E harfi (lotin)');
  await slot('+use'); await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, charCode: 1091, which: 1091 }))); await p.waitForTimeout(200);
  st = await B(); ok(st['+use'] === 'e', 'kirill klaviaturada У - E deb olinadi');
  /* 6) ro'yxatni g'ildirak bilan aylantirish bind bo'lmaydi; kutilayotgan tugma ustida - bo'ladi */
  await slot('+jump'); await p.evaluate(() => { const e = document.querySelector('#mdSettings .kcols'); e.dispatchEvent(new WheelEvent('mousewheel', { bubbles: true, cancelable: true, wheelDelta: -120 })); }); await p.waitForTimeout(200);
  st = await B(); ok(st['+jump'] === 'SPACE' || st['+jump'] === undefined, "ro'yxatni aylantirish - sakrashga g'ildirak qo'yilmadi");
  await p.evaluate(() => { const e = document.querySelector('[data-bind="+jump"]'); const ev = new Event('mousewheel', { bubbles: true, cancelable: true }); ev.wheelDelta = -120; e.dispatchEvent(ev); }); await p.waitForTimeout(200);
  st = await B(); ok(st['+jump'] === 'MWHEELDOWN', "kutilayotgan tugma ustida g'ildirak - MWHEELDOWN");
  /* 7) o'ng tugma - MOUSE2; ataylab otishni olib qo'ysa - ogohlantirish, keyingi ochilishda tiklanadi */
  await slot('+attack2'); await md('[data-bind="+attack2"]', 2); await p.waitForTimeout(150);
  await slot('xc_qs'); await md('.kpick [data-pickkey="MOUSE1"]', 0); await p.waitForTimeout(250);
  st = await B(); ok(st.xc_qs === 'MOUSE1' && st['+attack'] === '', 'ro\'yxatdan MOUSE1 boshqa vazifaga qo\'yilsa - otishdan olinadi');
  ok(/tugmasiz qoldi/.test(await p.evaluate(() => document.body.textContent)), "otish tugmasiz qolgani haqida ogohlantirish");
  await p.reload(); await p.waitForTimeout(2500); st = await B();
  ok(st['+attack'] === 'MOUSE1', 'qayta ochilganda otish yana MOUSE1');
  ok(!errs.length, 'JS xatolari yo\'q ' + errs.join(' | '));
  await b.close(); console.log('== Tugmalar'); res.forEach(r => console.log(r));
  process.exit(res.some(r => r.startsWith('XATO')) ? 1 : 0);
})();
