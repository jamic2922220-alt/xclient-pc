#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
B=https://mmb.boost-top.com
S "ver.txt: $(curl -s -m 20 $B/ver.txt) | menuver: $(curl -s -m 20 "$B/xc_api.php?a=menuver")"
for p in xc.html index.html rel/10203100/xc.js rel/10203100/xc.css rel/10203100/xc_lang.js rel/10203100/index.html; do S "$p $(curl -s -m 30 $B/$p | md5sum | cut -c1-32)"; done
S "api: $(curl -s -m 20 -X POST $B/xc_api.php -d 'a=feat' | head -c 40)"
