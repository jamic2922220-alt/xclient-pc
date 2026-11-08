#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/p5b.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/piVOsoNoupo9aGbDd3el/M0zIUkONetT2saBlOTyy/content.mp3?Expires=1794171600&KeyName=assets-cdn-key-1&Signature=FKg3br-pmWRt_fkNhc4EjuoTVgI=" && echo "p5b $(stat -c %s $O/el/p5b.mp3)" >> $O/summary.txt
