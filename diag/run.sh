#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
UA="Dalvik/2.1.0 (Linux; U; Android 11; SM-A125F Build/RP1A.200720.012)"
for u in /servers.php /mobile.json /stats.php /ms.php?q=x /flag.php?c=uz /mobile/cs16_data.zip /xc.html; do
  echo "== http $u" >> $O/summary.txt
  curl -s -A "$UA" -o /tmp/b -D - --max-time 30 -r 0-300 "http://mmb.boost-top.com$u" | head -12 >> $O/summary.txt
  echo "-- body: $(head -c 300 /tmp/b | tr -d '\0' | tr '\n' ' ')" >> $O/summary.txt
done
echo "== https mobile.json: $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' https://mmb.boost-top.com/mobile.json)" >> $O/summary.txt
