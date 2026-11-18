# Reels 7-qism: "2026-yilning eng zo'r sborkasi qaysi?"

Qayta yig'ish (scratchpad yoki istalgan papkada):
1. `img/` ga logo_big.png, hero_f.png, hero_b.png (theme/platform/xclient dan) ko'chiring.
2. Menyu skrinshotlari: `bash run_cap.sh` (R9 ni shu papkaga o'zgartiring) -> `shots/`.
3. Telefon ekranlari: `cd phone && node cap.js` -> `phone/ph_*.png`.
4. Musiqa: `python3 music9.py 90 music9.wav` (drop 13.71 s da).
5. Ovoz: OVOZ_MATNI_7qism.txt -> ElevenLabs (Davronbek, v4) -> up/vo7.mp3; gap vaqtlari timing.json da (silencedetect bo'yicha).
6. `python3 sfx9.py timing.json sfx.wav && python3 reel9.py timing.json video.mp4`, keyin ffmpeg aralashtirish
   (musiqa atrim 4.20 s dan, ovoz sidechain bilan musiqani pasaytiradi).
