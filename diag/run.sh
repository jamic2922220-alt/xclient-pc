#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
for u in "http://mmb.boost-top.com/mobile.json?x=$RANDOM" "https://mmb.boost-top.com/mobile.json" "https://boost-top.com/mmb/mobile.json?x=$RANDOM" "http://boost-top.com/mmb/mobile.json"; do
 echo "== $u" >> $O/summary.txt
 curl -s -m 20 -D - "$u" | grep -iE "^HTTP|last-modified|cache|age:|server|apk_build" >> $O/summary.txt
done
