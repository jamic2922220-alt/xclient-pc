#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
curl -s -m 20 "http://mmb.boost-top.com/mobile.json?x=$RANDOM" >> $O/summary.txt 2>&1
