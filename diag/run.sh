#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
S "mmb IP: $(getent hosts mmb.boost-top.com | awk '{print $1}') | boost-top.com: $(getent hosts boost-top.com | awk '{print $1}') | cssborka: $(getent hosts cssborka.uz | awk '{print $1}')"
for ip in $(getent hosts mmb.boost-top.com | awk '{print $1}') 51.89.39.107; do
 for port in 8888 8889 8443 443 80 22; do
  S "$ip:$port -> $(timeout 8 bash -c "echo > /dev/tcp/$ip/$port" 2>/dev/null && echo OCHIQ || echo yopiq)"
 done
 S "https://$ip:8888 -> $(curl -sk -m 15 -o /tmp/o -w '%{http_code}' https://$ip:8888/) $(grep -o '<title>[^<]*' /tmp/o | head -1)"
done
