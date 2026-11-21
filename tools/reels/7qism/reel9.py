# X CLIENT Reels 7-qism: "2026-yilning eng zo'r sborkasi qaysi?" - 1080x1920, 30 fps
# python3 reel9.py timing.json out.mp4   (timing.json: {"total": sek, "s": [[start,end], ...12 ta gap]})
import json, sys, math, subprocess, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
D = sys.path[0] + '/'
W, H, FPS = 1080, 1920, 30
RED, GOLD, WHITE = (255, 59, 59), (255, 178, 30), (255, 255, 255)
FB = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
FX = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
_fc = {}
def font(sz, black=True):
    k = (sz, black)
    if k not in _fc: _fc[k] = ImageFont.truetype(FB if black else FX, sz)
    return _fc[k]
def ease(x): x = max(0, min(1, x)); return 1 - (1 - x) ** 3
def img(n): return Image.open(D + 'img/' + n).convert('RGBA')
def shot(n): return Image.open(D + 'shots/' + n + '.png').convert('RGBA')
def ph(n): return Image.open(D + 'phone/ph_' + n + '.png').convert('RGBA')

SUB = ["To'xta! 2026-yilning eng zo'r Counter-Strike 1.6 sborkasi qaysi?",
       "Sborkalar juda ko'p. Lekin hammasi bir xil: eski menyu, lag, qotish.",
       "Javob bitta — X CLIENT!",
       "O'tgan videodan keyin atigi 3 kunda deyarli 100 ta yangi o'yinchi qo'shildi. Rahmat sizlarga!",
       "Endi esa eng katta yangilik: X CLIENT endi telefonda!",
       "Kompyuterdagi akkaunting bilan kir: daraja, XP, do'stlar va kunlik sovg'a — hammasi bitta.",
       "Parol kerak emas: kompyuterdagi kodni yoz yoki Telegram orqali bir bosishda kir.",
       "Internet yo'qmi? Telefonda ham botlar bilan o'yna.",
       "Kompyuterda esa: lag bir bosishda tuzatiladi, aim test, granata mashqi va shaxsiy murabbiy.",
       "Yangi yil yaqinlashyapti! Dekabrda Yangi yil iventi: XP x1.5 va maxsus ramka!",
       "Hammasi bepul! cssborka.uz saytiga kir va kompyuter hamda telefon uchun yuklab ol.",
       "Sen qaysi sborkada o'ynaysan? Izohlarda yoz! Obuna bo'l va biz bilan qol!"]
KEY = {'X', 'CLIENT!', 'CLIENT', '1.6', 'Counter-Strike', 'bepul!', 'cssborka.uz', 'telefonda!', 'telefonda', '100', '3', 'x1.5', 'yoz!', 'qaysi?', '2026-yilning'}

TM = json.load(open(sys.argv[1])); S = TM['s']; TOTAL = TM['total']
# ---- subtitr bo'laklari: har gap ichida so'zlar bo'g'in ulushiga ko'ra
def syl(w): return max(1, sum(ch in 'aeiouAEIOU' for ch in w.replace("o'", 'o')))
CH = []
PH = TM.get('p') or [[(txt, a, b)] for (a, b), txt in zip(S, SUB)]   # gap ichidagi qismlar (pauzalar bo'yicha)
for txt, a, b in [x for g in PH for x in g]:
    ws = txt.split(); tot = sum(syl(w) for w in ws); t = a; cur = []
    for w in ws:
        d = (b - a) * syl(w) / tot; cur.append((w, t, t + d)); t += d
        if len(cur) >= 3 or w[-1] in '.!?:' : CH.append(cur); cur = []
    if cur: CH.append(cur)
def subtitle(fr, t):
    ch = None
    for c in CH:
        if c[0][1] - 0.04 <= t <= c[-1][2] + 0.18: ch = c
    if not ch: return
    d = ImageDraw.Draw(fr); sz = 78
    def width(sz): f = font(sz); return f, sum(d.textlength(w[0] + ' ', font=f) for w in ch) - d.textlength(' ', font=f)
    f, tw = width(sz)
    while tw > W - 120: sz -= 4; f, tw = width(sz)
    pop = ease((t - ch[0][1]) / 0.12); y = 1500 - int(18 * (1 - pop))
    x = (W - tw) / 2
    pad = 22; d.rounded_rectangle((x - pad, y - 14, x + tw + pad, y + sz + 18), 18, fill=(0, 0, 0, 200))
    for w, a, b in ch:
        on = a - 0.03 <= t
        col = (RED if w in KEY else GOLD) if a <= t < b + 0.05 else (WHITE if on else (150, 150, 150))
        d.text((x, y), w, font=f, fill=col); x += d.textlength(w + ' ', font=f)

