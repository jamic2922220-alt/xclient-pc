#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
U="https://cssborka.uz/uploads/files/1791198609_6ac38591b615c_CS_1_6_boost-top_PRO_2_5_3.exe"
F=CS_1_6_boost-top_PRO_2_5_3.exe
curl -sSL -m 1500 -o $F "$U"; echo "size $(stat -c %s $F) sha $(sha256sum $F | cut -c1-64)" >> $O/summary.txt
file $F >> $O/summary.txt
if [ $(stat -c %s $F) -gt 100000000 ]; then
  gh release view cs16 -R $GITHUB_REPOSITORY >/dev/null 2>&1 || gh release create cs16 -R $GITHUB_REPOSITORY --title "CS 1.6 o'rnatuvchisi (zaxira manzil)" --notes "X CLIENT launcher cssborka.uz ishlamasa CS 1.6 ni shu yerdan yuklaydi." --latest=false >> $O/summary.txt 2>&1
  gh release upload cs16 $F -R $GITHUB_REPOSITORY --clobber >> $O/summary.txt 2>&1
  gh release view cs16 -R $GITHUB_REPOSITORY --json assets -q '.assets[]|.name+" "+(.size|tostring)+" "+.url' >> $O/summary.txt 2>&1
fi
curl -sI -L "https://github.com/$GITHUB_REPOSITORY/releases/download/cs16/$F" -r 0-99 | grep -i "^HTTP\|content-range\|content-length" >> $O/summary.txt
