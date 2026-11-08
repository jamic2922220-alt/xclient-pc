#!/bin/bash
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
gh release delete oflayn --repo jamic2922220-alt/xclient-pc --cleanup-tag -y >> $O/summary.txt 2>&1 && echo "oflayn o'chirildi" >> $O/summary.txt
gh release view xclient-latest --repo jamic2922220-alt/xclient-pc --json assets -q '.assets[]|.name+" "+(.size|tostring)' >> $O/summary.txt 2>&1
