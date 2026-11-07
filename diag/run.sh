#!/bin/bash
O=diag/out; mkdir -p $O/live; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
B=https://mmb.boost-top.com
S "== SAYT"
for u in $B/ http://mmb.boost-top.com/ $B/xc.html $B/ver.txt "$B/xc_api.php?a=menuver" $B/admin.php $B/yuklab.html https://cssborka.uz/xclient https://cssborka.uz/ $B/xclient/api.php; do
  S "$(curl -s -o /dev/null -m 20 -w '%{http_code} %{time_total}s %{size_download}B' "$u") $u"
done
S "ver: $(curl -s -m 20 $B/ver.txt) menuver: $(curl -s -m 20 "$B/xc_api.php?a=menuver")"
S "gzip xc.js: $(curl -s -m 20 -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}' $B/rel/$(curl -s $B/ver.txt)/xc.js) bayt (siqilmagan ~300000)"
S "cache headers xc.html: $(curl -sI -m 20 $B/xc.html | grep -i 'cache-control\|expires' | tr -d '\r' | tr '\n' ' ')"
S "TLS: $(echo | openssl s_client -servername mmb.boost-top.com -connect mmb.boost-top.com:443 2>/dev/null | openssl x509 -noout -enddate -issuer 2>/dev/null | tr '\n' ' ')"
S "TLS cssborka: $(echo | openssl s_client -servername cssborka.uz -connect cssborka.uz:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null)"
S "== MAXFIY FAYLLAR (403/404 bo'lishi kerak)"
for p in xc_data/ xc_data/users/ xc_data/admin.php xc_data/cfg.php xc_data/tokens.php .git/config .env xclient/rel_stable.php xc_data/daily/ README.md; do S "$(curl -s -o /tmp/o -m 20 -w '%{http_code}' "$B/$p") $p $(head -c 60 /tmp/o | tr -dc '[:print:]')"; done
S "== API"
for a in "a=hello&d=diagdev0000001&v=1.0.119&lang=uz" "a=feat" "a=top" "a=ann" "a=week" "a=prob&k=bogus" "a=opts"; do
  S "$(curl -s -m 20 -X POST $B/xc_api.php -d "$a" -o /tmp/o -w '%{http_code} %{time_total}s') $a -> $(head -c 140 /tmp/o | tr -d '\n')"
done
S "== LAUNCHER YANGILANISHI"
curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.100&ch=stable" > /tmp/upd; cat /tmp/upd >> $O/summary.txt
BASE=$(grep ^base= /tmp/upd | cut -d= -f2-)
curl -s -m 30 "$BASE/manifest.txt" > /tmp/man; S "manifest: $(wc -l < /tmp/man) fayl"
bad=0; n=0
while read -r sha size name; do n=$((n+1)); f=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$name"); curl -s -m 60 -o /tmp/f "$BASE/$f"; h=$(sha256sum /tmp/f | cut -c1-64); s=$(stat -c %s /tmp/f); if [ "$h" != "$sha" ] || [ "$s" != "$size" ]; then bad=$((bad+1)); S "BUZUQ: $name ($s/$size)"; fi; done < /tmp/man
S "manifest tekshirildi: $n fayl, buzuq: $bad"
S "beta: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.100&ch=beta" | grep -E 'version|min' | tr '\n' ' ')"
S "== YUKLASH"
for u in https://github.com/jamic2922220-alt/xclient-pc/releases/download/xclient-latest/X-Client-Setup.exe https://github.com/jamic2922220-alt/xclient-pc/releases/download/cs16/CS_1_6_boost-top_PRO_2_5_3.exe "https://cssborka.uz/uploads/files/1791198609_6ac38591b615c_CS_1_6_boost-top_PRO_2_5_3.exe"; do
  S "$(curl -sL -r 0-0 -o /dev/null -m 30 -w '%{http_code} %{time_total}s' "$u") $(curl -sIL -m 30 "$u" | grep -i '^content-length' | tail -1 | tr -d '\r') $u"
done
S "cssborka tezlik (10MB): $(curl -sL -r 0-10485759 -o /dev/null -m 120 -w '%{speed_download}' 'https://cssborka.uz/uploads/files/1791198609_6ac38591b615c_CS_1_6_boost-top_PRO_2_5_3.exe') B/s"
S "== MASTER / SERVERLAR"
S "$(curl -s -m 20 -o /tmp/o -w '%{http_code} %{time_total}s' 'http://mmb.boost-top.com/ms.php?q=/v1/servers/cstrike') $(head -c 200 /tmp/o)"
python3 - >> $O/summary.txt 2>&1 <<'P'
import socket,time
for ip in ['157.22.130.26','212.47.58.89','212.47.58.40']:
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.settimeout(3)
    try:
        t=time.time();s.sendto(b'\xff\xff\xff\xffTSource Engine Query\x00',(ip,27015));d=s.recv(1400);print(ip,'OK',int((time.time()-t)*1000),'ms')
    except Exception as e: print(ip,'ERR',e)
P
