#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
B=https://mmb.boost-top.com
{
echo "ver: $(curl -s -m 15 "$B/platform/xclient/ver.txt?x=$RANDOM")"
echo "menuver: $(curl -s -m 15 "$B/xc_api.php?a=menuver" | head -c 200)"
for f in rel/10203400/xc.js rel/10203400/xc.css rel/10203400/xc_lang.js; do echo "$f: $(curl -s -o /dev/null -w '%{http_code} %{size_download}' -m 20 "$B/platform/xclient/$f")"; done
echo "js lgCheck: $(curl -s -m 20 "$B/platform/xclient/rel/10203400/xc.js" | grep -c lgCheck)"
echo "lc free: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=zzq$RANDOM" | head -c 200)"
echo "lc busy: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=admin" | head -c 200)"
echo "lc short: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=ab" | head -c 200)"
echo "lc cyr: $(curl -s -m 15 "$B/xc_api.php?a=login_check&login=%D0%A8%D0%B5%D1%80%D0%B7%D0%BE%D0%B4" | head -c 200)"
echo "root: $(curl -s -m 15 "$B/platform/xclient/xc.html" | grep -o '10203[0-9]*' | sort -u | tr '\n' ' ')"
echo "hello: $(curl -s -m 15 "$B/xc_api.php?a=hello" | head -c 120)"
} >> $O/summary.txt 2>&1
