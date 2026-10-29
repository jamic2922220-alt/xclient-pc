#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
H=http://mmb.boost-top.com
echo "ms.php: [$(curl -s -m 30 "$H/ms.php?q=/v1/servers/cstrike" | head -c 300)]" >> $O/summary.txt
echo "ms.php hostlist: [$(curl -s -m 30 "$H/ms.php?q=/v1/servers/cstrike&t=1" -D - -o /dev/null | head -5 | tr -d '\r')]" >> $O/summary.txt
echo "top.php: [$(curl -s -m 30 "$H/top.php" | head -c 200)]" >> $O/summary.txt
echo "boost master: [$(curl -s -m 30 "https://boost-top.com/api/v1/servers/cstrike" | head -c 300)]" >> $O/summary.txt
