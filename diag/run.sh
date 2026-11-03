#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
for v in tls1 tls1_1 tls1_2; do
  r=$(echo | timeout 15 openssl s_client -connect mmb.boost-top.com:443 -servername mmb.boost-top.com -$v -cipher 'DEFAULT:@SECLEVEL=0' 2>&1 | grep -E "Protocol|Cipher is|alert|error" | head -3 | tr '\n' ' ')
  echo "$v: $r" >> $O/summary.txt
done
for u in /mmb/xc.html /mmb/index.html /xc.html; do echo "https $u: $(curl -s -o /dev/null -w '%{http_code}' https://mmb.boost-top.com$u)" >> $O/summary.txt; done
echo "http index (old 301?): $(curl -s -o /dev/null -D - http://mmb.boost-top.com/index.html | head -1)" >> $O/summary.txt
