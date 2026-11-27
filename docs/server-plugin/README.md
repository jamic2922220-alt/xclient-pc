# X CLIENT bonus — server plagini (AMX Mod X)

X CLIENT launcheri bilan o'ynayotganlarni taniydi va ularga kichik imtiyozlar beradi. Boshqa o'yinchilar buni ko'radi va X CLIENT ni yuklab olishadi.

## Nima qiladi
- Kirganda chatda e'lon: **"[X CLIENT] Nik X CLIENT bilan kirdi. Siz ham yuklab oling: cssborka.uz/xclient"**
- Nik oldiga **[X]** teg
- Har 10 daqiqada reklama: serverda nechta X CLIENT o'yinchisi borligi
- `/xclient` buyrug'i — yuklab olish manzili
- Ixtiyoriy: har raundda qo'shimcha pul, VIP huquqlari

## O'rnatish (server egasi uchun, 2 daqiqa)
1. `xclient_bonus.amxx` ni serverdagi `cstrike/addons/amxmodx/plugins/` papkasiga qo'ying.
2. `cstrike/addons/amxmodx/configs/plugins.ini` fayli oxiriga yozing: `xclient_bonus.amxx`
3. Serverni qayta ishga tushiring (yoki `restart` / xarita almashtirish).

AMX Mod X 1.8.2 va 1.9 da ishlaydi. Manba kodi: `xclient_bonus.sma`.

## Sozlamalar (`amxx.cfg`)
| Sozlama | Standart | Ma'nosi |
|---|---|---|
| `xc_tag` | `1` | Nikka [X] teg |
| `xc_join_msg` | `1` | Kirganda chatda e'lon |
| `xc_ad_min` | `10` | Reklama oralig'i (daqiqa), 0 = o'chiq |
| `xc_money` | `0` | Har raundda qo'shimcha pul (masalan `300`) |
| `xc_flags` | `""` | X CLIENT o'yinchilariga AMXX huquqlari (masalan `"t"` — VIP) |
| `xc_url` | `cssborka.uz/xclient` | Yuklab olish manzili |

Eslatma: X CLIENT belgisini (`setinfo _xc 1`) konsolda qo'lda ham yozish mumkin. Shuning uchun bonuslar kichik bo'lsin (teg, e'lon, ozgina pul, VIP chat) — o'yin muvozanatini buzmang.
