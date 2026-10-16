/* X CLIENT — interfeys mantiqi */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const PINNED = ['157.22.130.26:27015'];

/* ------------------------------------------------------------ standart sozlamalar */
const ACTIONS = [
  ['k_move', [['+forward', 'w', 'Oldinga|Вперёд|Forward'], ['+back', 's', 'Orqaga|Назад|Back'], ['+moveleft', 'a', 'Chapga|Влево|Left'], ['+moveright', 'd', 'O‘ngga|Вправо|Right'],
    ['+jump', 'SPACE', 'Sakrash|Прыжок|Jump'], ['+duck', 'CTRL', 'O‘tirish|Присесть|Duck'], ['+speed', 'SHIFT', 'Sekin yurish|Тихий шаг|Walk']]],
  ['k_fight', [['+attack', 'MOUSE1', 'Otish|Огонь|Fire'], ['+attack2', 'MOUSE2', 'Qo‘shimcha rejim (zum)|Альт. режим (прицел)|Secondary (zoom)'], ['+reload', 'r', 'Qayta o‘qlash|Перезарядка|Reload'],
    ['drop', 'g', 'Qurolni tashlash|Выбросить оружие|Drop weapon'], ['+use', 'e', 'Ishlatish|Использовать|Use'], ['lastinv', 'q', 'Oxirgi qurol|Последнее оружие|Last weapon'],
    ['slot1', '1', 'Asosiy qurol|Основное оружие|Primary'], ['slot2', '2', 'Pistolet|Пистолет|Pistol'], ['slot3', '3', 'Pichoq|Нож|Knife'], ['slot4', '4', 'Granatalar|Гранаты|Grenades'], ['slot5', '5', 'Bomba|Бомба|Bomb'],
    ['nightvision', 'n', 'Tungi ko‘rish|Ночное видение|Night vision'], ['impulse 100', 'f', 'Fonar|Фонарик|Flashlight'], ['impulse 201', 't', 'Spray logotip|Спрей|Spray']]],
  ['k_buy', [['buy', 'b', 'Sotib olish menyusi|Меню покупки|Buy menu'], ['buyequip', 'o', 'Jihozlar|Снаряжение|Equipment'], ['buyammo1', ',', 'Asosiy o‘q|Патроны осн.|Primary ammo'],
    ['buyammo2', '.', 'Pistolet o‘qi|Патроны пист.|Secondary ammo'], ['chooseteam', 'm', 'Jamoa tanlash|Выбор команды|Choose team']]],
  ['k_talk', [['messagemode', 'y', 'Umumiy chat|Общий чат|Chat'], ['messagemode2', 'u', 'Jamoa chati|Командный чат|Team chat'], ['+voicerecord', 'k', 'Ovozli chat|Голосовой чат|Voice'],
    ['radio1', 'z', 'Radio 1|Радио 1|Radio 1'], ['radio2', 'x', 'Radio 2|Радио 2|Radio 2'], ['radio3', 'c', 'Radio 3|Радио 3|Radio 3']]],
  ['k_other', [['+showscores', 'TAB', 'Ochkolar jadvali|Таблица счёта|Scoreboard'], ['snapshot', 'F5', 'Skrinshot|Скриншот|Screenshot'], ['toggleconsole', '`', 'Konsol|Консоль|Console']]],
];
const BUY = [['F1', 'b1', 'ak47;m4a1;vesthelm;hegren;flash;flash;sgren'], ['F2', 'b2', 'awp;vesthelm;deagle;secammo'], ['F3', 'b3', 'vest;deagle;secammo'], ['F4', 'b4', 'hegren;flash;flash;sgren']];
const XPRE = [{ size: 6, thick: 2, gap: 3, pad: 1, dot: 0, t: 0 }, { size: 4, thick: 1, gap: 2, pad: 1, dot: 0, t: 0 }, { size: 0, thick: 2, gap: 0, pad: 1, dot: 1, t: 0 }, { size: 6, thick: 2, gap: 3, pad: 1, dot: 0, t: 1 }, { size: 12, thick: 1, gap: 4, pad: 0, dot: 0, t: 0 }];
const COLORS = ['255 59 59', '126 227 90', '0 229 255', '255 210 74', '255 90 209', '255 255 255'];

function defaults() {
  const binds = {};
  ACTIONS.forEach(([, list]) => list.forEach(([cmd, key]) => (binds[cmd] = key)));
  return {
    lang: 'uz', name: 'Player', tag: 'X | ', net: 'fast', dl: 1, spray: 1, closeAfter: 0,
    binds, buyKeys: 1,
    sens: 2.5, zoom: 1.0, raw: 1, filter: 0, inv: 0, dpi: 800,
    vol: 0.8, mus: 0, voiceOn: 1, voice: 0.8, mute: 1,
    fps: 'max', res: '0x0', windowed: 0, fpsMax: 300, vsync: 0, gamma: 2.5,
    x: { size: 6, thick: 2, gap: 3, pad: 1, alpha: 255, color: '255 59 59', dot: 0, t: 0, dyn: 0 },
    hudScale: 0, netgraph: 0, fastswitch: 1,
    favs: [], hist: [],
  };
}
let S = defaults();
let L = I18N.uz;
const t = (k) => (L[k] != null ? L[k] : I18N.uz[k] != null ? I18N.uz[k] : k);
const actName = (s) => { const p = s.split('|'); return S.lang === 'ru' ? p[1] : S.lang === 'en' ? p[2] : p[0]; };

