#!/bin/bash
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
W=/c/amxx; mkdir -p $W; cd $W
curl -sSL -o a182.zip https://www.amxmodx.org/release/amxmodx-1.8.2-base-windows.zip; echo "182 zip $(stat -c %s a182.zip)" >> $O/summary.txt
mkdir -p v182 && (cd v182 && unzip -q ../a182.zip)
L=$(curl -sSL https://www.amxmodx.org/amxxdrop/1.9/amxmodx-latest-base-windows); echo "latest19: $L" >> $O/summary.txt
curl -sSL -o a19.zip "https://www.amxmodx.org/amxxdrop/1.9/$L"; mkdir -p v19 && (cd v19 && unzip -q ../a19.zip)
cd - >/dev/null
for v in v182 v19; do
  S=$(find $W/$v -iname amxxpc.exe | head -1); D=$(dirname "$S")
  cp diag/sp/xclient_bonus.sma "$D/"
  (cd "$D" && ./amxxpc.exe xclient_bonus.sma -oxclient_bonus_$v.amxx) >> $O/summary.txt 2>&1
  cp "$D/xclient_bonus_$v.amxx" $O/ 2>/dev/null && echo "$v OK $(stat -c %s $O/xclient_bonus_$v.amxx)" >> $O/summary.txt
done
