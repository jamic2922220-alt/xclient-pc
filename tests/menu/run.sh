#!/bin/bash
# Menyu testlari: ./tests/menu/run.sh [--update]   (kerak: php, node + playwright, python3 + Pillow)
# Har chiqarishdan oldin: hamma oyna/bo'lim (JS xato, ko'rinish buzilishi, chat), o'yin ichi holati, skrinshotlar oldingisi bilan solishtiriladi.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../.." && pwd)
W=$(mktemp -d); PORT=8791; export XC_BASE=http://127.0.0.1:$PORT
cp -r "$ROOT/web/site/." "$W/"; rm -rf "$W/xc_data"; mkdir -p "$W/xc_data"
for f in xc.js xc.css xc_lang.js index.html ver.txt logo.png logo_big.png; do cp "$ROOT/theme/platform/xclient/$f" "$W/" 2>/dev/null; done
cp "$ROOT/theme/platform/xclient/index.html" "$W/xc.html"; cp -r "$ROOT/theme/platform/xclient/av" "$W/" 2>/dev/null
(cd "$W" && exec php -S 127.0.0.1:$PORT >/dev/null 2>&1) & SRV=$!
for i in $(seq 1 30); do curl -s -o /dev/null "$XC_BASE/ver.txt" && break; sleep 0.3; done
A=$XC_BASE/xc_api.php
export NODE_PATH="${NODE_PATH:-}:$(npm root -g 2>/dev/null):/opt/node-tools/node_modules"
rc=0
node "$HERE/lite.js" || rc=1                                          # launcher hali ko'rinmagan holat - hello'dan oldin
curl -s -d 'a=hello&d=testpc0000001&v=1.0.64&lang=uz' $A >/dev/null   # launcher bor deb (to'liq menyu, "sodda" emas)
REG=$(curl -s -d "a=register&login=testa&pass=secret12&device=testdev0001" $A); echo "register: ${REG:0:80}"; export XC_TOKEN=$(echo "$REG" | grep -o "\"token\":\"[a-f0-9]*\"" | cut -d\" -f4)
curl -s -d 'a=register&login=testb&pass=secret12&device=testdev0002' $A >/dev/null
php "$HERE/seed.php" "$W/xc_data"
export XC_SHOTS="$W/shots"; mkdir -p "$XC_SHOTS"
node "$HERE/crawl.js" || rc=1
node "$HERE/ingame.js" || rc=1
python3 "$HERE/visual.py" "$XC_SHOTS" ${1:-} || rc=1
echo "Skrinshotlar: $XC_SHOTS"
kill $SRV 2>/dev/null
[ $rc = 0 ] && echo "=== HAMMASI O'TDI ===" || echo "=== XATO BOR - CHIQARMANG ==="
exit $rc
