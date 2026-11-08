#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
sudo apt-get install -y -qq innoextract p7zip-full binutils-mingw-w64-i686 >/dev/null 2>&1
W=/tmp/cs; mkdir -p $W; cd $W
gh release download cs16 --repo jamic2922220-alt/xclient-pc -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $W 2>&1 | tail -1
cd - >/dev/null
ls -la $W >> $O/summary.txt
(cd $W && (innoextract -s -d x CS_1_6_boost-top_PRO_2_5_3.exe >/dev/null 2>&1 || 7z x -y -ox CS_1_6_boost-top_PRO_2_5_3.exe >/dev/null 2>&1))
echo "== exe/dll at root" >> $O/summary.txt
find $W/x -maxdepth 4 -iname '*.exe' -o -maxdepth 4 -iname 'tier0.dll' -o -maxdepth 4 -iname 'vstdlib.dll' -o -maxdepth 4 -iname 'hw.dll' | head -30 >> $O/summary.txt
for f in $(find $W/x -iname 'tier0.dll' -o -iname 'hl.exe' -o -iname 'cstrike.exe' | head -6); do
  echo "=== $f $(stat -c %s $f) $(md5sum $f | cut -c1-12)" >> $O/summary.txt
  i686-w64-mingw32-objdump -p "$f" | grep -E "DLL Name|MajorOSVersion|MinorOSVersion|MajorSubsystemVersion|MinorSubsystemVersion|DllCharacteristics|Time/Date" >> $O/summary.txt
  i686-w64-mingw32-objdump -p "$f" | awk '/DLL Name: (ADVAPI32|advapi32)/{f=1;next} /DLL Name/{f=0} f' | head -40 >> $O/summary.txt
  i686-w64-mingw32-objdump -d "$f" 2>/dev/null | grep -cE "\b(pinsrd|pextrd|ptest|pcmpeq q|crc32|vmov|vxor|popcnt|lzcnt|tzcnt|blsr|pmulld)\b" | sed 's/^/sse4avx_insn=/' >> $O/summary.txt
done
