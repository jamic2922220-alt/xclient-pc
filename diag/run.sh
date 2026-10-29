#!/bin/bash
# Sayt diagnostikasi: mmb.boost-top.com dagi menyu fayllari va API javoblari
O=diag/out; mkdir -p $O; H=http://mmb.boost-top.com
for u in xc.html index.html ver.txt "xc_api.php?a=menuver" "xc_api.php?a=news" "xc_api.php?a=opts" master.js top.php "ms.php?q=/v1/servers/cstrike"; do
  f=$O/$(echo "$u" | tr '/?=&' '____')
  curl -s -m 30 -o "$f" -D "$f.hdr" -w "%{http_code} %{size_download}B %{time_total}s  $u\n" -X GET "$H/$u" >> $O/summary.txt
done
V=$(tr -d '\r\n ' < $O/xc_api.php_a_menuver); echo "menuver=$V" >> $O/summary.txt
for u in "rel/$V/index.html" "rel/$V/xc.js" "rel/$V/xc.css" "rel/$V/xc_lang.js" "rel/10199300/xc.js" "rel/10199200/xc.js" "rel/10199100/xc.js"; do
  f=$O/$(echo "$u" | tr '/?=&' '____')
  curl -s -m 30 -o "$f" -w "%{http_code} %{size_download}B %{time_total}s  $u\n" "$H/$u" >> $O/summary.txt
done
curl -s -m 30 -o $O/https_xc.html -w "%{http_code} %{time_total}s  https xc.html\n" "https://mmb.boost-top.com/xc.html" >> $O/summary.txt 2>&1
dig +short mmb.boost-top.com >> $O/summary.txt 2>&1
npm i -s playwright@1.47.2 >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1
node diag/load.js >> $O/summary.txt 2>&1
# 06:07:08
