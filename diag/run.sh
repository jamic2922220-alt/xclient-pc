#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/p4.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/waTjim6LPVAkQQG4tfTE/Ln83rrowiCgOIQmPD2IV/content.mp3?Expires=1794124800&KeyName=assets-cdn-key-1&Signature=4CJWjDWepkXhhjFshdV1ApV2JjE=" && echo "p4 $(stat -c %s $O/el/p4.mp3)" >> $O/summary.txt
