#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
echo "ver: $(curl -s -m 20 https://mmb.boost-top.com/ver.txt) launcher: $(curl -s -m 20 "http://mmb.boost-top.com/xclient/api.php?a=update&v=1.0.100&ch=stable" | grep version)" >> $O/summary.txt
