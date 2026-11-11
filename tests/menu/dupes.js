/* Statik tekshiruv: xc.js da bir xil nomli yuqori darajadagi funksiya/o'zgaruvchi (keyingisi oldingisini jimgina almashtiradi -
 * 10204500 da shunday bo'lib, menyu tezligi o'lchovi ishlamay qolgan); xc_api.php da takroriy case; lang kalitlari takrori */
const fs = require('fs'), path = require('path');
const X = path.join(__dirname, '../../theme/platform/xclient'), API = path.join(__dirname, '../../web/site/xc_api.php');
const js = fs.readFileSync(X + '/xc.js', 'utf8'), bad = [];
const names = {};
js.split('\n').forEach((l, i) => {
  let m = /^function ([A-Za-z_$][\w$]*)/.exec(l); if (m) (names[m[1]] = names[m[1]] || []).push(i + 1);
  m = /^var (.*)/.exec(l); if (m) m[1].split(',').forEach(p => { const n = /^\s*([A-Za-z_$][\w$]*)\s*(=|;|$)/.exec(p); if (n) (names[n[1]] = names[n[1]] || []).push(i + 1); });
});
for (const n in names) if (names[n].length > 1) bad.push('xc.js: "' + n + '" ' + names[n].length + ' marta (qatorlar ' + names[n].join(',') + ')');
const php = fs.readFileSync(API, 'utf8'), cs = {};
(php.match(/^case '[\w]+':/gm) || []).forEach(c => { cs[c] = (cs[c] || 0) + 1; });
for (const c in cs) if (cs[c] > 1) bad.push('xc_api.php: ' + c + ' ' + cs[c] + ' marta');
const lang = fs.readFileSync(X + '/xc_lang.js', 'utf8');
['uz', 'ru', 'en'].forEach(lg => { const line = lang.split('\n').find(l => l.startsWith('  ' + lg + ': {')) || ''; const k = {}; (line.match(/"([\w]+)"\s*:/g) || []).forEach(x => { k[x] = (k[x] || 0) + 1; });
  const d = Object.keys(k).filter(x => k[x] > 1); if (d.length > 40) bad.push('xc_lang.js ' + lg + ': ' + d.length + ' takror kalit'); });
console.log(bad.join('\n'));
console.log((bad.length ? 'FAIL' : 'PASS') + ' dupes (' + Object.keys(names).length + ' nom, ' + Object.keys(cs).length + ' case)');
process.exit(bad.length ? 1 : 0);
