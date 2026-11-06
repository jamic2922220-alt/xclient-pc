#!/bin/bash
O=diag/out; mkdir -p $O/live; : > $O/summary.txt
B=https://mmb.boost-top.com
curl -s -m 20 $B/xc.html -o $O/live/xc.html
grep -o 'rel/[0-9]*/[a-z_.]*?v=[0-9]*\|var V = .[0-9]*.' $O/live/xc.html | sort -u >> $O/summary.txt
for p in $(grep -o 'rel/[0-9]*/[a-z_.]*' $O/live/xc.html | sort -u); do curl -s -m 30 $B/$p -o $O/live/$(basename $p); echo "$p $(stat -c %s $O/live/$(basename $p)) $(md5sum < $O/live/$(basename $p))" >> $O/summary.txt; done
curl -s -m 20 "$B/xc_api.php" -X POST -d 'a=opts&d=diagdev0000001' | head -c 600 >> $O/summary.txt; echo >> $O/summary.txt
curl -s -m 20 "$B/xc_api.php" -X POST -d 'a=menuver' | head -c 300 >> $O/summary.txt; echo >> $O/summary.txt
for f in hero_b.png hero_f.png hero_fb.png hero_bb.png radar_prev.jpg; do echo "$f $(curl -s -m 20 -o /dev/null -w '%{http_code} %{size_download}' $B/$f)" >> $O/summary.txt; done
