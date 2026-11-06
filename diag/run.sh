#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
for p in ver.txt xc.html xc.js xc.css xc_lang.js hero_b.png hero_f.png radar_prev.jpg logo.png yuklab.html; do
  u=https://mmb.boost-top.com/$p; echo "$p $(curl -s -m 20 -o /tmp/o -w '%{http_code} %{size_download} %{content_type}' $u) $(head -c 60 /tmp/o | tr -dc '[:print:]')" >> $O/summary.txt
done
curl -s -m 20 https://mmb.boost-top.com/ > $O/index.html; curl -s -m 20 https://mmb.boost-top.com/xc.js > $O/xc.js
node -e "new Function(require('fs').readFileSync('$O/xc.js','utf8'))" >> $O/summary.txt 2>&1 && echo "xc.js syntax ok" >> $O/summary.txt
