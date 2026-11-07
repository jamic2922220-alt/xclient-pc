#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/p3.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/l7WnLAhAg1Jw5q3XqTQ0/IhIuolQq7jR38ygOElf3/content.mp3?Expires=1794042000&KeyName=assets-cdn-key-1&Signature=F9G7Ps72AC2JIRg-HIAc_rQSR6Q=" && echo "p3 $(stat -c %s $O/el/p3.mp3)" >> $O/summary.txt