function applyLang() {
  L = I18N[S.lang] || I18N.uz;
  $$('[data-t]').forEach((el) => { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v; });
  $$('[data-tp]').forEach((el) => (el.placeholder = t(el.dataset.tp)));
}

/* ------------------------------------------------------------ yordamchilar */
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => (el.style.display = 'none'), 2600); }
function prompt2(text, val = '') {
  return new Promise((res) => {
    const m = $('#modal'); $('#mText').textContent = text; const i = $('#mInput'); i.value = val; m.classList.add('on'); i.focus();
    const done = (v) => { m.classList.remove('on'); $('#mYes').onclick = $('#mNo').onclick = i.onkeydown = null; res(v); };
    $('#mYes').onclick = () => done(i.value.trim()); $('#mNo').onclick = () => done(null);
    i.onkeydown = (e) => { if (e.key === 'Enter') done(i.value.trim()); if (e.key === 'Escape') done(null); };
  });
}
function show(id) { $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
async function persist() { await window.xc.store.set(S); await window.xc.writeCfg(buildCfg()); }

/* ------------------------------------------------------------ o'yin config */
function buildCfg() {
  const net = { slow: [25000, 60, 60], mid: [50000, 101, 101], fast: [100000, 101, 105] }[S.net] || [100000, 101, 105];
  const x = S.x;
  const L = [
    '// X CLIENT tomonidan yoziladi — qo‘lda o‘zgartirmang',
    `exec xc_fps_${S.fps}.cfg`,
    `name "${(S.tag + S.name).replace(/"/g, '').slice(0, 31)}"`,
    `rate "${net[0]}"`, `cl_updaterate "${net[1]}"`, `cl_cmdrate "${net[2]}"`, 'ex_interp "0.01"', 'cl_lw "1"', 'cl_lc "1"',
    `cl_allowdownload "${S.dl}"`, `cl_download_ingame "${S.dl}"`, `cl_allowupload "${S.spray}"`,
    `sensitivity "${S.sens}"`, `zoom_sensitivity_ratio "${S.zoom}"`, `m_rawinput "${S.raw}"`, `m_filter "${S.filter}"`, `m_pitch "${S.inv ? -0.022 : 0.022}"`,
    `volume "${S.vol}"`, `MP3Volume "${S.mus}"`, `voice_enable "${S.voiceOn}"`, `voice_scale "${S.voice}"`, `snd_mute_losefocus "${S.mute}"`,
    `fps_max "${S.fpsMax}"`, `gl_vsync "${S.vsync}"`, `gamma "${S.gamma}"`,
    'xhair_enable "1"', `xhair_size "${x.size}"`, `xhair_thick "${x.thick}"`, `xhair_gap "${x.gap}"`, `xhair_pad "${x.pad}"`, `xhair_dot "${x.dot}"`, `xhair_t "${x.t}"`,
    `xhair_color "${x.color} ${x.alpha}"`, `xhair_dynamic_move "${x.dyn}"`, `cl_dynamiccrosshair "${x.dyn}"`,
    `hud_scale "${S.hudScale}"`, `net_graph "${S.netgraph ? 1 : 0}"`, `hud_fastswitch "${S.fastswitch}"`, 'scr_drawversion "0"',
  ];
  Object.entries(S.binds).forEach(([cmd, key]) => { if (key) L.push(`bind "${key === '"' ? "'" : key}" "${cmd}"`); });
  if (S.buyKeys) BUY.forEach(([k, , cmd]) => L.push(`bind "${k}" "${cmd}"`));
  return L.join('\n') + '\n';
}

/* ------------------------------------------------------------ serverlar */
const SRV = new Map();     // addr -> info
let srvTab = 'net', sel = null, filters = { ping: false, notempty: false, notfull: false }, lanList = new Map(), scanning = false;

function pc(p) { return p < 50 ? 'p1' : p < 100 ? 'p2' : 'p3'; }
function srvRow(r, extra) {
  const fav = S.favs.includes(r.addr);
  const fill = r.max ? Math.round((r.players / r.max) * 100) : 0;
  const pin = r.pinned || PINNED.includes(r.addr);
  return `<tr data-a="${esc(r.addr)}" class="${sel === r.addr ? 'sel' : ''}"><td class="${fav ? 'st1' : 'st0'} fv">★</td>
    <td class="nm">${esc(r.name || r.addr)}${pin ? '<span class="xb">X</span><span class="vipb">VIP</span>' : ''}</td>
    <td>${r.max != null ? `<span class="pg"><i style="width:${fill}%"></i></span>${r.players}/${r.max}` : '—'}</td>
    <td>${esc(r.map || '—')}</td><td class="${r.ping != null ? pc(r.ping) : 'mut'}">${r.ping != null ? '● ' + r.ping : '—'}</td><td class="mut">${extra || ''}</td></tr>`;
}
function listFor(tab) {
  let arr;
  if (tab === 'net') arr = [...SRV.values()];
  else if (tab === 'fav') arr = S.favs.map((a) => SRV.get(a) || { addr: a });
  else if (tab === 'hist') arr = S.hist.map((h) => Object.assign({}, SRV.get(h.addr) || { addr: h.addr, name: h.name }, { _when: h.when }));
  else if (tab === 'xtop') arr = [...SRV.values()].filter((r) => r.pinned || PINNED.includes(r.addr) || r.players > 0).sort((a, b) => (b.pinned - a.pinned) || (b.players - a.players)).slice(0, 30);
  else if (tab === 'lan') arr = [...lanList.values()];
  else arr = [];
  const q = $('#fSearch').value.trim().toLowerCase();
  if (q) arr = arr.filter((r) => (r.name || '').toLowerCase().includes(q) || r.addr.includes(q) || (r.map || '').toLowerCase().includes(q));
  if (tab === 'net') {
    if (filters.ping) arr = arr.filter((r) => r.ping < 50);
    if (filters.notempty) arr = arr.filter((r) => r.players > 0);
    if (filters.notfull) arr = arr.filter((r) => r.players < r.max);
    arr.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.players - a.players) || (a.ping - b.ping));
  }
  return arr;
}
function renderServers() {
  const arr = listFor(srvTab);
  $('#cExtra').textContent = srvTab === 'hist' ? t('c_last') : '';
  const fmt = (ts) => { const d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toTimeString().slice(0, 5); };
  $('#srvTable tbody').innerHTML = arr.map((r) => srvRow(r, r._when ? fmt(r._when) : '')).join('');
  const em = $('#srvEmpty');
  const msg = srvTab === 'friends' ? t('friends_soon') : srvTab === 'fav' ? t('no_fav') : srvTab === 'hist' ? t('no_hist') : srvTab === 'lan' ? (scanning ? t('lan_search') : t('lan_none')) : scanning ? t('loading') : t('no_srv');
  em.textContent = msg; em.style.display = arr.length ? 'none' : 'block';
  $('#favCnt').textContent = S.favs.length ? `(${S.favs.length})` : '';
  const all = [...SRV.values()], pl = all.reduce((s, r) => s + (r.players || 0), 0);
  $('#srvFoot').textContent = t('srv_found').replace('{n}', all.length).replace('{p}', pl);
  $('#srvFilters').style.visibility = srvTab === 'friends' ? 'hidden' : 'visible';
  $('#favBtn').lastElementChild.textContent = sel && S.favs.includes(sel) ? t('un_fav') : t('to_fav');
}
async function selectServer(addr) {
  sel = addr; renderServers();
  const r = SRV.get(addr) || lanList.get(addr) || { addr };
  $('#dName').textContent = r.name || addr; $('#dAddr').textContent = addr; $('#dMap').textContent = r.map || '—';
  $('#dPl').textContent = r.max != null ? `${r.players}/${r.max}` : '–'; $('#dPing').textContent = r.ping != null ? `● ${r.ping} ms` : '';
  $('#dList').innerHTML = `<div class="mut">${t('loading')}</div>`;
  const q = await window.xc.query(addr, true);
  if (sel !== addr) return;
  if (q.ok) {
    Object.assign(r, q); if (!SRV.has(addr) && !lanList.has(addr)) SRV.set(addr, r);
    $('#dName').textContent = q.name; $('#dMap').textContent = q.map; $('#dPl').textContent = `${q.players}/${q.max}`; $('#dPing').textContent = `● ${q.ping} ms`;
    $('#dList').innerHTML = (q.list || []).slice(0, 14).map((p) => `<div class="pl"><span>${esc(p.name)}</span><span class="mut">${p.score}</span></div>`).join('') || '<div class="mut">—</div>';
  } else $('#dList').innerHTML = '<div class="mut">offline</div>';
}
async function scan() {
  if (scanning) return; scanning = true; renderServers();
  const list = await window.xc.msList();
  await window.xc.queryMany(list);
  scanning = false; renderServers(); renderHome();
}
window.xc.onServer((r) => { SRV.set(r.addr, Object.assign(SRV.get(r.addr) || {}, r)); if ($('#servers').classList.contains('on')) throttledRender(); renderHome(); });
window.xc.onLan((r) => { lanList.set(r.addr, r); if (srvTab === 'lan') renderServers(); });
let rT; function throttledRender() { if (rT) return; rT = setTimeout(() => { rT = null; renderServers(); }, 300); }

