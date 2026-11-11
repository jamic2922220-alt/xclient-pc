#!/bin/bash
# xotira bo'shatish (launcher 1.0.142): 600 MB band qilgan dastur -> ram_trim
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
./diag/vf/hog.exe & sleep 8
tasklist //FI "IMAGENAME eq hog.exe" //FO CSV >> $O/summary.txt
./diag/vf/xcl_test.exe --ramtest "$(cygpath -w $O/ram.txt)"; echo "ram rc=$?" >> $O/summary.txt
cat $O/ram.txt >> $O/summary.txt; echo >> $O/summary.txt
tasklist //FI "IMAGENAME eq hog.exe" //FO CSV >> $O/summary.txt
# 8
