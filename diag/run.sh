#!/bin/bash
O=$PWD/diag/out; mkdir -p $O/bin; : > $O/summary.txt
W=/c/cs16tmp; mkdir -p $W
gh release download cs16 --repo jamic2922220-alt/xclient-pc -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $W 2>&1 | tail -1
cmd //c "C:\\cs16tmp\\CS_1_6_boost-top_PRO_2_5_3.exe /VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS=\"\" /DIR=C:\\csgame /LOG=C:\\cs16tmp\\inst.log"
echo "rc=$?" >> $O/summary.txt
tail -5 $W/inst.log >> $O/summary.txt 2>&1
find /c/csgame -maxdepth 4 \( -iname '*.exe' -o -iname 'tier0.dll' -o -iname 'hw.dll' \) >> $O/summary.txt
G=$(dirname "$(find /c/csgame -maxdepth 4 -iname tier0.dll | head -1)"); echo "G=$G" >> $O/summary.txt
ls -la "$G" >> $O/summary.txt
for f in "$G"/*.exe "$G"/*.dll; do cp "$f" $O/bin/ 2>/dev/null; done
du -sh $O/bin >> $O/summary.txt
