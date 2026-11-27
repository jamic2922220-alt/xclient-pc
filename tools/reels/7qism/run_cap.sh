#!/bin/bash
# Menyu testlari: ./tests/menu/run.sh [--update]   (kerak: php, node + playwright, python3 + Pillow)
# Har chiqarishdan oldin: hamma oyna/bo'lim (JS xato, ko'rinish buzilishi, chat), o'yin ichi holati, skrinshotlar oldingisi bilan solishtiriladi.
set -u
HERE=/home/user/xclient-pc/tests/menu; ROOT=$(cd "$HERE/../.." && pwd)
W=$(mktemp -d); PORT=8791; export XC_BASE=http://127.0.0.1:$PORT
cp -r "$ROOT/web/site/." "$W/"; rm -rf "$W/xc_data"; mkdir -p "$W/xc_data"
for f in xc.js xc.css xc_lang.js index.html ver.txt logo.png logo_big.png; do cp "$ROOT/theme/platform/xclient/$f" "$W/" 2>/dev/null; done
cp "$ROOT/theme/platform/xclient/index.html" "$W/xc.html"; cp -r "$ROOT/theme/platform/xclient/av" "$W/" 2>/dev/null
(cd "$W" && exec php -S 127.0.0.1:$PORT >/dev/null 2>&1) & SRV=$!
for i in $(seq 1 30); do curl -s -o /dev/null "$XC_BASE/ver.txt" && break; sleep 0.3; done
A=$XC_BASE/xc_api.php
export NODE_PATH="${NODE_PATH:-}:$(npm root -g 2>/dev/null):/opt/node-tools/node_modules"
curl -s -d 'a=hello&d=testpc0000001&v=1.0.154&lang=uz' $A >/dev/null
REG=$(curl -s -d "a=register&login=Sardor&pass=secret12&device=testdev0001" $A); export XC_TOKEN=$(echo "$REG" | grep -o "\"token\":\"[a-f0-9]*\"" | cut -d\" -f4)
php "$HERE/seed.php" "$W/xc_data"
export R9=/tmp/claude-0/-home-user/c174bc30-11c3-5deb-b9e4-d277fe0ca5fd/scratchpad/r9
cp /tmp/claude-0/-home-user/c174bc30-11c3-5deb-b9e4-d277fe0ca5fd/scratchpad/r9/cap.js "$HERE/_cap9.js"; node "$HERE/_cap9.js"; rm -f "$HERE/_cap9.js"; kill $SRV
