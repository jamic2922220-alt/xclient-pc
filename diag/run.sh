#!/bin/bash
# o'yin paytidagi yuklama o'lchovi (launcher 1.0.140): bitta yadroni 150 s band qiladigan exe
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
T=$(cygpath -w $O/perf.txt)
./diag/vf/xcl_test.exe --perftest "$T" "$(cygpath -w $PWD/diag/vf/busy.exe)"; echo "perf rc=$?" >> $O/summary.txt
cat $O/perf.txt >> $O/summary.txt; echo >> $O/summary.txt
nproc >> $O/summary.txt
# 5