def cover(im, w, h, zoom=1.0, cx=0.5, cy=0.5):
    s = max(w / im.width, h / im.height) * zoom; nw, nh = int(im.width * s), int(im.height * s)
    r = im.resize((nw, nh), Image.LANCZOS); x = int((nw - w) * cx); y = int((nh - h) * cy)
    return r.crop((x, y, x + w, y + h))
def blurbg(im, dark=0.45):
    b = cover(im, W // 4, H // 4).filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR)
    return ImageEnhance.Brightness(b).enhance(dark).convert('RGBA')
def framed(im, w, radius=26, border=RED):
    s = w / im.width; r = im.resize((w, int(im.height * s)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 80, 2))
    m = Image.new('L', r.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, r.width - 1, r.height - 1), radius, fill=255)
    out = Image.new('RGBA', (r.width + 12, r.height + 12), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle((0, 0, out.width - 1, out.height - 1), radius + 6, fill=border + (255,))
    out.paste(r, (6, 6), m); return out
def shadow_paste(fr, im, x, y, blur=30, alpha=170):
    sh = Image.new('RGBA', (im.width + blur * 4, im.height + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((blur * 2, blur * 2, blur * 2 + im.width, blur * 2 + im.height), 30, fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur)); fr.alpha_composite(sh, (int(x - blur * 2), int(y - blur * 2 + 18)))
    fr.alpha_composite(im, (int(x), int(y)))
def title(fr, txt, y, sz=110, col=WHITE, stroke=RED, t=1.0, center=True):
    d = ImageDraw.Draw(fr); f = font(sz)
    while d.textlength(txt, font=f) > W - 90: sz -= 6; f = font(sz)
    tw = d.textlength(txt, font=f); a = ease(t)
    yy = y + int(40 * (1 - a)); x = (W - tw) / 2 if center else 60
    lay = Image.new('RGBA', fr.size, (0, 0, 0, 0)); dl = ImageDraw.Draw(lay)
    dl.text((x, yy), txt, font=f, fill=col + (int(255 * a),), stroke_width=6 if stroke else 0, stroke_fill=(stroke or (0, 0, 0)) + (int(255 * a),))
    fr.alpha_composite(lay)
def pill(fr, txt, cx, y, sz=54, bg=RED, t=1.0):
    d = ImageDraw.Draw(fr); f = font(sz); tw = d.textlength(txt, font=f); a = ease(t)
    if a <= 0: return
    w = tw + 60; s = 0.7 + 0.3 * a
    lay = Image.new('RGBA', (int(w), sz + 40), (0, 0, 0, 0)); dl = ImageDraw.Draw(lay)
    dl.rounded_rectangle((0, 0, lay.width - 1, lay.height - 1), 22, fill=bg + (235,)); dl.text((30, 14), txt, font=f, fill=WHITE)
    lay = lay.resize((max(1, int(lay.width * s)), max(1, int(lay.height * s))), Image.LANCZOS)
    lay.putalpha(lay.getchannel('A').point(lambda v: int(v * a)))
    fr.alpha_composite(lay, (int(cx - lay.width / 2), int(y)))
def vignette():
    y, x = np.mgrid[0:H, 0:W]; r = np.sqrt(((x - W / 2) / (W * .75)) ** 2 + ((y - H / 2) / (H * .62)) ** 2)
    a = np.clip((r - 0.55) * 1.4, 0, 0.85); v = np.zeros((H, W, 4), np.uint8); v[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(v, 'RGBA')
VIG = vignette()
def progress(fr, t):
    d = ImageDraw.Draw(fr); d.rectangle((0, 0, int(W * t / TOTAL), 10), fill=RED)
def brand(fr):
    d = ImageDraw.Draw(fr); f = font(40); d.text((50, 46), 'X CLIENT', font=f, fill=WHITE); d.text((50 + d.textlength('X CLIENT ', font=f), 46), '· 7-QISM', font=f, fill=RED)

# ---- tayyor rasmlar
TOP = img('top2026.png'); SANTA = img('santa.png'); LOGO = img('logo_big.png'); HERO = img('hero_f.png')
HOMEBG = blurbg(shot('home'), 0.38); TOPBG = blurbg(TOP, 0.5); SANTABG = blurbg(SANTA, 0.55)
TOPF = framed(TOP, 1000); SANTAF = framed(SANTA, 1000, border=(255, 255, 255))
PHONE = {}
def phone(n, w=600):
    k = (n, w)
    if k not in PHONE:
        im = ph(n); s = w / im.width; r = im.resize((w, int(im.height * s)), Image.LANCZOS)
        bz = 22; out = Image.new('RGBA', (w + bz * 2, r.height + bz * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(out)
        d.rounded_rectangle((0, 0, out.width - 1, out.height - 1), 70, fill=(18, 18, 22, 255), outline=(70, 70, 80, 255), width=4)
        m = Image.new('L', r.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, r.width - 1, r.height - 1), 50, fill=255)
        out.paste(r, (bz, bz), m); d.rounded_rectangle((out.width / 2 - 70, bz + 8, out.width / 2 + 70, bz + 36), 14, fill=(0, 0, 0, 255))
        PHONE[k] = out
    return PHONE[k]
PW, PY = 460, 300                     # telefon eni va tepasi
def card_box(top, h):                 # telefon ekranidagi CSS koordinata (540 px eni) -> kadr
    k = PW / 540; return (W - PW) / 2 - 10, PY + 22 + top * k - 12, (W + PW) / 2 + 10, PY + 22 + (top + h) * k + 12
def pcshot(n, w=1000, box=None):
    im = shot(n)
    if box: im = im.crop(box)
    return framed(im, w)
SH = {'lagfix': pcshot('lagfix', 960, (350, 470, 1250, 860)), 'aimt': pcshot('aimt', 880, (400, 90, 1200, 830)), 'nade': pcshot('nade', 880, (400, 90, 1200, 830))}
SH['code'] = framed(shot('mobapp').crop((540, 580, 1180, 720)), 980)
rnd = random.Random(5); SNOW = [(rnd.random() * W, rnd.random() * H, 2 + rnd.random() * 5, 40 + rnd.random() * 90) for _ in range(160)]

def scene(i, t):
    a, b = S[i]; return (t - a) / max(0.01, b - a), t - a
def frame(t):
    # qaysi gap: oraliqdagi pauzada oldingi sahna davom etadi
    i = 0
    for k, (a, b) in enumerate(S):
        if t >= a - 0.05: i = k
    p, e = scene(i, t)
    if i == 0:   # ilgak: TOP rasm, zoom, "?" va glitch
        fr = TOPBG.copy(); z = 1 + 0.08 * p
        im = TOPF.resize((int(TOPF.width * z), int(TOPF.height * z)), Image.LANCZOS)
        x, y = (W - im.width) / 2, 560 - (im.height - TOPF.height) / 2
        if e < 0.5 and int(e * 20) % 2 == 0: x += rnd.randint(-25, 25)
        shadow_paste(fr, im, x, y)
        title(fr, "TO'XTA!", 210, 170, RED, (0, 0, 0), e / 0.25)
        title(fr, "ENG ZO'R SBORKA QAYSI?", 410, 74, WHITE, (0, 0, 0), (e - 0.4) / 0.3)
        q = 0.9 + 0.12 * math.sin(e * 9)
        pill(fr, '?', W - 190, 1150, int(150 * q), RED, (e - 0.8) / 0.25)
    elif i == 1:  # eski sborkalar: qoralashgan rasm, qizil X yozuvlari
        fr = TOPBG.copy(); im = ImageEnhance.Color(TOPF).enhance(0.15); im = ImageEnhance.Brightness(im).enhance(0.55)
        shadow_paste(fr, im, (W - im.width) / 2, 470)
        title(fr, "HAMMASI BIR XIL...", 250, 92, WHITE, (0, 0, 0), e / 0.3)
        for k, w in enumerate(["×  ESKI MENYU", "×  LAG", "×  QOTISH"]):
            pill(fr, w, W / 2, 1110 + k * 120, 62, (170, 20, 30), (p - 0.45 - k * 0.15) / 0.08)
    elif i == 2:  # reveal
        fr = HOMEBG.copy(); fl = max(0, 1 - e / 0.35)
        s = 1.25 - 0.25 * ease(e / 0.5); lg = LOGO.resize((int(560 * s), int(571 * s)), Image.LANCZOS)
        glow = lg.filter(ImageFilter.GaussianBlur(40)); fr.alpha_composite(glow, (int((W - lg.width) / 2), int(470 - (lg.height - 571) / 2)))
        fr.alpha_composite(lg, (int((W - lg.width) / 2), int(470 - (lg.height - 571) / 2)))
        title(fr, "JAVOB BITTA:", 250, 80, GOLD, (0, 0, 0), e / 0.3)
        title(fr, "X CLIENT", 1100, 190, WHITE, RED, (e - 0.15) / 0.3)
        if fl > 0: fr.alpha_composite(Image.new('RGBA', (W, H), (255, 255, 255, int(255 * fl))))
    elif i == 3:  # natija: hisoblagich
        fr = HOMEBG.copy(); n = int(round(90 * ease(p / 0.6)))
        title(fr, "3 KUNDA", 420, 110, WHITE, (0, 0, 0), e / 0.3)
        title(fr, "+%d" % n, 600, 330, RED, (0, 0, 0), e / 0.2)
        title(fr, "YANGI O'YINCHI", 960, 100, GOLD, (0, 0, 0), (e - 0.2) / 0.3)
        pill(fr, "RAHMAT SIZLARGA!", W / 2, 1180, 64, RED, (p - 0.65) / 0.15)
    elif i == 4:  # telefon keladi
        fr = HOMEBG.copy(); pim = phone('acc', PW); y = PY; xoff = 900 * (1 - ease(e / 0.5))
        title(fr, "ENDI TELEFONDA!", 150, 120, WHITE, RED, e / 0.3)
        shadow_paste(fr, pim, (W - pim.width) / 2 + xoff, y)
    elif i == 5:  # akkaunt kartasi
        fr = HOMEBG.copy(); pim = phone('acc', PW); shadow_paste(fr, pim, (W - pim.width) / 2, PY)
        a = ease(e / 0.3); ImageDraw.Draw(fr).rounded_rectangle(card_box(105, 208), 26, outline=GOLD + (int(255 * a),), width=8)
        title(fr, "BITTA AKKAUNT", 150, 110, WHITE, RED, e / 0.3)
        for k, w in enumerate(["DARAJA", "XP", "DO'STLAR", "SOVG'A"]):
            pill(fr, w, 150 if k % 2 == 0 else W - 150, 560 + (k // 2) * 260, 42, RED if k % 2 == 0 else (30, 120, 255), (p - 0.25 - k * 0.12) / 0.1)
    elif i == 6:  # parolsiz kirish: kompyuterdagi kod + telefon
        fr = HOMEBG.copy(); title(fr, "PAROLSIZ KIRISH", 150, 110, WHITE, RED, e / 0.3)
        c = SH['code']; shadow_paste(fr, c, (W - c.width) / 2, 300 + 30 * (1 - ease(e / 0.3)))
        pill(fr, "KOMPYUTERDAGI KOD", W / 2, 560, 48, RED, (p - 0.15) / 0.12)
        pim = phone('login', 310); shadow_paste(fr, pim, (W - pim.width) / 2 + 700 * (1 - ease((e - 0.2) / 0.45)), 690)
        pill(fr, "YOKI", 170, 1000, 44, (60, 60, 70), (p - 0.5) / 0.12)
        pill(fr, "TELEGRAM", W - 175, 1000, 44, (42, 163, 222), (p - 0.55) / 0.12)
    elif i == 7:  # internetsiz botlar
        fr = HOMEBG.copy(); pim = phone('off', PW); shadow_paste(fr, pim, (W - pim.width) / 2, PY)
        a = ease(e / 0.3); ImageDraw.Draw(fr).rounded_rectangle(card_box(323, 62), 26, outline=GOLD + (int(255 * a),), width=8)
        title(fr, "INTERNETSIZ HAM", 150, 110, WHITE, RED, e / 0.3)
        pill(fr, "BOTLAR BILAN O'YNA", W / 2, 1365, 52, (176, 122, 16), (p - 0.3) / 0.12)
    elif i == 8:  # kompyuterdagi funksiyalar karuseli
        fr = HOMEBG.copy(); seq = [('lagfix', 'LAG — BIR BOSISHDA'), ('aimt', 'AIM TEST'), ('nade', 'GRANATA MASHQI')]
        k = min(2, int(p * 3)); lp = p * 3 - k; c = SH[seq[k][0]]
        title(fr, "KOMPYUTERDA ESA", 150, 100, WHITE, RED, e / 0.3)
        x = (W - c.width) / 2 + 300 * (1 - ease(lp / 0.25)) * (1 if k else 0)
        shadow_paste(fr, c, x, 330)
        pill(fr, seq[k][1], W / 2, 330 + c.height + 30, 60, RED, lp / 0.15)
        if k == 2: pill(fr, "+ SHAXSIY MURABBIY", W / 2, 330 + c.height + 150, 48, (30, 120, 255), (lp - 0.4) / 0.15)
    elif i == 9:  # yangi yil
        fr = SANTABG.copy(); z = 1 + 0.06 * p; im = SANTAF.resize((int(SANTAF.width * z), int(SANTAF.height * z)), Image.LANCZOS)
        shadow_paste(fr, im, (W - im.width) / 2, 430 - (im.height - SANTAF.height) / 2)
        d = ImageDraw.Draw(fr)
        for (sx, sy, r, sp) in SNOW:
            yy = (sy + sp * t * 3) % H; xx = (sx + 20 * math.sin(t + sy)) % W; d.ellipse((xx - r, yy - r, xx + r, yy + r), fill=(255, 255, 255, 210))
        title(fr, "YANGI YIL IVENTI", 180, 110, WHITE, RED, e / 0.3)
        title(fr, "DEKABRDA", 330, 70, GOLD, (0, 0, 0), (e - 0.1) / 0.3)
        pill(fr, "XP x1.5", W / 2, 1215, 84, RED, (p - 0.45) / 0.12)
        pill(fr, "+ MAXSUS RAMKA", W / 2, 1360, 50, (30, 120, 255), (p - 0.65) / 0.12)
    elif i == 10:  # CTA
        fr = HOMEBG.copy(); lg = LOGO.resize((360, 367), Image.LANCZOS); fr.alpha_composite(lg, ((W - 360) // 2, 300))
        title(fr, "HAMMASI BEPUL!", 720, 120, WHITE, RED, e / 0.3)
        pul = 1 + 0.04 * math.sin(e * 6)
        pill(fr, "cssborka.uz", W / 2, 900, int(110 * pul), RED, (e - 0.3) / 0.25)
        pill(fr, "KOMPYUTER  +  TELEFON", W / 2, 1120, 58, (30, 120, 255), (p - 0.5) / 0.12)
    else:        # outro
        fr = HOMEBG.copy(); hero = HERO.resize((440, 535), Image.LANCZOS); fr.alpha_composite(hero, (W - 450, 760))
        title(fr, "QAYSI SBORKADA", 250, 100, WHITE, (0, 0, 0), e / 0.3)
        title(fr, "O'YNAYSAN?", 380, 130, RED, (0, 0, 0), (e - 0.1) / 0.3)
        pill(fr, "IZOHDA YOZ", 300, 760, 58, RED, (p - 0.3) / 0.12)
        sub = (p - 0.55) / 0.12; pill(fr, "OBUNA BO'L", 300, 890, 58, (230, 30, 30) if p < 0.85 else (90, 90, 90), sub)
        pill(fr, "BIZ BILAN QOL!", 300, 1020, 58, (30, 120, 255), (p - 0.75) / 0.12)
    fr.alpha_composite(VIG); brand(fr); subtitle(fr, t); progress(fr, t)
    # gap boshida yengil silkinish (ta'sirli sahnalar)
    if i in (0, 2, 4, 10) and e < 0.18:
        dx = int(12 * math.sin(e * 90) * (1 - e / 0.18)); fr = fr.transform(fr.size, Image.AFFINE, (1, 0, dx, 0, 1, 0))
    return fr.convert('RGB')

if __name__ == '__main__':
    out = sys.argv[2]; n = int(TOTAL * FPS)
    if len(sys.argv) > 3:   # tez ko'rish: berilgan soniyalardagi kadrlar
        for s in sys.argv[3].split(','): frame(float(s)).save(D + 'pv_%s.png' % s); print('pv', s)
        sys.exit()
    pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for k in range(n):
        pr.stdin.write(frame(k / FPS).tobytes())
        if k % 300 == 0: print(k, '/', n, flush=True)
    pr.stdin.close(); pr.wait(); print('ok', out)
