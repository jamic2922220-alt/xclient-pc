#!/usr/bin/env python3
"""X CLIENT Web: brauzer (WebSocket) <-> CS 1.6 serverlar (UDP) ko'prigi.

Brauzer UDP yubora olmaydi - o'yin paketlari WebSocket orqali shu dasturga keladi, u ularni serverga UDP qilib
yuboradi va javoblarni qaytaradi. Faqat standart kutubxona (pip kerak emas).

Kadr formati (ikkala yo'nalishda, binary): 4 bayt IPv4 + 2 bayt port (big-endian) + o'yin paketi.
Xavfsizlik: faqat ommaviy IPv4 va 26900-27999 portlar (CS serverlari), ulanish va paket soni cheklangan.

Ishga tushirish (TLS bilan - https sahifadan wss kerak):
  python3 ws_relay.py --port 27080 --cert /path/fullchain.pem --key /path/privkey.pem
"""
import argparse, asyncio, base64, hashlib, ipaddress, os, socket, ssl, struct, sys, time

GUID = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_CONN = 400            # bir vaqtda o'yinchilar
MAX_PER_IP = 6
PKT_PER_SEC = 1500        # bitta ulanishdan
ORIGINS = ('https://mmb.boost-top.com', 'https://boost-top.com', 'https://cssborka.uz', 'https://www.cssborka.uz')

conns = 0
per_ip = {}
ALLOW_PRIVATE = False   # faqat sinov uchun (--test)


def allowed(ip, port):
    if not 26900 <= port <= 27999:
        return False
    try:
        a = ipaddress.IPv4Address(ip)
    except ValueError:
        return False
    return a.is_global or ALLOW_PRIVATE


class Udp(asyncio.DatagramProtocol):
    def __init__(self, out):
        self.out = out

    def datagram_received(self, data, addr):
        try:
            hdr = socket.inet_aton(addr[0]) + struct.pack('>H', addr[1])
        except OSError:
            return
        self.out(hdr + data)


async def read_frame(r):
    h = await r.readexactly(2)
    op, ln = h[0] & 0x0f, h[1] & 0x7f
    masked = h[1] & 0x80
    if ln == 126:
        ln = struct.unpack('>H', await r.readexactly(2))[0]
    elif ln == 127:
        ln = struct.unpack('>Q', await r.readexactly(8))[0]
    if ln > 65536:
        raise ValueError('frame too big')
    mask = await r.readexactly(4) if masked else b''
    data = bytearray(await r.readexactly(ln))
    if masked:
        for i in range(ln):
            data[i] ^= mask[i & 3]
    return op, bytes(data)


def frame(data, op=2):
    n = len(data)
    if n < 126:
        h = bytes([0x80 | op, n])
    elif n < 65536:
        h = bytes([0x80 | op, 126]) + struct.pack('>H', n)
    else:
        h = bytes([0x80 | op, 127]) + struct.pack('>Q', n)
    return h + data


# ---- fastdl: server qo'shimcha fayllarini (sv_downloadurl) brauzer o'rniga yuklab berish ----
# Brauzerdagi dvijok HTTP orqali yuklay olmaydi. Sahifa so'raydi: GET /dl?s=IP:PORT&f=models/x.mdl
# Ko'prik serverning sv_downloadurl ini (A2S_RULES) bilib, faylni o'sha yerdan olib beradi.
import re, urllib.request, urllib.parse
DL_EXT = ('.bsp', '.wad', '.mdl', '.wav', '.spr', '.tga', '.bmp', '.txt', '.res', '.png', '.mp3', '.jpg')
DL_MAX = 80 << 20
_rules = {}


async def server_rules(ip, port):
    """GoldSrc A2S_RULES (challenge + bo'lingan paketlar). 10 daqiqa keshlanadi."""
    k = (ip, port); c = _rules.get(k)
    if c and time.time() - c[0] < 600:
        return c[1]
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    class P(asyncio.DatagramProtocol):
        def datagram_received(self, d, a):
            q.put_nowait(d)
    tr, _ = await loop.create_datagram_endpoint(P, remote_addr=(ip, port))
    rules = {}
    try:
        tr.sendto(b'\xff\xff\xff\xffV\xff\xff\xff\xff')
        d = await asyncio.wait_for(q.get(), 3)
        if d[:5] == b'\xff\xff\xff\xffA':
            tr.sendto(b'\xff\xff\xff\xffV' + d[5:9])
            d = await asyncio.wait_for(q.get(), 3)
        if d[:4] == b'\xfe\xff\xff\xff':                       # bo'lingan javob
            parts, total = {}, None
            while True:
                n = d[8]; total = n & 0x0f; parts[n >> 4] = d[9:]
                if len(parts) >= total:
                    break
                d = await asyncio.wait_for(q.get(), 3)
            d = b''.join(parts[i] for i in sorted(parts))
        if d[:5] == b'\xff\xff\xff\xffE':
            f = d[7:].split(b'\x00')
            for i in range(0, len(f) - 1, 2):
                rules[f[i].decode('latin1').lower()] = f[i + 1].decode('latin1')
    except Exception:
        pass
    finally:
        tr.close()
    _rules[k] = (time.time(), rules)
    return rules


