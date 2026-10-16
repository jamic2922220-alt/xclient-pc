# X CLIENT — saytga yuklanadigan fayllar

Shu papkadagi hamma fayl `boost-top.com/mmb` papkasiga (o'yin ochadigan `http://mmb.boost-top.com/index.html`) yuklanadi:

| Fayl | Vazifasi |
|---|---|
| `index.html`, `xc.css`, `xc.js`, `xc_lang.js`, `logo.png`, `bg.jpg` | o'yin ichidagi X CLIENT menyusi |
| `xc_api.php` | akkaunt: ro'yxatdan o'tish, kirish, bulutga saqlash, do'stlar, TOP hafta, XP |

`xc_api.php` birinchi so'rovda `xc_data/` papkasini o'zi yaratadi (MySQL kerak emas). Papkaga ruxsat 755 bo'lishi kerak.
O'yinchiga VIP berish/olish: `xc_data/users/<login>.php` faylidagi `"vip":true` / `"vip":false`.
