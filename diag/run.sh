#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
B=http://mmb.boost-top.com
echo "ver.txt: $(curl -s --max-time 15 $B/ver.txt)" >> $O/summary.txt
echo "xc.html V: $(curl -s --max-time 15 $B/xc.html | grep -o "var V = '[0-9]*'")" >> $O/summary.txt
V=$(curl -s --max-time 15 $B/ver.txt | tr -d '\r\n ')
echo "rel xc.js: $(curl -s -o /tmp/x.js -w '%{http_code}' --max-time 20 "$B/rel/$V/xc.js?v=$V") launchCheck=$(grep -c launchCheck /tmp/x.js) uics=$(grep -c SFX_CS /tmp/x.js) hrF=$(curl -s --max-time 20 "$B/rel/$V/xc.css?v=$V" | grep -c hrF)" >> $O/summary.txt
echo "admin ret page code: $(curl -s --max-time 15 $B/admin.php | head -c 0; curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$B/admin.php?p=ret")" >> $O/summary.txt
echo "api age field: $(curl -s --max-time 15 "$B/xc_api.php?a=opts" | head -c 120)" >> $O/summary.txt
echo "mobile.json: $(curl -s --max-time 15 $B/mobile.json | tr -d '\n' | grep -o '"apk_build": *[0-9]*\|"apk_url": *"[^"]*"' | tr '\n' ' ')" >> $O/summary.txt
echo "servers.php: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $B/servers.php)" >> $O/summary.txt
echo "hero: $(for f in hero_b hero_f hero_fb hero_bb; do curl -s -o /dev/null -w '%{http_code} ' --max-time 15 $B/$f.png; done)" >> $O/summary.txt
echo "upd stable: $(curl -s --max-time 15 "$B/xclient/api.php?a=update&ch=stable" | head -c 300)" >> $O/summary.txt
echo "apk38: $(curl -sIL -o /dev/null -w '%{http_code}' --max-time 20 https://github.com/jamic2922220-alt/cssborka.uz-mobile/releases/download/build-38/CS16-boosttop.apk)" >> $O/summary.txt
