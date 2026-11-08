#!/bin/bash
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
R=jamic2922220-alt/xclient-pc
P=/c/X-CLIENT-oflayn; mkdir -p $P
gh release download xclient-latest --repo $R -p 'X-Client-Setup.exe' -D $P --clobber 2>&1 | tail -1
gh release download cs16 --repo $R -p 'CS_1_6_boost-top_PRO_2_5_3.exe' -D $P --clobber 2>&1 | tail -1
cat > $P/OQING.txt <<'T'
X CLIENT - OFLAYN PAKET (internetsiz o'rnatish)

1. Zip'ni oching va papkani Ish stoli yoki Yuklamalar ichiga qo'ying.
2. X-Client-Setup.exe ni oching va o'rnating.
3. X CLIENT ochilganda CS 1.6 ni internetdan yuklamaydi - shu papkadagi
   CS_1_6_boost-top_PRO_2_5_3.exe dan o'zi o'rnatadi (1-2 daqiqa).

Antivirus to'xtatsa: papkani antivirus istisnolariga qo'shing.
Sayt: cssborka.uz/xclient

-----
X CLIENT - ОФЛАЙН ПАКЕТ (установка без интернета)
1. Распакуйте папку на Рабочий стол или в Загрузки.
2. Запустите X-Client-Setup.exe и установите.
3. CS 1.6 установится из этой папки, без скачивания.
T
(cd /c && 7z a -tzip -mx=1 X-CLIENT-oflayn.zip X-CLIENT-oflayn >/dev/null) && echo "zip $(stat -c %s /c/X-CLIENT-oflayn.zip)" >> $O/summary.txt
ls -la $P >> $O/summary.txt
gh release view oflayn --repo $R >/dev/null 2>&1 || gh release create oflayn --repo $R --title "X CLIENT oflayn paket" --notes "X CLIENT + CS 1.6 bitta paketda: internetsiz o'rnatish. OQING.txt ni o'qing." >> $O/summary.txt 2>&1
gh release upload oflayn /c/X-CLIENT-oflayn.zip --repo $R --clobber >> $O/summary.txt 2>&1 && echo "upload OK" >> $O/summary.txt
