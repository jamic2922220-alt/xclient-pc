#!/bin/bash
O=$PWD/diag/out; mkdir -p $O/nc; : > $O/summary.txt
W=/c/cs16tmp; mkdir -p $W
gh release download cs16 --repo jamic2922220-alt/xclient-pc -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $W 2>&1 | tail -1
cmd //c "C:\\cs16tmp\\CS_1_6_boost-top_PRO_2_5_3.exe /VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS=\"\" /DIR=C:\\csgame"
G=/c/csgame
# matnli resurslar: "полосы", "Адаптивный", "мигает" va .res fayllar
grep -rlaI -e "полосы" -e "мигает" -e "Поверх всех" -e "Адаптивный" $G --include=*.txt --include=*.res --include=*.json --include=*.cfg --include=*.lst 2>/dev/null | head -20 >> $O/summary.txt
find $G -iname "*options*video*" -o -iname "*video*.res" | head >> $O/summary.txt
for f in $(grep -rlaI -e "полосы" -e "мигает" -e "Адаптивный" $G 2>/dev/null | head -8); do cp "$f" $O/nc/ 2>/dev/null; done
# exe/dll ichidagi cvar nomlari (UTF-16 va ASCII)
for f in $G/cstrike.exe $G/next_lib.dll $G/next_engine_mini.dll $G/hw.dll; do
  echo "== $(basename $f)" >> $O/summary.txt
  strings -a -n 5 "$f" | grep -iE "^(cl_|gl_|vid_|r_|fov|m_|hud_|_|nc_|next_|window|sv_)[a-z0-9_]{2,40}$" | sort -u > $O/nc/$(basename $f).cvars.txt
  wc -l < $O/nc/$(basename $f).cvars.txt >> $O/summary.txt
done
ls $G/platform $G/platform/resource 2>/dev/null | head -40 >> $O/summary.txt
ls $G/cstrike/resource 2>/dev/null | head -60 >> $O/summary.txt
