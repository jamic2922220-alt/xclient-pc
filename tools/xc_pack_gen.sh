#!/bin/bash
# X CLIENT: server fayllarini oldindan yuklash ro'yxati (fastdl/xc_pack.txt) - o'yin serveri mashinasida (root).
# Launcher shu ro'yxat bo'yicha yetishmayotgan fayllarni fonda yuklaydi - serverga birinchi kirish tez bo'ladi.
# Ro'yxat: nginx jurnalidan kamida 2 xil o'yinchi muvaffaqiyatli (200) yuklagan o'yin fayllari, fastdl da mavjudlari.
# O'rnatish (bir marta, har kuni 04:20 da yangilanadi):
#   wget -qO /root/xc_pack_gen.sh https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/claude/single-client/tools/xc_pack_gen.sh && bash /root/xc_pack_gen.sh --install
F=${FASTDL:-/var/www/fastdl}
LOGS=${LOGS:-/var/log/nginx/access.log}
if [ "$1" = "--install" ]; then
  cp "$0" /root/xc_pack_gen.sh 2>/dev/null; chmod +x /root/xc_pack_gen.sh
  echo "20 4 * * * root /bin/bash /root/xc_pack_gen.sh >/dev/null 2>&1" > /etc/cron.d/xc-pack
  echo "har kuni 04:20 da yangilanadi (/etc/cron.d/xc-pack)"
fi
[ -d "$F" ] || { echo "XATO: $F yo'q"; exit 1; }
python3 - "$F" $LOGS $LOGS.1 <<'PY'
import sys, os, re, gzip, glob, urllib.parse, collections
fastdl = sys.argv[1]
files = [p for a in sys.argv[2:] for p in glob.glob(a + '*') if os.path.isfile(p)]
rx = re.compile(r'^(\S+) \S+ \S+ \[[^\]]+\] "GET (/[^ ?"]+)[^"]*" (\d{3}) \S+ "[^"]*" "([^"]*)"')
ext = ('.mdl', '.wav', '.spr', '.bsp', '.wad', '.txt', '.tga', '.bmp', '.mp3', '.res', '.png')
ips = collections.defaultdict(set)
for fn in files:
    op = gzip.open if fn.endswith('.gz') else open
    try:
        with op(fn, 'rt', errors='replace') as fh:
            for ln in fh:
                m = rx.match(ln)
                if not m or m.group(3) not in ('200', '206', '304'): continue
                ua = m.group(4)
                if 'Valve/Steam' not in ua and 'X CLIENT' not in ua and 'Half-Life' not in ua: continue
                p = urllib.parse.unquote(m.group(2)).lstrip('/')
                if '..' in p or not p.lower().endswith(ext) or not re.match(r'^[A-Za-z0-9_\-./]+$', p): continue
                ips[p].add(m.group(1))
    except Exception as e:
        print('jurnal o\'qilmadi:', fn, e)
out, total = [], 0
for p, s in sorted(ips.items()):
    if len(s) < 2: continue                       # bitta o'yinchi so'ragan (kam ishlatiladigan xarita va h.k.) - kerak emas
    fp = os.path.join(fastdl, p)
    if not os.path.isfile(fp): continue
    sz = os.path.getsize(fp)
    if sz <= 0 or sz > 64 << 20: continue
    out.append('%d %s' % (sz, p)); total += sz
tmp = os.path.join(fastdl, '.xc_pack.tmp')
open(tmp, 'w').write('\n'.join(out) + '\n')
os.replace(tmp, os.path.join(fastdl, 'xc_pack.txt'))
st = os.stat(fastdl);
try: os.chown(os.path.join(fastdl, 'xc_pack.txt'), st.st_uid, st.st_gid)
except Exception: pass
print('xc_pack.txt: %d fayl, %d MB (jurnallar: %d)' % (len(out), total >> 20, len(files)))
PY
