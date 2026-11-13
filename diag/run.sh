#!/bin/bash
# internetsiz rejim (launcher): oflayn menyu manzili (bo'sh joy + kirill harfli papka) va LAN ro'yxati lan.js ga
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
G="$TEMP/X Test/Игра CS"; mkdir -p "$G/platform/xclient"; echo '<html>off</html>' > "$G/platform/xclient/offline.html"
python diag/fakesrv.py > $O/srv.txt 2>&1 & sleep 3
./diag/vf/xcl_test.exe --offtest "$(cygpath -w "$G")"; echo "offtest rc=$?" >> $O/summary.txt
echo "--- mmb_home_page.html:" >> $O/summary.txt; cat "$G/platform/mmb_home_page.html" >> $O/summary.txt; echo >> $O/summary.txt
echo "--- lan.js:" >> $O/summary.txt; cat "$G/platform/xclient/lan.js" >> $O/summary.txt 2>&1
echo "--- srv:" >> $O/summary.txt; cat $O/srv.txt >> $O/summary.txt
# fayl manzili haqiqatan ochiladimi (Chrome/Edge headless): file:/// URL dan sahifa matni
U=$(cat "$G/platform/mmb_home_page.html")
E="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"; [ -f "$E" ] || E="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$E" --headless --disable-gpu --dump-dom "$U" > $O/dom.txt 2>/dev/null; echo "--- dom:" >> $O/summary.txt; grep -oE "off</html>|<body>off|ERR_[A-Z_]+" $O/dom.txt | head -3 >> $O/summary.txt; wc -c < $O/dom.txt >> $O/summary.txt
# r2
