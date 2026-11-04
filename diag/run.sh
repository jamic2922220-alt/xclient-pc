#!/bin/bash
O=diag/out; mkdir -p $O/vo; : > $O/summary.txt
pip install -q edge-tts >/dev/null 2>&1
V=uz-UZ-SardorNeural
g() { edge-tts --voice $V --rate=+12% --pitch=+0Hz --text "$2" --write-media "$O/vo/$1.mp3" >/dev/null 2>&1 && echo "ok $1" >> $O/summary.txt || echo "FAIL $1" >> $O/summary.txt; }
g 01 "To'xta! CS 1.6 o'ynaysanmi? Unda buni oxirigacha ko'r. Oxirida sen hali ko'rmagan narsa bor."
g 02 "Bu — X CLIENT. Counter-Strike 1.6 uchun bepul launcher. Oddiy CS'ni butunlay boshqa darajaga olib chiqadi."
g 03 "F10 ni bosasan — eng zo'r killaring tiniq videoga yoziladi. FPS tushmaydi."
g 04 "Har bir o'yining hisoblanadi: headshot foizi, sevimli quroling, eng zo'r xaritang."
g 05 "Do'stlaring qaysi serverda o'ynayotganini ko'rasan va bitta bosishda yoniga kirasan."
g 06 "VIP serverga har safar parol yozish shart emas. X CLIENT o'zi kiritadi."
g 07 "Kompyuteringiz kuchsizmi? X CLIENT o'zi sozlaydi. O'yin qotmaydi."
g 08 "Akkaunt ochsang — besh yuz XP va sovg'a sandiq darhol seniki."
g 09 "Yuklab olish juda oson: cssborka.uz saytiga kir va X CLIENT ni bepul yuklab ol."
g 10 "Lekin bu hali hammasi emas... X CLIENT'ning eng zo'r funksiyasini keyingi qismda ko'rsataman. O'tkazib yubormaslik uchun hoziroq obuna bo'l!"
