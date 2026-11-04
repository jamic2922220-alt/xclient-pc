#!/bin/bash
O=diag/out; mkdir -p $O/ann; : > $O/summary.txt
pip install -q edge-tts >/dev/null 2>&1
gen() { # til ovoz nom matn
  mkdir -p $O/ann/$1
  edge-tts --voice "$2" --rate=+8% --pitch=-6Hz --text "$4" --write-media "$O/ann/$1/$3.mp3" >/dev/null 2>&1 && echo "ok $1/$3" >> $O/summary.txt || echo "FAIL $1/$3" >> $O/summary.txt
}
U=uz-UZ-SardorNeural; R=ru-RU-DmitryNeural; E=en-US-GuyNeural
gen uz $U hs "Boshga!"; gen uz $U k2 "Ikki kill!"; gen uz $U k3 "Uch kill!"; gen uz $U k4 "To'rt kill!"; gen uz $U ace "Hammasini qirding!"
gen uz $U onfire "Qizib ketding!"; gen uz $U unstop "To'xtatib bo'lmaydi!"; gen uz $U legend "Afsona!"; gen uz $U knife "Pichoq bilan!"; gen uz $U grenade "Granata!"
gen ru $R hs "В голову!"; gen ru $R k2 "Двойное!"; gen ru $R k3 "Тройное!"; gen ru $R k4 "Мульти килл!"; gen ru $R ace "Эйс!"
gen ru $R onfire "В ударе!"; gen ru $R unstop "Неудержим!"; gen ru $R legend "Легенда!"; gen ru $R knife "Ножом!"; gen ru $R grenade "Гранатой!"
gen en $E hs "Headshot!"; gen en $E k2 "Double kill!"; gen en $E k3 "Triple kill!"; gen en $E k4 "Multi kill!"; gen en $E ace "Ace!"
gen en $E onfire "On fire!"; gen en $E unstop "Unstoppable!"; gen en $E legend "Legendary!"; gen en $E knife "Humiliation!"; gen en $E grenade "Boom!"
