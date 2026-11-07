#!/bin/bash
O=diag/out; mkdir -p $O/live; : > $O/summary.txt
B=https://mmb.boost-top.com
echo "ver.txt: $(curl -s -m 20 $B/ver.txt)" >> $O/summary.txt
echo "menuver: $(curl -s -m 20 "$B/xc_api.php?a=menuver")" >> $O/summary.txt
for p in xc.html index.html; do curl -s -m 20 $B/$p -o $O/live/$p; echo "$p V=$(grep -o "var V = '[0-9]*'" $O/live/$p) async=$(grep -c 'aget(' $O/live/$p) md5=$(md5sum < $O/live/$p | cut -c1-32)" >> $O/summary.txt; done
for f in xc.js xc.css xc_lang.js index.html; do curl -s -m 30 $B/rel/10202400/$f -o $O/live/r_$f; echo "rel/10202400/$f $(stat -c %s $O/live/r_$f) $(md5sum < $O/live/r_$f | cut -c1-32)" >> $O/summary.txt; done
echo "update: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?action=update&ver=1.0.116&chan=stable" | head -c 300)" >> $O/summary.txt
