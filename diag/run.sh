#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
echo "dns: $(getent hosts mmb.boost-top.com boost-top.com | tr '\n' ' ')" >> $O/summary.txt
for u in http://mmb.boost-top.com/xc.html http://mmb.boost-top.com/servers.php https://boost-top.com/ http://boost-top.com/; do
  echo "== $u: $(curl -sS -o /dev/null --max-time 25 -w '%{http_code} %{time_total}s ip=%{remote_ip} -> %{redirect_url}' "$u" 2>&1 | tr '\n' ' ')" >> $O/summary.txt
done
echo "ping: $(ping -c 3 -W 3 mmb.boost-top.com 2>&1 | tail -2 | tr '\n' ' ')" >> $O/summary.txt
echo "tcp80: $(timeout 10 bash -c 'echo > /dev/tcp/mmb.boost-top.com/80' && echo open || echo closed)" >> $O/summary.txt
