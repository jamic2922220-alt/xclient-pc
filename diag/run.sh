#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
sudo apt-get install -y -qq whois >/dev/null 2>&1
echo "rdns: $(getent hosts 51.89.39.107; dig +short -x 51.89.39.107 2>/dev/null)" >> $O/summary.txt
echo "whois: $(whois 51.89.39.107 2>/dev/null | grep -iE '^(netname|descr|org-name|country|OrgName)' | head -6 | tr '\n' ' ')" >> $O/summary.txt
for d in greyweb.ru www.greyweb.ru greyweb.net greyweb.com my.greyweb.ru bill.greyweb.ru; do
  echo "== $d dns=$(getent hosts $d | head -1 | tr -s ' ') http=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}->%{redirect_url}' https://$d 2>&1 | tail -1)" >> $O/summary.txt
done
echo "== 51.89.39.107: $(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' http://51.89.39.107 2>&1 | tail -1)" >> $O/summary.txt
echo "trace: $(traceroute -n -w 2 -q 1 -m 20 51.89.39.107 2>/dev/null | tail -6 | tr '\n' '|')" >> $O/summary.txt
