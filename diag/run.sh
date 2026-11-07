#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
B=https://mmb.boost-top.com
S "ver: $(curl -s -m 20 $B/ver.txt)"
S "prob+x: $(curl -s -m 20 "$B/xc_api.php?a=prob&k=bogus&x=test")"
S "launcher: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.100&ch=stable" | grep version)"
S "admin: $(curl -s -m 20 -o /dev/null -w '%{http_code}' "$B/admin.php?p=prob")"
