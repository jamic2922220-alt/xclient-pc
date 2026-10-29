#!/bin/bash
O=diag/out; mkdir -p $O
for u in "http://mmb.boost-top.com/" "http://mmb.boost-top.com/xc.html" "http://mmb.boost-top.com/index.html" "http://mmb.boost-top.com/xc_api.php?a=menuver" "http://mmb.boost-top.com/xc_api.php?a=watch" "http://boost-top.com/mmb/" "http://boost-top.com/mmb/xc.html" "https://mmb.boost-top.com/xc.html" "http://mmb.boost-top.com/ver.txt"; do
  echo "=== $u" >> $O/summary.txt
  curl -s -m 30 -o /dev/null -D - "$u" | grep -iE "^HTTP|^location|^cache-control|^expires" >> $O/summary.txt
done
# 10 marta ketma-ket (ba'zan buziladimi?)
for i in $(seq 1 10); do curl -s -m 20 -o /dev/null -w "%{http_code} " "http://mmb.boost-top.com/xc.html?r=$i" >> $O/summary.txt; sleep 2; done; echo >> $O/summary.txt