def _fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Half-Life'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read(DL_MAX + 1)
    return None if len(data) > DL_MAX else data


async def serve_dl(w, target):
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(target).query)
    s, f = (q.get('s') or [''])[0], (q.get('f') or [''])[0].lstrip('/')
    code, body = 404, b''
    m = re.match(r'^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$', s)
    if m and allowed(m.group(1), int(m.group(2))) and re.match(r'^[A-Za-z0-9_\-./ ]{1,160}$', f) and '..' not in f and f.lower().endswith(DL_EXT):
        dl = (await server_rules(m.group(1), int(m.group(2)))).get('sv_downloadurl', '').strip()
        # sv_downloadurl ko'pincha ommaviy qoidalarda yo'q (faqat ulangan o'yinchiga yuboriladi) - X CLIENT serverlarida fastdl :8090 da
        for base in ([dl] if dl else []) + ['http://%s:8090/' % m.group(1)]:
          if code == 200:
            break
          u = urllib.parse.urlsplit(base)
          if u.scheme in ('http', 'https') and u.hostname:
              try:
                  ok = ipaddress.IPv4Address(socket.gethostbyname(u.hostname)).is_global or ALLOW_PRIVATE
              except Exception:
                  ok = False
              if ok:
                  try:
                      data = await asyncio.to_thread(_fetch, base.rstrip('/') + '/' + urllib.parse.quote(f))
                      if data is not None:
                          code, body = 200, data
                  except Exception:
                      code = 404
    w.write(('HTTP/1.1 %d %s\r\nContent-Type: application/octet-stream\r\nContent-Length: %d\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: public, max-age=86400\r\nConnection: close\r\n\r\n'
             % (code, 'OK' if code == 200 else 'Not Found', len(body))).encode() + body)
    await w.drain(); w.close()


async def handle(r, w):
    global conns
    peer = (w.get_extra_info('peername') or ('?',))[0]
    try:
        req = await asyncio.wait_for(r.readuntil(b'\r\n\r\n'), 10)
    except Exception:
        w.close(); return
    hdrs = {}
    for line in req.decode('latin1').split('\r\n')[1:]:
        if ':' in line:
            k, v = line.split(':', 1)
            hdrs[k.strip().lower()] = v.strip()
    peer = hdrs.get('x-real-ip', peer)
    key = hdrs.get('sec-websocket-key')
    target = req.decode('latin1').split('\r\n')[0].split(' ')
    if not key and len(target) > 1 and target[0] == 'GET' and target[1].startswith('/dl?'):
        return await serve_dl(w, target[1])
    origin = hdrs.get('origin', '')
    if not key or (origin and not origin.startswith(ORIGINS) and not ALLOW_PRIVATE) or conns >= MAX_CONN or per_ip.get(peer, 0) >= MAX_PER_IP:
        w.write(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); await w.drain(); w.close(); return
    acc = base64.b64encode(hashlib.sha1(key.encode() + GUID).digest())
    w.write(b'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + b'\r\n\r\n')
    await w.drain()
    conns += 1; per_ip[peer] = per_ip.get(peer, 0) + 1
    loop = asyncio.get_running_loop()

    def to_ws(d):
        if not w.is_closing():
            w.write(frame(d))

    tr, _ = await loop.create_datagram_endpoint(lambda: Udp(to_ws), local_addr=('0.0.0.0', 0))
    sec, cnt = int(time.time()), 0
    try:
        while True:
            op, data = await asyncio.wait_for(read_frame(r), 120)
            if op == 8:
                break
            if op == 9:
                w.write(frame(data, 10)); continue
            if op != 2 or len(data) < 7:
                continue
            now = int(time.time())
            if now != sec:
                sec, cnt = now, 0
            cnt += 1
            if cnt > PKT_PER_SEC:
                continue
            ip, port = socket.inet_ntoa(data[:4]), struct.unpack('>H', data[4:6])[0]
            if allowed(ip, port):
                tr.sendto(data[6:], (ip, port))
            if w.transport.get_write_buffer_size() > 4 << 20:   # brauzer o'qimayapti
                break
    except Exception:
        pass
    finally:
        tr.close()
        conns -= 1; per_ip[peer] -= 1
        if per_ip[peer] <= 0:
            per_ip.pop(peer, None)
        w.close()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default='0.0.0.0')
    ap.add_argument('--port', type=int, default=27080)
    ap.add_argument('--cert'); ap.add_argument('--key')
    ap.add_argument('--test', action='store_true', help=argparse.SUPPRESS)
    a = ap.parse_args()
    global ALLOW_PRIVATE
    ALLOW_PRIVATE = a.test
    ctx = None
    if a.cert:
        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(a.cert, a.key)
    srv = await asyncio.start_server(handle, a.host, a.port, ssl=ctx)
    print('ws_relay: %s:%d %s' % (a.host, a.port, 'wss' if ctx else 'ws'), flush=True)
    async with srv:
        await srv.serve_forever()

if __name__ == '__main__':
    asyncio.run(main())
