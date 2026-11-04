#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
B=http://mmb.boost-top.com
for u in /xc.html /index.html /ver.txt /xc_api.php?a=watch /servers.php /mobile.json /fav.php /bye.php /hero_b.png /hero_f.png /hero_fb.png /hero_bb.png /mobile/cs16_data.zip; do
  echo "$u: $(curl -sS -o /tmp/b -r 0-2000 --max-time 25 -w '%{http_code} %{size_download}B %{time_total}s %{redirect_url}' "$B$u" 2>&1 | tail -1)" >> $O/summary.txt
done
echo "ver.txt: $(curl -s --max-time 15 $B/ver.txt)" >> $O/summary.txt
echo "xc.html V: $(curl -s --max-time 15 $B/xc.html | grep -o "var V = '[0-9]*'" )" >> $O/summary.txt
echo "xc.html hero: $(curl -s --max-time 15 $B/xc.html | grep -c heroF)" >> $O/summary.txt
echo "mobile.json: $(curl -s --max-time 15 $B/mobile.json | head -c 400)" >> $O/summary.txt
echo "servers.php: $(curl -s --max-time 15 $B/servers.php | head -c 300)" >> $O/summary.txt
V=$(curl -s --max-time 15 $B/ver.txt | tr -d '\r\n ')
echo "rel js: $(curl -s -o /dev/null -w '%{http_code} %{size_download}' --max-time 20 "$B/rel/$V/xc.js?v=$V")" >> $O/summary.txt
echo "register reward in api: $(curl -s --max-time 15 "$B/xc_api.php?a=ping" | head -c 200)" >> $O/summary.txt
echo "boost-top.com: $(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' https://boost-top.com/ 2>&1 | tail -1)" >> $O/summary.txt
echo "fastpanel: $(curl -sk -o /dev/null --max-time 20 -w '%{http_code}' https://51.89.39.107:8888/ 2>&1 | tail -1)" >> $O/summary.txt
