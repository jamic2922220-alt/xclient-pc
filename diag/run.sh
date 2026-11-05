#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
python3 - >> $O/summary.txt 2>&1 <<'P'
import socket,time
for ip in ['212.47.58.40','212.47.58.89','157.22.130.26']:
  for k in range(3):
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.settimeout(3)
    try:
        t=time.time();s.sendto(b'\xff\xff\xff\xffTSource Engine Query\x00',(ip,27015));d=s.recv(1400);print(ip,'OK',int((time.time()-t)*1000),'ms',d[:70]);break
    except Exception as e: print(ip,'try',k,'ERR',e)
P
for h in 212.47.58.40 212.47.58.89; do echo "ping $h: $(ping -c3 -W2 $h | tail -2 | tr '\n' ' ')" >> $O/summary.txt; done
