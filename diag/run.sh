#!/bin/bash
O=diag/out; mkdir -p $O/live; : > $O/summary.txt
B=https://mmb.boost-top.com
echo "ver.txt: $(curl -s -m 20 $B/ver.txt)" >> $O/summary.txt
echo "menuver: $(curl -s -m 20 "$B/xc_api.php?a=menuver")" >> $O/summary.txt
for p in xc.html index.html; do curl -s -m 20 $B/$p -o $O/live/$p; echo "$p $(md5sum < $O/live/$p | cut -c1-32)" >> $O/summary.txt; done
for f in xc.js xc.css xc_lang.js index.html; do curl -s -m 30 $B/rel/10202500/$f -o $O/live/r_$f; echo "rel/$f $(md5sum < $O/live/r_$f | cut -c1-32)" >> $O/summary.txt; done
for f in hero_b.png hero_f.png logo_big.png; do echo "$f $(curl -s -m 20 $B/$f | md5sum | cut -c1-32)" >> $O/summary.txt; done
echo "prob: $(curl -s -m 20 -X POST $B/xc_api.php -d 'a=prob&k=bogus')" >> $O/summary.txt
echo "admin: $(curl -s -m 20 -o /dev/null -w '%{http_code}' "$B/admin.php?p=prob")" >> $O/summary.txt
echo "update: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.117&ch=stable" | grep version)" >> $O/summary.txt