async function join(addr) {
  if (!addr) return;
  const r = SRV.get(addr) || lanList.get(addr) || {};
  S.hist = [{ addr, name: r.name || addr, when: Date.now() }, ...S.hist.filter((h) => h.addr !== addr)].slice(0, 50);
  await persist();
  launch({ connect: addr });
}
async function launch(extra) {
  const info = await window.xc.info();
  if (!info.hasGame) { toast(t('no_game')); return; }
  const [w, h] = S.res.split('x').map(Number);
  toast(t('launching'));
  const res = await window.xc.launch(Object.assign({ width: w || 0, height: h || 0, windowed: !!S.windowed, closeAfter: !!S.closeAfter }, extra));
  if (res !== true) toast(String(res));
}
function bestServer() {
  const all = [...SRV.values()].filter((r) => r.players < r.max);
  const pin = all.filter((r) => r.pinned || PINNED.includes(r.addr)).sort((a, b) => b.players - a.players)[0];
  if (pin) return pin;
  return all.filter((r) => r.players > 0).sort((a, b) => (a.ping - b.ping) || (b.players - a.players))[0] || [...SRV.values()][0];
}

/* ------------------------------------------------------------ bosh sahifa */
function renderHome() {
  const all = [...SRV.values()];
  const pl = all.reduce((s, r) => s + (r.players || 0), 0);
  $('#stOnline').textContent = all.length ? pl : '–'; $('#stSrv').textContent = all.length || '–';
  $('#mOnline').textContent = all.length ? `${pl} ${t('online').toLowerCase()}` : '';
  const main = SRV.get(PINNED[0]) || bestServer();
  if (main) { $('#playSrv').textContent = `${main.name || main.addr} · ${main.map || ''} · ${main.players != null ? main.players + '/' + main.max : ''}`; $('#playPing').textContent = main.ping != null ? main.ping : '–'; }
  const top = all.slice().sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.players - a.players)).slice(0, 5);
  $('#topList').innerHTML = top.length ? top.map((r, i) => `<div class="row" data-a="${esc(r.addr)}"><span class="av">${i + 1}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}<br><span class="gr" style="font-size:12px">● ${esc(r.map)}</span></span><span>${r.players}/${r.max}</span></div>`).join('') : `<div class="row mut">${scanning ? t('loading') : t('no_srv')}</div>`;
  $('#meName').textContent = S.name; $('#meAv').textContent = (S.name[0] || 'X').toUpperCase(); $('#meTag').textContent = S.tag.trim();
}

