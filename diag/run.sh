#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/p2.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/OgtyWIwt86dmM6ts5Qg9/AAAPEGzJmBluQOmrL44f/content.mp3?Expires=1793890800&KeyName=assets-cdn-key-1&Signature=ak2ZX0U1ziRMz5xOJszRzVIs7rE=" && echo "p2 $(stat -c %s $O/el/p2.mp3)" >> $O/summary.txt
