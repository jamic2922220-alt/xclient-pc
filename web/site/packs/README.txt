X CLIENT — PAKETLAR (ovozlar, modellar, NextClient yangilanishi)

Yangi paket qo'shish:
1) Shu "packs" papkasi ichida yangi papka oching. Nomi: kichik lotin harflar, raqam, _ yoki -
   Masalan: sound_pro
2) Uning ichiga "files" papkasini oching va o'yin papkasidagi kabi joylashtiring:
   packs/sound_pro/files/cstrike/sound/weapons/ak47-1.wav
   packs/nextclient_new/files/cstrike/cl_dlls/client.dll   (NextClient yangilanishi misoli)
3) Ixtiyoriy: packs/sound_pro/pack.json fayli (nomi va tavsifi menyuda chiqadi):
   {"name":"Ovozlar: Pro", "desc":"Aniqroq qurol ovozlari", "type":"sound"}

O'yinchi menyuda Sozlamalar > Kontent > PAKETLAR dan yoqadi. O'yin keyingi safar
XClient.exe orqali ochilganda fayllar o'rnatiladi; o'chirsa, asl fayllar qaytariladi.
