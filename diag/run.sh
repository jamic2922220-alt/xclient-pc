#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&k=&id=diagtest0001&v=1.0.116&os=10&ch=stable" | head -c 700 >> $O/summary.txt
