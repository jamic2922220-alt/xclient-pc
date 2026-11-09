#!/bin/bash
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
python diag/vf/fakesrv.py & sleep 3
./diag/vf/xcl_test.exe --lantest "$(cygpath -w $O/lan.txt)"; echo "lan rc=$?" >> $O/summary.txt
cat $O/lan.txt >> $O/summary.txt 2>&1; echo >> $O/summary.txt
ipconfig | grep -i "IPv4" >> $O/summary.txt
# 2
