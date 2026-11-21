# Antivirus X CLIENT'ni xato bloklasa — Microsoft va antiviruslarga yuborish

X CLIENT imzolanmagan (kod imzolash sertifikati yo'q), shuning uchun Windows Defender va ba'zi antiviruslar uni
"noma'lum dastur" deb to'xtatishi mumkin. Fayllarni antivirus kompaniyalariga "xato aniqlandi" deb yuborish **bepul**.
Har yangi launcher versiyasidan keyin (yoki o'yinchilar antivirusdan shikoyat qilsa) qiling — 5–10 daqiqa.

## 1. Microsoft Defender (eng muhimi — Windows'ning o'zi)

1. Oching: **https://www.microsoft.com/en-us/wdsi/filesubmission**
2. **"Software developer"** ni tanlang va Microsoft akkauntingiz bilan kiring.
3. **Product:** "Microsoft Defender Antivirus (Windows 10/11)".
4. **File:** `XCLauncher.exe` (o'yin papkasida, masalan `C:\Games\X CLIENT\`) — keyin alohida `X-Client-Setup.exe` ni ham yuboring.
5. **"What do you believe this file is?"** → **"Incorrectly detected as malware/malicious"**.
6. **Detection name:** Defender oynasida yozilgan nom (masalan `Trojan:Win32/Wacatac`). Bilmasangiz — bo'sh qoldiring.
7. **Additional information:** `X CLIENT - Counter-Strike 1.6 launcher (game updater). Downloads updates from mmb.boost-top.com and github.com/jamic2922220-alt/xclient-pc. Not malware.`
8. **Submit**. Javob odatda 1–3 kunda emailga keladi, shundan keyin Defender bloklamaydi.

## 2. Boshqa antiviruslar (o'yinchilar ko'p ishlatadigan)

| Antivirus | Manzil |
|---|---|
| Kaspersky | https://opentip.kaspersky.com/ (faylni yuklang → "Report false positive") |
| Avast / AVG | https://www.avast.com/false-positive-file-form.php |
| ESET (NOD32) | https://support.eset.com/en/kb141 (samples@eset.com ga zip, parol `infected`) |
| Dr.Web | https://vms.drweb.com/sendvirus/ (False positive) |

## 3. Butunlay yechim

Kod imzolash sertifikati (Code Signing, yiliga taxminan $70–300) — imzolangan exe'ni Windows va antiviruslar ancha kam bloklaydi,
ko'k "Windows защитил ваш компьютер" oynasi ham asta-sekin yo'qoladi. Sertifikat olinsa — GitHub workflow'ga imzolash qadamini qo'shamiz.
