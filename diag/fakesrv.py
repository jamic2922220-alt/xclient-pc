import socket, struct, sys, time
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('0.0.0.0', 27015)); s.settimeout(1); t0 = time.time()
while time.time() - t0 < 60:
    try: d, a = s.recvfrom(1400)
    except socket.timeout: continue
    if b'TSource Engine Query' in d:
        r = b'\xff\xff\xff\xffI' + bytes([48]) + 'Ali "LAN" сервер\0'.encode() + b'de_dust2\0cstrike\0Counter-Strike\0' + struct.pack('<H', 10) + bytes([3, 12, 0]) + b'dw\0\x01'
        s.sendto(r, a); print('javob', a, flush=True)
