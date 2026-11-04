#!/bin/bash
O=diag/out; mkdir -p $O/vo; : > $O/summary.txt
pip install -q edge-tts >/dev/null 2>&1
V=uz-UZ-SardorNeural
g() { edge-tts --voice $V --rate=+2% --text "$2" --write-media "$O/vo/$1.mp3" >/dev/null 2>&1 && echo "ok $1" >> $O/summary.txt || echo "FAIL $1" >> $O/summary.txt; }
g 01 "To'xta! Kontr-Strayk bir olti o'ynaysanmi? Unda buni oxirigacha ko'r. Oxirida sen hali ko'rmagan narsa bor."
g 02 "Bu — Iks Klayent. Kontr-Strayk bir olti uchun bepul dastur. Oddiy o'yinni butunlay boshqa darajaga olib chiqadi."
g 03 "Ef o'n tugmasini bosasan — eng zo'r killaring tiniq videoga yoziladi. O'yin sekinlashmaydi."
g 04 "Har bir o'yining hisoblanadi: xedshot foizi, sevimli quroling, eng zo'r xaritang."
g 05 "Do'stlaring qaysi serverda o'ynayotganini ko'rasan va bitta bosishda yoniga kirasan."
g 06 "Vip serverga har safar parol yozish shart emas. Iks Klayent o'zi kiritadi."
g 07 "Kompyuteringiz kuchsizmi? Iks Klayent o'zi sozlaydi. O'yin qotmaydi."
g 08 "Akkaunt ochsang — besh yuz ochko va sovg'a sandiq darhol seniki."
g 09 "Yuklab olish juda oson: si-es-es borka nuqta uz saytiga kir va Iks Klayentni bepul yuklab ol."
g 10 "Lekin bu hali hammasi emas... Iks Klayentning eng zo'r funksiyasini keyingi qismda ko'rsataman. O'tkazib yubormaslik uchun hoziroq obuna bo'l!"
