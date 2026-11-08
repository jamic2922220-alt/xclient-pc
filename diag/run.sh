#!/bin/bash
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
sudo dpkg --add-architecture i386 >/dev/null 2>&1; sudo apt-get update -qq >/dev/null 2>&1
sudo apt-get install -y -qq wine32:i386 wine binutils-mingw-w64-i686 xvfb >/dev/null 2>&1
echo "wine: $(wine --version 2>&1)" >> $O/summary.txt
W=/tmp/cs; mkdir -p $W
gh release download cs16 --repo jamic2922220-alt/xclient-pc -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $W 2>&1 | tail -1
export WINEDEBUG=-all WINEPREFIX=$HOME/wp
wineboot -i >/dev/null 2>&1
timeout 1200 xvfb-run -a wine $W/CS_1_6_boost-top_PRO_2_5_3.exe /VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS '/TASKS=""' /LANG=uzbek '/DIR=C:\cs' '/LOG=C:\inst.log' > $O/wine.txt 2>&1; echo "rc=$?" >> $O/summary.txt
tail -15 $HOME/wp/drive_c/inst.log >> $O/summary.txt 2>&1
G=$(find $HOME/wp/drive_c -maxdepth 4 -iname 'hl.exe' -printf '%h\n' | head -1); echo "G=$G" >> $O/summary.txt
echo "files: $(find $G -type f 2>/dev/null | wc -l)" >> $O/summary.txt
ls $G >> $O/summary.txt 2>&1
for f in $(find $G -maxdepth 1 \( -iname '*.exe' -o -iname '*.dll' \) | sort); do
  echo "=== $(basename $f) $(stat -c %s $f) md5=$(md5sum $f | cut -c1-12) $(i686-w64-mingw32-objdump -p $f | grep -E 'MajorOSVersion|MajorSubsystemVersion' | awk '{print $2}' | tr '\n' ' ')" >> $O/summary.txt
  i686-w64-mingw32-objdump -p "$f" | grep "DLL Name" | awk '{print $3}' | tr '\n' ' ' >> $O/summary.txt; echo >> $O/summary.txt
done
T=$(find $G -maxdepth 1 -iname tier0.dll | head -1)
if [ -n "$T" ]; then
 echo "== tier0 advapi32 imports" >> $O/summary.txt
 i686-w64-mingw32-objdump -p "$T" | awk '/DLL Name: [Aa][Dd][Vv][Aa][Pp][Ii]32/{f=1;next} /DLL Name/{f=0} f && NF>=3{print $NF}' | tr '\n' ' ' >> $O/summary.txt; echo >> $O/summary.txt
 echo "== tier0 kernel32 imports" >> $O/summary.txt
 i686-w64-mingw32-objdump -p "$T" | awk '/DLL Name: [Kk][Ee][Rr][Nn][Ee][Ll]32/{f=1;next} /DLL Name/{f=0} f && NF>=3{print $NF}' | tr '\n' ' ' >> $O/summary.txt; echo >> $O/summary.txt
 i686-w64-mingw32-objdump -d "$T" | grep -cE "\s(pinsrd|pextrd|ptest|crc32|vmov[a-z]*|popcnt|lzcnt|tzcnt|pmulld|pshufb|palignr)\s" | sed 's/^/tier0 sse4+ insn=/' >> $O/summary.txt
 strings -n 6 "$T" | grep -iE "^(Windows|SSE|AVX|Valve|Steam|build)|version" | head -15 >> $O/summary.txt
fi
