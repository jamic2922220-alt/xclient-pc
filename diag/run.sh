#!/bin/bash
# yiqilish dampi (launcher 1.0.139): kuzatuvda yiqiladigan exe -> %TEMP%\xc_crash.dmp
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
./diag/vf/xcl_test.exe --dmptest "$(cygpath -w $PWD/diag/vf/crash.exe)"; echo "dmp rc=$?" >> $O/summary.txt
T=$(cygpath -u "$TEMP")
cat "$T/xc_dmptest.txt" >> $O/summary.txt; echo >> $O/summary.txt
ls -la "$T/xc_crash.dmp" >> $O/summary.txt 2>&1
head -c 4 "$T/xc_crash.dmp" >> $O/summary.txt; echo >> $O/summary.txt
python -c "import sys;d=open(sys.argv[1],'rb').read();import struct;n,off=struct.unpack('<II',d[8:16]);ty=[struct.unpack('<I',d[off+i*12:off+i*12+4])[0] for i in range(n)];print('streams',ty)" "$T/xc_crash.dmp" >> $O/summary.txt 2>&1
cp "$T/xc_crash.dmp" $O/ 2>/dev/null
# 4
