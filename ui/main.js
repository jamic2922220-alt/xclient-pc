// X CLIENT — asosiy oyna (Electron). O'yin papkasidagi "x-ui" ichida turadi.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// O'yin papkasi: x-ui/XClientUI.exe -> ..  (sinov uchun XC_GAME_DIR)
const GAME_DIR = process.env.XC_GAME_DIR
  || (app.isPackaged ? path.resolve(path.dirname(process.execPath), '..') : path.resolve(__dirname, '..'));
const CSTRIKE = path.join(GAME_DIR, 'cstrike');
const STORE = path.join(GAME_DIR, 'xclient_ui.json');

const MASTER = 'http://mmb.boost-top.com/ms.php?q=/v1/servers/cstrike';
// O'z serverlarimiz — har doim ro'yxatda va tepada
const PINNED = ['157.22.130.26:27015'];

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#0d0b10', show: false,
    title: 'X CLIENT',
    icon: path.join(__dirname, 'app', 'img', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

/* ------------------------------------------------------------ sozlamalar */
function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch (e) { return {}; }
}
function writeStore(obj) {
  try { fs.writeFileSync(STORE, JSON.stringify(obj, null, 2)); return true; } catch (e) { return false; }
}
ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (e, obj) => writeStore(obj));

ipcMain.handle('cfg:write', (e, text) => {
  try {
    fs.mkdirSync(CSTRIKE, { recursive: true });
    fs.writeFileSync(path.join(CSTRIKE, 'xclient_launcher.cfg'), text);
    return true;
  } catch (err) { return String(err); }
});

ipcMain.handle('sys:info', () => ({
  gameDir: GAME_DIR,
  hasGame: fs.existsSync(path.join(GAME_DIR, 'xash3d.exe')),
  version: (() => { try { return fs.readFileSync(path.join(GAME_DIR, 'xclient_version.txt'), 'utf8').trim(); } catch (e) { return 'dev'; } })(),
  platform: process.platform,
}));

