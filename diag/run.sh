#!/bin/bash
O=diag/out; mkdir -p $O/el; : > $O/summary.txt
curl -sS -o $O/el/a.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/XA1jQD4YJMjLDOqm2gXx/vELQEFiaYAbSNhY6vdDw/content.mp3?Expires=1793865600&KeyName=assets-cdn-key-1&Signature=ZFOLQ1T5A0sYAR4PgfZfz2Nf1jE=" && echo "a $(stat -c %s $O/el/a.mp3)" >> $O/summary.txt
curl -sS -o $O/el/b.mp3 "https://elevenlabsusercontent.com/database/workspace/f6a0d35706c649839d24af33b5a8ef91/content_generation/srw4szZRg93v73C4b4n3/77lDtJklL1f1nxaAR8bA/content.mp3?Expires=1793865600&KeyName=assets-cdn-key-1&Signature=b92J8epLp9_6vvo0Khi_IYC5Sak=" && echo "b $(stat -c %s $O/el/b.mp3)" >> $O/summary.txt
