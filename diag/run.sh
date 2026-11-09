#!/bin/bash
# F11 skrinshot -> menyu ro'yxati va kichik rasm (launcher 1.0.138)
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
P="$USERPROFILE/Pictures/X CLIENT"
./diag/vf/xcl_test.exe --shottest; echo "shot1 rc=$?" >> $O/summary.txt
sleep 2
./diag/vf/xcl_test.exe --shottest; echo "shot2 rc=$?" >> $O/summary.txt
ls -la "$P" >> $O/summary.txt 2>&1
echo "--- thumbs" >> $O/summary.txt
ls -la "$P/.thumbs" >> $O/summary.txt 2>&1
for f in "$P"/.thumbs/*.jpg; do python -c "import sys;d=open(sys.argv[1],'rb').read();print(sys.argv[1][-30:],len(d),d[:2].hex())" "$f" >> $O/summary.txt; done
./diag/vf/xcl_test.exe --sltest "$(cygpath -w $O/sl.txt)"; echo "sl rc=$?" >> $O/summary.txt
cat $O/sl.txt >> $O/summary.txt; echo >> $O/summary.txt
cp "$P"/.thumbs/*.jpg $O/ 2>/dev/null
# 3
