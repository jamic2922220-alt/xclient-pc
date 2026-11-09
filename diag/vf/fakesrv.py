import socket, struct, sys, threading
def srv(port, kind):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('0.0.0.0', port))
    while True:
        d, a = s.recvfrom(2048)
        if not d.startswith(b'\xff\xff\xff\xffTSource Engine Query'): continue
        if kind == 'I' and len(d) < 30:   # challenge talab qiladi
            s.sendto(b'\xff\xff\xff\xffA\x11\x22\x33\x44', a); continue
        if kind == 'm': r = b'\xff\xff\xff\xffm' + b'127.0.0.1:%d\0' % port + b'Klub LAN #1\0de_dust2\0cstrike\0Counter-Strike\0' + bytes([7, 32, 47])
        else: r = b'\xff\xff\xff\xffI\x30' + b'Yangi LAN server\0de_inferno\0cstrike\0Counter-Strike\0' + struct.pack('<H', 10) + bytes([3, 20, 0])
        s.sendto(r, a)
threading.Thread(target=srv, args=(27015, 'm'), daemon=True).start()
threading.Thread(target=srv, args=(27016, 'I'), daemon=True).start()
import time; time.sleep(40)