/* ------------------------------------------------------------ sozlamalar */
let setTab = 'game', waitKey = null;
const row = (label, ctl, sub) => `<div class="srow"><label>${label}${sub ? `<small>${sub}</small>` : ''}</label>${ctl}</div>`;
const tg = (key, label, sub) => `<div class="srow tg"><label>${label}${sub ? `<small>${sub}</small>` : ''}</label><span class="tgl ${getK(key) ? 'on' : ''}" data-tg="${key}"></span></div>`;
const sl = (key, min, max, step, label, sub, fmt) => row(label, `<input type="range" data-sl="${key}" min="${min}" max="${max}" step="${step}" value="${getK(key)}"><span class="val" data-v="${key}">${fmt ? fmt(getK(key)) : getK(key)}</span>`, sub);
function paintRange(el) { const p = ((el.value - el.min) / (el.max - el.min)) * 100; el.style.background = `linear-gradient(90deg,#b3161c,#ff3b3b ${p}%,#2c2226 ${p}%)`; }
function getK(k) { return k.split('.').reduce((o, p) => o[p], S); }
function setK(k, v) { const p = k.split('.'); const last = p.pop(); p.reduce((o, q) => o[q], S)[last] = v; }
const FMT = { vol: (v) => Math.round(v * 100) + '%', mus: (v) => Math.round(v * 100) + '%', voice: (v) => Math.round(v * 100) + '%', hudScale: (v) => (+v ? v + 'x' : 'Avto') };

