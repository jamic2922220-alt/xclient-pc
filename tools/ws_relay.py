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
