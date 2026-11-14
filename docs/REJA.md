# X CLIENT — keyingi ishlar rejasi

Egasi tanlagan (2026-11-12), navbat bilan qilinadi:

1. **Do'stni taklif qilish ko'rinadigan bo'lsin** — taklif kodi bor, lekin ko'rinmaydi. O'yin xulosasiga, LAN bo'limiga
   va bosh ekranga «Do'stingni chaqir — ikkalangizga sandiq» tugmasi; do'st kirib o'ynasa ikkalasiga mukofot.
2. ~~O'yin ichida FPS va ping ko'rsatkichi~~ — qilindi (10205300): HUD > FPS va ping + joyi (chap/o'rta/o'ng); lagni tuzatishda o'zi yoqiladi.
3. ~~Admin panel: «Lag» sahifasi~~ — qilindi (10205300), Yiqilishlar sahifasida damplarni yuklab olish ham.
   Asl reja: — o'yinchilar o'lchagan ping (gperf) va kompyuter yuklamasi (perfl) grafik bilan:
   beqaror serverlar, protsessori to'la band kompyuterlar, xotira kam (ram_low), lag dedi (lag=1).

Qilindi (2026-11-12, menyu 10205200):
- O'yin xulosasi ulashilganda havola - g.php sahifasi: Telegram'da karta rasmi + sarlavha + "cssborka.uz/xclient", yuklab olish tugmasi, taklif kodi; kanal yozuvida ham sayt.
- Unvon o'yinda nik oldida ([Gold]Nik) - ixtiyoriy, Sozlamalar > O'yin.
- Vazifalar: bajarilgan, olinmagan vazifalar soni chap menyuda belgi bilan.
- Allaqachon bor edi: kunlik vazifalar, mikrofon sinovi (voice_loopback) va mikrofonni tuzatish, pritsel galereyasi, FPS/net_graph tugmalari.

Keyingi (egasi tanladi, 2026-11-13):
- ✅ **Granata mashqi** (10205700: botsiz, F3 granatalar, F4 noclip, 4 xarita uchun joylar) (botlar bilan mashq bo'limida): cheksiz pul va sotib olish vaqti, botlarsiz yoki otmaydigan botlar,
  granatalarni qayta-qayta otish; ixtiyoriy - xaritani o'rganish (noclip, sv_cheats 1 faqat o'z serverida).
- ✅ **Internetsiz rejim** (launcher 1.0.147+): internet yo'q bo'lsa o'yinda oflayn menyu (botlar, LAN, IP), LAN ro'yxati launcherdan.
- ⏳ **Yangi o'yinchilar voronkasi**: upd/dl/dlh bosqichlari va probrep newdev - bir necha kun ma'lumot yig'ib, keyin tuzatish.
- 📌 **Telefon + kompyuter bitta akkaunt** (egasi tanladi, 2026-11-14): mobil ilovaga (cssborka.uz-mobile, Xash3D mainui)
  X CLIENT akkaunti - kirish (login/parol yoki kompyuterdagi menyudan QR), do'stlar onlayn, statistika (kill/o'yin),
  kunlik sovg'a/sandiq umumiy. Server: xc_api.php dagi mavjud token/register/login, mobil uchun device turi 'm'.
- ⏳ **Uzoq o'yindagi yiqilishlar**: o'yin xotirasi (gmem) o'lchanyapti - xotira to'lishimi, aniqlash.

Kutilmoqda:
- nDirect javobi: Windows 7 da tier0.dll TLS (dump: 85c2a708f2..._1794500973, admin kaliti bilan dmpget).
- Launcher 1.0.143: chala yuklangan o'rnatuvchi (dl_short) va chuqur yengillashtirish (lagfix2) natijalari.
