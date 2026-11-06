#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
for u in https://mmb.boost-top.com/ https://mmb.boost-top.com/xclient/ https://mmb.boost-top.com/xclient/ver.txt https://mmb.boost-top.com/xclient/index.html https://mmb.boost-top.com/xclient/xc.js https://mmb.boost-top.com/xclient/xc.css https://mmb.boost-top.com/xclient/xc_lang.js https://mmb.boost-top.com/xc_api.php https://cssborka.uz/xclient https://mmb.boost-top.com/xclient/menyu.zip; do
  echo "$u $(curl -s -m 20 -o /tmp/o -w '%{http_code} %{size_download} %{time_total}' $u) $(head -c 120 /tmp/o | tr '\n' ' ')" >> $O/summary.txt
done
curl -s -m 20 -X POST https://mmb.boost-top.com/xc_api.php -d 'a=hello&d=diagdev0000001&v=1.0.116&lang=uz' | head -c 400 >> $O/summary.txt; echo >> $O/summary.txt
curl -s -m 20 https://mmb.boost-top.com/xclient/index.html > $O/index.html; curl -s -m 20 https://mmb.boost-top.com/xclient/xc.js > $O/xc.js
