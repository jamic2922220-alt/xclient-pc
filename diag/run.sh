#!/bin/bash
O=$PWD/diag/out; mkdir -p $O/vf; : > $O/summary.txt
./diag/vf/xcl_test.exe --shottest; echo "shot rc=$?" >> $O/summary.txt
P="$USERPROFILE/Pictures/X CLIENT"; ls -la "$P" >> $O/summary.txt 2>&1; cp "$P"/*.jpg $O/vf/ 2>/dev/null
for f in 1 3; do cp diag/vf/src.mp4 "$O/vf/v$f.mp4"; ./diag/vf/xcl_test.exe --vftest $f "$(cygpath -w "$O/vf/v$f.mp4")"; echo "fmt$f rc=$?" >> $O/summary.txt; done