function renderSettings() {
  const P = $('#setPane');
  $('#setFoot').textContent = '';
  const T = {
    game: () => `<div class="card p"><div class="h">${t('g_player')}</div>
      ${row(t('g_name'), `<input class="inp" style="flex:1" data-in="name" maxlength="24" value="${esc(S.name)}">`)}
      ${row(t('g_tag'), `<div class="opts">${['X | ', '[UZ] ', ''].map((v) => `<span class="opt ${S.tag === v ? 'on' : ''}" data-tag="${esc(v)}">${v ? esc(v.trim()) : t('g_none')}</span>`).join('')}</div>`)}
      <div class="h" style="margin-top:18px">${t('g_net')}</div>
      <div class="opts">${['slow', 'mid', 'fast'].map((n) => `<div class="opt ${S.net === n ? 'on' : ''}" data-net="${n}" style="flex:1"><b>${t('net_' + n)}</b><small>${t('net_' + n + '_d')}</small></div>`).join('')}</div>
      <div class="mut" style="margin-top:8px;font-size:13px">${t('net_note')}</div></div>
      <div class="card p"><div class="h">${t('g_server')}</div>${tg('dl', t('dl'))}${tg('spray', t('spray_dl'))}
      <div class="h" style="margin-top:18px">${t('g_after')}</div>${tg('closeAfter', t('close_after'))}
      <div style="margin-top:14px;display:flex;gap:10px"><span class="btn" data-folder="demo">${t('f_demo')}</span><span class="btn" data-folder="screenshots">${t('f_shots')}</span></div></div>`,
    keys: () => `<div class="card p" style="overflow:auto"><div class="mut" style="font-size:13px;margin-bottom:6px">${t('k_hint')}</div>
      ${ACTIONS.map(([g, list]) => `<div class="grp">${t(g)}</div>` + list.map(([cmd, , nm]) => `<div class="bind"><span>${esc(actName(nm))}</span><span class="key ${waitKey === cmd ? 'wait' : ''}" data-key="${esc(cmd)}">${waitKey === cmd ? t('k_press') : esc(S.binds[cmd] || '—')}</span></div>`).join('')).join('')}</div>
      <div class="card p"><div class="srow tg"><label><b class="h" style="margin:0">${t('k_buykeys')}</b></label><span class="tgl ${S.buyKeys ? 'on' : ''}" data-tg="buyKeys"></span></div>
      ${BUY.map(([k, d, cmd]) => `<div class="bind" style="opacity:${S.buyKeys ? 1 : .4}"><span class="key">${k}</span><span style="flex:1">${t(d)}</span></div>`).join('')}</div>`,
    mouse: () => `<div class="card p"><div class="h">${t('ms_sens').toUpperCase()}</div>
      ${sl('sens', 0.1, 10, 0.05, t('ms_sens'))}${sl('zoom', 0.1, 3, 0.05, t('ms_zoom'), t('ms_zoom_d'))}
      ${tg('raw', t('ms_raw'), t('ms_raw_d'))}${tg('filter', t('ms_filter'))}${tg('inv', t('ms_inv'))}
      <div class="h" style="margin-top:18px">${t('edpi').toUpperCase()}</div>
      ${row(t('dpi'), `<input class="inp" style="width:100px" data-in="dpi" value="${S.dpi}"><span>eDPI = <b class="rd" id="edpi">${Math.round(S.dpi * S.sens)}</b></span>`)}</div>
      <div class="card p" style="flex:.85"><div class="h">${t('ms_test')}</div><div class="mut" style="font-size:13px;margin-bottom:8px">${t('ms_test_d')}</div>
      <div class="pad" id="pad"></div><div style="display:flex;justify-content:space-between;margin-top:12px;font-size:14px"><span>${t('ms_res')}: <b class="gr" id="padRes">0 / 0</b></span><span>${t('ms_avg')}: <b id="padAvg">–</b></span></div>
      <div style="margin-top:12px"><span class="btn r" id="padGo" style="width:100%">${t('ms_start')}</span></div></div>`,
    sound: () => `<div class="card p"><div class="h">${t('s_sound').toUpperCase()}</div>
      ${sl('vol', 0, 1, 0.05, t('sd_vol'), '', FMT.vol)}${sl('mus', 0, 1, 0.05, t('sd_mus'), '', FMT.mus)}${sl('voice', 0, 1, 0.05, t('sd_voice'), '', FMT.voice)}
      ${tg('voiceOn', t('sd_voice_on'))}${tg('mute', t('sd_mute'))}</div><div class="card p" style="flex:.6"></div>`,
    video: () => `<div style="flex:1;display:flex;flex-direction:column;gap:16px"><div class="card p" style="flex:none"><div class="h">${t('v_mode')}</div><div style="display:flex;gap:12px">
      ${[['low', '🐢', '120'], ['max', '⚡', '300'], ['balanced', '⚖', '200'], ['pretty', '🎨', '144']].map(([m, ic, f]) => {
        const key = { low: 'v_low', max: 'v_max', balanced: 'v_bal', pretty: 'v_pretty' }[m];
        return `<div class="mode ${S.fps === m ? 'on' : ''}" data-fps="${m}" data-fpsmax="${f}"><div class="${S.fps === m ? 'rd' : 'mut'}">${S.fps === m ? '●' : '○'}</div><div class="big">${ic} ${t(key)}</div><div class="mut" style="font-size:13px">${t(key + '_d')}</div><div class="fps ${S.fps === m ? 'gr' : ''}">${f} FPS</div></div>`;
      }).join('')}</div></div>
      <div class="card p"><div class="h">${t('v_screen')}</div>
      ${row(t('v_res'), `<select data-sel="res">${['0x0|Avto', '800x600', '1024x768', '1280x720', '1280x960', '1366x768', '1600x900', '1920x1080', '2560x1440'].map((o) => { const [v, n] = o.split('|'); return `<option value="${v}" ${S.res === v ? 'selected' : ''}>${n || v.replace('x', '×')}</option>`; }).join('')}</select>`)}
      ${tg('windowed', t('v_win'))}${sl('fpsMax', 60, 1000, 10, t('v_fps'))}${tg('vsync', t('v_vsync'))}${sl('gamma', 1.8, 3.0, 0.05, t('v_gamma'))}</div></div>`,
    hud: () => `<div class="card p" style="flex:1.15"><div class="h">${t('x_title')}</div>
      <div style="display:flex;gap:14px"><canvas class="xpre" id="xpre" width="250" height="170"></canvas><div style="flex:1;display:flex;flex-direction:column;gap:6px">
      ${t('x_pre').map((n, i) => `<div class="opt" data-xp="${i}">${esc(n)}</div>`).join('')}</div></div>
      ${sl('x.size', 0, 20, 1, t('x_size'))}${sl('x.thick', 0, 10, 1, t('x_thick'))}${sl('x.gap', 0, 20, 1, t('x_gap'))}${sl('x.pad', 0, 3, 1, t('x_pad'))}${sl('x.alpha', 30, 255, 5, t('x_alpha'))}
      ${row(t('x_color'), COLORS.map((c) => `<span class="sw ${S.x.color === c ? 'on' : ''}" data-col="${c}" style="background:rgb(${c.split(' ').join(',')})"></span>`).join(''))}
      ${tg('x.dot', t('x_dot'))}${tg('x.t', t('x_t'))}${tg('x.dyn', t('x_dyn'))}
      ${row(t('x_code'), `<span class="val" style="width:auto;flex:1;justify-content:flex-start;padding:0 10px;font-family:Consolas,monospace;color:#ff5a5a" id="xcode">${xCode()}</span><span class="btn" id="xcopy">${t('x_copy')}</span><span class="btn" id="xpaste">${t('x_paste')}</span>`)}</div>
      <div class="card p"><div class="h">${t('hud_t')}</div>${sl('hudScale', 0, 3, 0.25, t('hud_scale'), '', FMT.hudScale)}${tg('netgraph', t('netgraph'))}${tg('fastswitch', t('fastswitch'))}</div>`,
    acc: () => `<div class="card p" style="text-align:center"><div class="h" style="text-align:left">${t('acc_t')}</div>
      <div style="width:110px;height:110px;margin:6px auto 12px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 0 3px #ff9a8a,0 0 24px rgba(255,59,59,.5);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold">${esc((S.name[0] || 'X').toUpperCase())}</div>
      <div style="font-size:24px">${esc(S.tag + S.name)}</div><p class="mut" style="max-width:420px;margin:18px auto;line-height:1.6">${t('acc_soon')}</p>
      <span class="btn r" data-url="https://boost-top.com">${t('acc_site')}</span></div>`,
    sys: () => `<div class="card p"><div class="h">${t('sys_lang')}</div><div class="langs">
      ${LANGS.map(([c, cc, n, col]) => { const ok = !!I18N[c]; return `<div class="lang ${S.lang === c ? 'on' : ''} ${ok ? '' : 'dis'}" ${ok ? `data-lang="${c}"` : ''}><span class="cc" style="background:${col}">${cc}</span><span style="flex:1">${n}</span>${S.lang === c ? '<span class="rd">✓</span>' : ok ? '' : `<span class="mut" style="font-size:12px">${t('lang_soon')}</span>`}</div>`; }).join('')}</div></div>
      <div class="card p"><div class="h">${t('sys_upd')}</div><div class="opt" style="display:flex;justify-content:space-between"><span>${t('sys_ver')} <b id="verB"></b></span><span class="gr">✓</span></div>
      <div class="mut" style="margin-top:10px;font-size:13px">${t('sys_upd_d')}</div>
      <div class="h" style="margin-top:22px">${t('sys_folders')}</div><div style="display:flex;gap:10px"><span class="btn" data-folder="screenshots">${t('f_shots')}</span><span class="btn" data-folder="demo">${t('f_demo')}</span></div></div>`,
  };
  P.innerHTML = T[setTab]();
  $$('input[type=range]', P).forEach(paintRange);
  if (setTab === 'hud') drawX();
  if (setTab === 'sys') window.xc.info().then((i) => { const b = $('#verB'); if (b) b.textContent = i.version; });
}
function xCode() { const x = S.x; return `X-${x.size}-${x.thick}-${x.gap}-${x.pad}-${x.dot}${x.t}${x.dyn}-${x.color.split(' ').map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase()}-${x.alpha}`; }
function parseCode(c) {
  const m = String(c).trim().match(/^X-(\d+)-(\d+)-(\d+)-(\d)-([01])([01])([01])-([0-9a-f]{6})-(\d+)$/i);
  if (!m) return null;
  const h = m[8]; const col = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(' ');
  return { size: clamp(+m[1], 0, 20), thick: clamp(+m[2], 0, 10), gap: clamp(+m[3], 0, 20), pad: clamp(+m[4], 0, 3), dot: +m[5], t: +m[6], dyn: +m[7], color: col, alpha: clamp(+m[9], 30, 255) };
}
function drawX() {
  const c = $('#xpre'); if (!c) return; const g = c.getContext('2d'), x = S.x, W = c.width, H = c.height, cx = W / 2 | 0, cy = H / 2 | 0;
  g.clearRect(0, 0, W, H);
  const k = 1.6, th = Math.max(1, x.thick * k || k), sz = x.size * k, gp = x.gap * k, col = `rgba(${x.color.split(' ').join(',')},${x.alpha / 255})`;
  const rects = [];
  if (sz > 0) { rects.push([cx - gp - sz, cy - th / 2, sz, th], [cx + gp, cy - th / 2, sz, th], [cx - th / 2, cy + gp, th, sz]); if (!x.t) rects.push([cx - th / 2, cy - gp - sz, th, sz]); }
  if (x.dot) rects.push([cx - th / 2, cy - th / 2, th, th]);
  if (x.pad) { g.fillStyle = 'rgba(0,0,0,.9)'; rects.forEach(([a, b, w, h]) => g.fillRect(a - x.pad, b - x.pad, w + x.pad * 2, h + x.pad * 2)); }
  g.fillStyle = col; rects.forEach(([a, b, w, h]) => g.fillRect(a, b, w, h));
  const code = $('#xcode'); if (code) code.textContent = xCode();
}

