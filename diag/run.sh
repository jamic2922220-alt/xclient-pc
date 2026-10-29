#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
H=http://mmb.boost-top.com
for u in "/xc.html" "/index.html" "/yo-q-sahifa.html" "/xc_api.php?a=menuver" "/xc_api.php?a=watch" "/ver.txt" "/.htaccess"; do
  echo "=== $u" >> $O/summary.txt
  curl -s -m 30 -D - -o $O/body.tmp "$H$u" | grep -iE "^HTTP|^location|^cache-control|^expires" >> $O/summary.txt
  case "$u" in *watch*|*menuver*) head -c 200 $O/body.tmp >> $O/summary.txt; echo >> $O/summary.txt;; esac
done
V=$(curl -s "$H/xc_api.php?a=menuver" | tr -d '\r\n '); echo "menuver=$V" >> $O/summary.txt
for f in index.html xc.js xc.css xc_lang.js; do curl -s -o /dev/null -w "%{http_code} %{size_download}B rel/$V/$f\n" "$H/rel/$V/$f" >> $O/summary.txt; done
curl -s "$H/rel/$V/xc.js" | grep -c "newsBox\|netCheck\|rsk_of\|rk3" >> $O/summary.txt
npm i -s playwright@1.47.2 >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1
node diag/load.js >> $O/summary.txt 2>&1
