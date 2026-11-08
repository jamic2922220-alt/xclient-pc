#!/bin/bash
O=$PWD/diag/out; mkdir -p $O/vf; : > $O/summary.txt
powershell -NoProfile -Command "Get-WindowsFeature Server-Media-Foundation | Select Name,InstallState | Out-String" >> $O/summary.txt 2>&1
for f in 1 2 3 4; do
  cp diag/vf/src.mp4 "$O/vf/v$f.mp4"
  W=$(cygpath -w "$O/vf/v$f.mp4")
  ./diag/vf/xcl_test.exe --vftest $f "$W"; echo "fmt$f rc=$? size=$(stat -c %s $O/vf/v$f.mp4)" >> $O/summary.txt
done
# 2
