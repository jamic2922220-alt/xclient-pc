#!/bin/bash
# LAN (launcher 1.0.141): har tarmoq kartasiga keng tarqatma qidiruv + firewall ruxsati
O=$PWD/diag/out; mkdir -p $O; : > $O/summary.txt
python diag/vf/fakesrv.py & sleep 3
./diag/vf/xcl_test.exe --lantest "$(cygpath -w $O/lan.txt)"; echo "lan rc=$?" >> $O/summary.txt
cat $O/lan.txt >> $O/summary.txt 2>&1; echo >> $O/summary.txt
ipconfig | grep -i "IPv4\|Subnet" >> $O/summary.txt
echo "--- firewall" >> $O/summary.txt
./diag/vf/xcl_test.exe --fwtest; echo "fw rc=$?" >> $O/summary.txt
netsh advfirewall firewall show rule name="CS 1.6 LAN (X CLIENT)" | grep -i "Rule Name\|Direction\|Action\|Program\|Profiles\|Enabled" >> $O/summary.txt 2>&1
# 7
