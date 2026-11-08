#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/p5.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/YWCUy63PDWxfMX6YVzvk/GWDWGG5jlciojX5yFIv9/content.mp3?Expires=1794171600&KeyName=assets-cdn-key-1&Signature=k0-9yxkHocNGL2Eqfw2AWBVVbao=" && echo "p5 $(stat -c %s $O/el/p5.mp3)" >> $O/summary.txt
