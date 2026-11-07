#!/bin/bash
O=diag/out; mkdir -p $O; : > $O/summary.txt
S(){ echo "$*" >> $O/summary.txt; }
for u in "a=prob&k=bogus&d=diagtest00000001&v=1.0.122" "a=prob&k=bogus&d=diagtest00000001&v=1.0.122&x=test" "a=prob&k=bogus&d=diagtest00000001&v=1.0.122&x=mod%3Dig4icd32.dll%20code%3Dc0000005%20off%3D0001a2b3%20app%3Dcstrike.exe" "a=prob&k=bogus&x=popup%3D%D0%BE%D1%88%D0%B8%D0%B1%D0%BA%D0%B0%20cstrike.exe"; do
  for sch in http https; do S "$sch $(curl -s -m 20 -o /tmp/o -w '%{http_code}' "$sch://mmb.boost-top.com/xc_api.php?$u") $(head -c 80 /tmp/o | tr -d '\n') <- $u"; done
done
