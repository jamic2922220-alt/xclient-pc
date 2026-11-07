# Antivirus X CLIENT'ni "virus" desa — nima qilish kerak

X CLIENT'da hozircha raqamli imzo (sertifikat) yo'q. Shu sababli ba'zi antiviruslar yangi versiyani "noma'lum fayl" deb ushlab qolishi mumkin. Bu **xato ogohlantirish** (inglizcha *false positive*). Uni antivirus kompaniyasiga yuborsangiz, ular tekshirib, faylni "toza" ro'yxatiga qo'shadi. Bu bepul.

Yangi launcher versiyasi chiqqanda (yoki o'yinchi "antivirus o'chirib tashladi" desa) quyidagilarni qiling.

## 1. Qaysi antivirus ushlayotganini bilish (2 daqiqa)

1. https://www.virustotal.com saytini oching.
2. **Choose file** tugmasini bosib, `XCLauncher.exe` yoki `X-Client-Setup.exe` faylini tanlang.
3. 1-2 daqiqada natija chiqadi: 70 ga yaqin antivirus ro'yxati. Qizil rang bilan belgilanganlari faylni ushlaganlar.
4. Agar hammasi yashil bo'lsa, hech narsa qilish shart emas.

## 2. Ushlagan antivirusga "bu virus emas" deb yuborish

Faqat qizil chiqqan antiviruslarga yuboring. Har birida forma bor: fayl, emailingiz va qisqa izoh so'raladi.

**Izoh uchun tayyor matn (inglizcha, nusxa olib qo'ying):**

> This is a false positive. XCLauncher.exe is the launcher of X CLIENT, a free game launcher for Counter-Strike 1.6 (https://cssborka.uz/xclient). It updates game files, records gameplay video and opens the game. Please review and remove the detection.

| Antivirus | Qayerga yuboriladi |
|---|---|
| **Windows Defender** (eng muhimi — hammada bor) | https://www.microsoft.com/wdsi/filesubmission → Microsoft akkaunti bilan kiring → **Software developer** emas, **Home customer** ni tanlang → "Incorrectly detected as malware" |
| **Kaspersky** | https://opentip.kaspersky.com → faylni yuklang → natijada **Report false positive / Отправить на переанализ** |
| **Avast va AVG** (bitta kompaniya) | https://www.avast.com/false-positive-file-form.php |
| **ESET (NOD32)** | samples@eset.com manziliga xat: mavzu "False positive", fayl zip ichida, parol `infected` |
| **Boshqasi** | Google'da "<antivirus nomi> false positive submit" deb qidiring |

Odatda javob 1–3 kunda keladi. Tuzatilgach VirusTotal'da qayta tekshirib ko'ring: **Reanalyze** tugmasi bor.

## 3. O'yinchi "launcher ochilmayapti, antivirus o'chirib tashladi" desa

O'yinchiga shuni yuboring:

1. Antivirus oynasini oching → **Karantin** (Карантин / Quarantine).
2. `XCLauncher.exe` ni toping → **Tiklash** (Восстановить) → **Istisnolarga qo'shish** (Добавить в исключения).
3. X CLIENT'ni qayta oching.

## Muhim

- Hech qachon o'yinchilarga "antivirusni butunlay o'chiring" demang. Faqat bitta faylni tiklash yetarli.
- Raqamli imzo olinsa (yiliga taxminan $100+), bu muammo deyarli yo'qoladi. Launcher yig'ish jarayoni imzoga tayyor: sertifikatni GitHub sozlamalariga (`SIGN_PFX_B64` va `SIGN_PASS`) qo'shish kifoya.