/* ------------------------------------------------------------ oyna */
ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:close', () => app.quit());
ipcMain.on('open:url', (e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('open:folder', (e, sub) => {
  const p = path.join(CSTRIKE, String(sub || '').replace(/[^\w]/g, ''));
  fs.mkdirSync(p, { recursive: true });
  shell.openPath(p);
});

/* ------------------------------------------------------------ o'yinni ochish */
ipcMain.handle('game:launch', (e, opts) => {
  const exe = path.join(GAME_DIR, 'xash3d.exe');
  if (!fs.existsSync(exe)) return 'xash3d.exe topilmadi: ' + exe;
  const args = ['-game', 'cstrike', '+scr_drawversion', '0', '+clearmasters', '+exec', 'boosttop_ms.cfg', '+exec', 'xclient_master.cfg', '+exec', 'xclient_launcher.cfg'];
  if (opts && opts.width && opts.height) args.unshift('-width', String(opts.width), '-height', String(opts.height));
  if (opts && opts.windowed) args.unshift('-window'); else args.unshift('-fullscreen');
  if (opts && opts.connect && /^[\w.\-]+:\d+$/.test(opts.connect)) args.push('+connect', opts.connect);
  if (opts && opts.map && /^\w+$/.test(opts.map)) args.push('+maxplayers', String(opts.maxplayers || 12), '+map', opts.map);
  try {
    const p = spawn(exe, args, { cwd: GAME_DIR, detached: true, stdio: 'ignore' });
    p.unref();
    if (opts && opts.closeAfter) setTimeout(() => app.quit(), 1500);
    else if (win) win.minimize();
    return true;
  } catch (err) { return String(err); }
});

/* ------------------------------------------------------------ serverlar */
function httpGet(url, timeout = 8000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(res.statusCode === 200 ? d : ''));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

ipcMain.handle('ms:list', async () => {
  const body = await httpGet(MASTER);
  const out = new Set(PINNED);
  (process.env.XC_TEST_SERVERS || '').split(',').filter(Boolean).forEach((x) => out.add(x));
  for (const line of body.split(/\r?\n/)) {
    const m = line.trim().match(/^(gs|ip)\s+([\d.]+:\d+)/);
    if (m) out.add(m[2]);
  }
  return [...out];
});

// A2S_INFO + A2S_PLAYER (GoldSrc / ReHLDS / Xash)
function a2s(addr, wantPlayers, timeout = 2000) {
  return new Promise((resolve) => {
    const [host, portS] = addr.split(':');
    const port = parseInt(portS, 10);
    const sock = dgram.createSocket('udp4');
    const res = { addr, ok: false };
    let t0 = Date.now(), done = false, stage = 'info';
    const finish = () => { if (done) return; done = true; clearTimeout(timer); try { sock.close(); } catch (e) {} resolve(res); };
    const timer = setTimeout(finish, timeout);
    const HDR = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    const infoReq = (ch) => Buffer.concat([HDR, Buffer.from('TSource Engine Query\0', 'latin1'), ch || Buffer.alloc(0)]);
    const plReq = (ch) => Buffer.concat([HDR, Buffer.from([0x55]), ch || Buffer.from([0xff, 0xff, 0xff, 0xff])]);
    sock.on('error', finish);
    sock.on('message', (msg) => {
      if (msg.length < 5) return;
      const type = msg[4];
      if (type === 0x41) { // challenge
        const ch = msg.slice(5, 9);
        if (stage === 'info') sock.send(infoReq(ch), port, host); else sock.send(plReq(ch), port, host);
        return;
      }
      try {
        if (type === 0x49 || type === 0x6d) {
          res.ping = Date.now() - t0;
          let o = 5; const str = () => { const e = msg.indexOf(0, o); const s = msg.slice(o, e).toString('utf8'); o = e + 1; return s; };
          if (type === 0x49) { o++; res.name = str(); res.map = str(); str(); str(); o += 2; res.players = msg[o++]; res.max = msg[o++]; res.bots = msg[o++]; }
          else { str(); res.name = str(); res.map = str(); str(); str(); res.players = msg[o++]; res.max = msg[o++]; }
          // nomdagi ko'rinmas/buzuq belgilarni tozalash
          const clean = (v) => String(v || '').replace(/[\u0000-\u001f\u007f-\u009f\ufffd\u2580-\u259f]/g, ' ').replace(/\s{2,}/g, ' ').trim();
          res.name = clean(res.name); res.map = clean(res.map);
          res.ok = true;
          if (wantPlayers) { stage = 'players'; sock.send(plReq(), port, host); } else finish();
        } else if (type === 0x44) {
          let o = 6; const n = msg[5]; res.list = [];
          for (let i = 0; i < n && o < msg.length; i++) {
            o++; const e = msg.indexOf(0, o); const name = msg.slice(o, e).toString('utf8').replace(/[\u0000-\u001f\ufffd\u2580-\u259f]/g, '').trim(); o = e + 1;
            const score = msg.readInt32LE(o); o += 4; const time = msg.readFloatLE(o); o += 4;
            if (name) res.list.push({ name, score, time: Math.round(time) });
          }
          res.list.sort((a, b) => b.score - a.score);
          finish();
        }
      } catch (e) { finish(); }
    });
    t0 = Date.now();
    sock.send(infoReq(), port, host, (err) => err && finish());
  });
}
ipcMain.handle('srv:query', (e, addr, players) => a2s(String(addr), !!players));
ipcMain.handle('srv:queryMany', async (e, list) => {
  const out = [];
  const queue = list.slice(0, 400);
  const workers = Array.from({ length: 24 }, async () => {
    while (queue.length) { const a = queue.shift(); const r = await a2s(a, false, 1500); if (r.ok) { r.pinned = PINNED.includes(a); out.push(r); win && win.webContents.send('srv:one', r); } }
  });
  await Promise.all(workers);
  return out;
});

// LAN: 27015-27020 portlariga broadcast
ipcMain.handle('srv:lan', () => new Promise((resolve) => {
  const sock = dgram.createSocket('udp4');
  const found = new Map();
  const t0 = Date.now();
  sock.on('message', (msg, rinfo) => {
    const addr = rinfo.address + ':' + rinfo.port;
    if (found.has(addr) || msg.length < 6) return;
    found.set(addr, true);
    a2s(addr, false).then((r) => { if (r.ok) win && win.webContents.send('srv:lanOne', r); });
  });
  sock.bind(() => {
    sock.setBroadcast(true);
    const q = Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from('TSource Engine Query\0', 'latin1')]);
    for (let p = 27015; p <= 27020; p++) sock.send(q, p, '255.255.255.255');
  });
  setTimeout(() => { try { sock.close(); } catch (e) {} resolve(found.size); }, 2500);
}));

ipcMain.handle('net:get', async (e, url) => (/^https?:\/\//.test(url) ? httpGet(url) : ''));

ipcMain.handle('maps:list', () => {
  try {
    return fs.readdirSync(path.join(CSTRIKE, 'maps')).filter((f) => /^(de|cs|as|fy|aim|awp)_[\w]+\.bsp$/i.test(f)).map((f) => f.slice(0, -4)).sort();
  } catch (e) { return []; }
});