/* key names (GoldSrc) */
function keyName(e) {
  const map = { ' ': 'SPACE', Control: 'CTRL', Shift: 'SHIFT', Alt: 'ALT', Tab: 'TAB', Enter: 'ENTER', Backspace: 'BACKSPACE', ArrowUp: 'UPARROW', ArrowDown: 'DOWNARROW', ArrowLeft: 'LEFTARROW', ArrowRight: 'RIGHTARROW',
    Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN', CapsLock: 'CAPSLOCK', ';': 'SEMICOLON', Pause: 'PAUSE' };
  if (e.code && e.code.startsWith('Numpad')) { const n = e.code.slice(6); const kp = { 0: 'KP_INS', 1: 'KP_END', 2: 'KP_DOWNARROW', 3: 'KP_PGDN', 4: 'KP_LEFTARROW', 5: 'KP_5', 6: 'KP_RIGHTARROW', 7: 'KP_HOME', 8: 'KP_UPARROW', 9: 'KP_PGUP', Enter: 'KP_ENTER', Add: 'KP_PLUS', Subtract: 'KP_MINUS', Multiply: '*', Divide: 'KP_SLASH', Decimal: 'KP_DEL' }; return kp[n] || null; }
  if (map[e.key]) return map[e.key];
  if (/^F\d{1,2}$/.test(e.key)) return e.key;
  if (e.key.length === 1) return e.key.toLowerCase();
  return null;
}
function assignKey(name) {
  if (!waitKey || !name) return;
  Object.keys(S.binds).forEach((c) => { if (S.binds[c] === name && c !== waitKey) S.binds[c] = ''; });
  S.binds[waitKey] = name; waitKey = null; renderSettings();
}
document.addEventListener('keydown', (e) => {
  if (!waitKey) return; e.preventDefault();
  if (e.key === 'Escape') { waitKey = null; renderSettings(); return; }
  assignKey(keyName(e));
}, true);
document.addEventListener('mousedown', (e) => {
  if (!waitKey || e.target.closest('[data-key]')) return; e.preventDefault();
  assignKey(['MOUSE1', 'MOUSE3', 'MOUSE2', 'MOUSE4', 'MOUSE5'][e.button]);
}, true);
document.addEventListener('wheel', (e) => { if (waitKey) { e.preventDefault(); assignKey(e.deltaY < 0 ? 'MWHEELUP' : 'MWHEELDOWN'); } }, { passive: false, capture: true });

/* mouse test */
let pad = null;
function padStart() {
  const el = $('#pad'); if (!el) return;
  pad = { hits: 0, n: 0, times: [], t: 0 };
  const next = () => {
    if (pad.n >= 20) { $('#padGo').textContent = t('ms_start'); return; }
    el.innerHTML = ''; const d = document.createElement('span'); d.className = 'tg';
    d.style.left = 8 + Math.random() * 84 + '%'; d.style.top = 10 + Math.random() * 80 + '%'; el.appendChild(d); pad.t = performance.now(); pad.n++;
  };
  el.onmousedown = (e) => {
    if (!pad || !el.firstChild) return;
    if (e.target.classList.contains('tg')) { pad.hits++; pad.times.push(performance.now() - pad.t); }
    $('#padRes').textContent = `${pad.hits} / ${pad.n}`;
    $('#padAvg').textContent = pad.times.length ? (pad.times.reduce((a, b) => a + b, 0) / pad.times.length / 1000).toFixed(2) + ' s' : '–';
    next();
  };
  next();
}

/* ------------------------------------------------------------ hodisalar */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act],[data-close],[data-tab],[data-tg],[data-tag],[data-net],[data-fps],[data-xp],[data-col],[data-lang],[data-key],[data-folder],[data-url],[data-f],[data-a],#playBtn,#bMin,#bClose');
  if (!el) return;
  if (el.id === 'bMin') return window.xc.min();
  if (el.id === 'bClose') return window.xc.close();
  if (el.id === 'playBtn') { const b = SRV.get(PINNED[0]) || bestServer(); return b ? join(b.addr) : launch({}); }
  if (el.dataset.act) {
    const a = el.dataset.act;
    if (a === 'quick') { const b = bestServer(); return b ? join(b.addr) : (show('servers'), scan()); }
    if (a === 'servers' || a === 'xtop') { srvTab = a === 'xtop' ? 'xtop' : 'net'; $$('#srvTabs .tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === srvTab)); show('servers'); renderServers(); if (!SRV.size) scan(); return; }
    if (a === 'settings') { show('settings'); renderSettings(); return; }
    if (a === 'bots') { show('bots'); return; }
    if (a === 'quit') return window.xc.close();
  }
  if (el.hasAttribute('data-close')) { if (el.closest('#settings')) { S = Object.assign(defaults(), await window.xc.store.get()); applyLang(); } show('home'); renderHome(); return; }
  if (el.dataset.a && el.closest('#topList')) return join(el.dataset.a);
  if (el.dataset.a && el.closest('#srvTable')) {
    if (e.target.classList.contains('fv')) { const a = el.dataset.a; S.favs = S.favs.includes(a) ? S.favs.filter((x) => x !== a) : [...S.favs, a]; await window.xc.store.set(S); renderServers(); return; }
    return selectServer(el.dataset.a);
  }
  if (el.dataset.tab) {
    const box = el.parentElement; $$('.tab', box).forEach((x) => x.classList.toggle('on', x === el));
    if (box.id === 'srvTabs') { srvTab = el.dataset.tab; renderServers(); if (srvTab === 'lan') { lanList.clear(); scanning = true; renderServers(); await window.xc.lan(); setTimeout(() => { scanning = false; renderServers(); }, 2600); } else if (!SRV.size) scan(); }
    else { setTab = el.dataset.tab; waitKey = null; renderSettings(); }
    return;
  }
  if (el.dataset.f) { filters[el.dataset.f] = !filters[el.dataset.f]; el.classList.toggle('on', filters[el.dataset.f]); renderServers(); return; }
  if (el.dataset.tg) { setK(el.dataset.tg, getK(el.dataset.tg) ? 0 : 1); renderSettings(); return; }
  if (el.dataset.tag != null && el.closest('#setPane')) { S.tag = el.dataset.tag; renderSettings(); return; }
  if (el.dataset.net) { S.net = el.dataset.net; renderSettings(); return; }
  if (el.dataset.fps) { S.fps = el.dataset.fps; S.fpsMax = +el.dataset.fpsmax; renderSettings(); return; }
  if (el.dataset.xp) { Object.assign(S.x, XPRE[+el.dataset.xp]); renderSettings(); return; }
  if (el.dataset.col) { S.x.color = el.dataset.col; renderSettings(); return; }
  if (el.dataset.lang) { S.lang = el.dataset.lang; applyLang(); renderSettings(); return; }
  if (el.dataset.key && el.closest('#setPane') && S.binds[el.dataset.key] !== undefined) { waitKey = el.dataset.key; renderSettings(); return; }
  if (el.dataset.folder) return window.xc.openFolder(el.dataset.folder);
  if (el.dataset.url) return window.xc.openUrl(el.dataset.url);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.type === 'range') paintRange(el);
  if (el.dataset.sl) { setK(el.dataset.sl, +el.value); const v = $(`[data-v="${el.dataset.sl}"]`); const f = FMT[el.dataset.sl]; if (v) v.textContent = f ? f(+el.value) : el.value; if (el.dataset.sl.startsWith('x.')) drawX(); if (el.dataset.sl === 'sens') { const ed = $('#edpi'); if (ed) ed.textContent = Math.round(S.dpi * S.sens); } }
  if (el.dataset.in === 'name') S.name = el.value.replace(/["\\;]/g, '').slice(0, 24) || 'Player';
  if (el.dataset.in === 'dpi') { S.dpi = parseInt(el.value, 10) || 800; const ed = $('#edpi'); if (ed) ed.textContent = Math.round(S.dpi * S.sens); }
  if (el.id === 'fSearch') renderServers();
});
document.addEventListener('change', (e) => { if (e.target.dataset.sel) setK(e.target.dataset.sel, e.target.value); });

$('#setSave').onclick = async () => { await persist(); toast(t('saved')); $('#stSaved').textContent = t('saved_bar'); renderHome(); };
$('#setDef').onclick = () => { const keep = { favs: S.favs, hist: S.hist, lang: S.lang, name: S.name }; S = Object.assign(defaults(), keep); renderSettings(); };
$('#setPane').addEventListener('click', (e) => {
  if (e.target.id === 'padGo') padStart();
  if (e.target.id === 'xcopy') { navigator.clipboard.writeText(xCode()).then(() => toast(t('x_copied'))); }
  if (e.target.id === 'xpaste') prompt2(t('x_code')).then((v) => { if (v == null) return; const p = parseCode(v); if (!p) return toast(t('x_bad')); Object.assign(S.x, p); renderSettings(); });
});
$('#refBtn').onclick = () => { if (srvTab === 'lan') { $$('#srvTabs .tab').find((x) => x.dataset.tab === 'lan').click(); } else { SRV.clear(); renderServers(); scan(); } };
$('#joinBtn').onclick = () => join(sel);
$('#quickBtn').onclick = () => { const b = bestServer(); if (b) join(b.addr); };
$('#favBtn').onclick = async () => { if (!sel) return; S.favs = S.favs.includes(sel) ? S.favs.filter((x) => x !== sel) : [...S.favs, sel]; await window.xc.store.set(S); renderServers(); };
$('#addIp').onclick = async () => {
  const v = await prompt2(t('ip_prompt')); if (!v) return;
  const a = /:\d+$/.test(v) ? v : v + ':27015';
  if (!/^[\w.\-]+:\d+$/.test(a)) return toast(t('bad_ip'));
  if (!S.favs.includes(a)) S.favs.push(a); await window.xc.store.set(S);
  const r = await window.xc.query(a, false); if (r.ok) SRV.set(a, r); renderServers();
};
$('#srvTable').addEventListener('dblclick', (e) => { const tr = e.target.closest('tr[data-a]'); if (tr) join(tr.dataset.a); });
$('#botN').oninput = (e) => ($('#botNv').textContent = e.target.value);
$('#botGo').onclick = async () => {
  const n = +$('#botN').value, d = +$('#botDiff').value, map = $('#botMap').value || 'de_dust2';
  const cfg = buildCfg() + `yb_quota "${n}"\nyb_difficulty "${d}"\n`;
  await window.xc.store.set(S); await window.xc.writeCfg(cfg);
  launch({ map, maxplayers: Math.max(2, n + 1) });
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !waitKey && !$('#modal').classList.contains('on') && !$('#home').classList.contains('on')) { const c = $('.screen.on [data-close]'); if (c) c.click(); } });

/* ------------------------------------------------------------ ishga tushish */
(async function init() {
  S = Object.assign(defaults(), await window.xc.store.get());
  S.x = Object.assign(defaults().x, S.x); S.binds = Object.assign(defaults().binds, S.binds);
  applyLang();
  const info = await window.xc.info();
  $('#stVer').textContent = `X CLIENT v${info.version}`;
  const maps = await window.xc.maps();
  $('#botMap').innerHTML = (maps.length ? maps : ['de_dust2', 'de_inferno', 'de_nuke', 'de_train', 'de_aztec', 'cs_assault', 'cs_italy']).map((m) => `<option ${m === 'de_dust2' ? 'selected' : ''}>${esc(m)}</option>`).join('');
  $('#newsText').textContent = S.lang === 'ru' ? 'Режимы FPS · 3 языка · свой список серверов' : S.lang === 'en' ? 'FPS modes · 3 languages · own server list' : 'FPS rejimlari · 3 til · o‘z serverlar ro‘yxati';
  await window.xc.writeCfg(buildCfg());
  renderHome();
  scan();
})();
