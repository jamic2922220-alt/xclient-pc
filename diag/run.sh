#!/bin/bash
O=diag/out; mkdir -p $O/live; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
B=https://mmb.boost-top.com
S "ver.txt: $(curl -s -m 20 $B/ver.txt) | menuver: $(curl -s -m 20 "$B/xc_api.php?a=menuver")"
for p in xc.html index.html rel/10203000/xc.js rel/10203000/xc.css rel/10203000/xc_lang.js rel/10203000/index.html; do S "$p $(curl -s -m 30 $B/$p | md5sum | cut -c1-32)"; done
S "prob start_fail: $(curl -s -m 20 -X POST $B/xc_api.php -d 'a=prob&k=start_fail')"
S "register norm: $(curl -s -m 20 -X POST $B/xc_api.php --data-urlencode 'a=register' --data-urlencode 'login=Шерзод' --data-urlencode 'pass=1' | head -c 120)"
S "admin: $(curl -s -m 20 -o /dev/null -w '%{http_code}' $B/admin.php)"
S "launcher: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.100&ch=stable" | grep version)"
