#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
H=http://mmb.boost-top.com
for u in "/xc.html" "/index.html" "/yo-q.html" "/xc_api.php?a=menuver" "/xc_api.php?a=watch" "/xc_api.php?a=news" "/xc_api.php?a=clips" "/ver.txt" "/top.php" "/ms.php?q=/v1/servers/cstrike" "/clips.php" "/admin.php" "/yuklab.html"; do
  curl -s -m 30 -o $O/b.tmp -D $O/h.tmp -w "%{http_code} %{size_download}B %{time_total}s  $u" "$H$u" >> $O/summary.txt
  echo "  | $(grep -i '^cache-control' $O/h.tmp | tr -d '\r' | tr '\n' ' ')" >> $O/summary.txt
  grep -qiE "Fatal error|Parse error|Warning:|Notice:" $O/b.tmp && echo "   !! PHP XATO: $(grep -oiE '(Fatal error|Parse error|Warning|Notice)[^<]{0,150}' $O/b.tmp | head -2)" >> $O/summary.txt
done
V=$(curl -s "$H/xc_api.php?a=menuver" | tr -d '\r\n '); echo "menuver=$V" >> $O/summary.txt
for f in index.html xc.js xc.css xc_lang.js; do curl -s -o /dev/null -w "%{http_code} %{size_download}B rel/$V/$f\n" "$H/rel/$V/$f" >> $O/summary.txt; done
echo "news: $(curl -s "$H/xc_api.php?a=news" | head -c 400)" >> $O/summary.txt
for i in $(seq 1 10); do curl -s -m 20 -o /dev/null -w "%{time_total} " "$H/xc_api.php?a=menuver&r=$i" >> $O/summary.txt; done; echo " <- menuver tezligi (s)" >> $O/summary.txt
npm i -s playwright@1.47.2 >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1
node diag/load.js >> $O/summary.txt 2>&1
