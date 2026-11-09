#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
for u in https://cssborka.uz/xclient/ https://cssborka.uz/xclient/index.html; do
  echo "== $u $(curl -sL -m 20 -o /tmp/p.html -w '%{http_code} %{size_download}' "$u")" >> $O/summary.txt
  echo "nega: $(grep -c 'Nega X CLIENT' /tmp/p.html)  q5win7: $(grep -c 'win7.html' /tmp/p.html)  246MB: $(grep -c '246 MB' /tmp/p.html)" >> $O/summary.txt
done
