#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
B=https://mmb.boost-top.com
{
echo "ver: $(curl -s -m 15 "$B/ver.txt?x=$RANDOM" | head -c 40)"
for f in rel/10203400/xc.js rel/10203400/xc.css rel/10203400/xc_lang.js rel/10203400/index.html xc.html; do echo "$f: $(curl -s -o /dev/null -w '%{http_code} %{size_download}' -m 20 "$B/$f")"; done
echo "js lgCheck: $(curl -s -m 20 "$B/rel/10203400/xc.js" | grep -o lgCheck | wc -l)"
echo "lang lg_kbru: $(curl -s -m 20 "$B/rel/10203400/xc_lang.js" | grep -o lg_kbru | wc -l)"
T=$(curl -s -m 15 "$B/xc_api.php?a=top"); echo "top: $(echo "$T" | head -c 300)"
L=$(echo "$T" | grep -o '"login":"[^"]*"' | head -1 | cut -d'"' -f4); echo "real login: $L"
[ -n "$L" ] && echo "lc busy: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=$L" | head -c 200)"
echo "lc free: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=zzq$RANDOM" | head -c 200)"
} >> $O/summary.txt 2>&1
