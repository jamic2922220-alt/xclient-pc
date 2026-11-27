# X CLIENT umumiy reklama (1080x1920, 30 fps): python3 reel10.py timing.json out.mp4
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


SUB = ["To'xta! Hali ham eski launcherda o'ynayapsanmi? Lag, qotish, qora ekran va eski menyu bilan?",
"Unda X CLIENT bilan tanish! Counter-Strike 1.6 uchun yangi avlod launcheri. Va u butunlay bepul!",
"O'tgan videodan keyin o'yinchilarimiz 1500 dan ortiq ko'paydi! Rahmat sizlarga!",
"Lag bormi? Bitta tugmani bos — X CLIENT kompyuteringni o'zi tekshiradi va lagni tuzatadi. Alt+Tabda qora ekran ham yo'q.",
"Ichida tayyor PRO CFG bor: bitta tugma — va pro o'yinchilar sozlamasi. O'z CFG'ingni 6 harfli kod bilan do'stingga yubor yoki mashhur CFGlardan xohlaganingni tanla.",
"Serverlar oynasida hamma narsa bor: ping, o'yinchilar, xarita rasmi, filtrlar va bitta tugmada tez o'yin.",
"Har bir o'ldirishing hisoblanadi: daraja, XP, unvonlar va haftaning eng zo'r qotillari reytingi.",
"Do'stlar qo'sh, ularga yoz, birga serverga kir. Har kuni kirsang — kunlik sovg'a va sandiqlar.",
"Mashq qilmoqchimisan? Aim test, granata mashqi va botlar bilan o'yin — internetsiz ham ishlaydi.",
"Menyu 10 xil tilda: o'zbekcha, ruscha, inglizcha, qozoqcha, tojikcha, turkcha va boshqalar.",
"Eng katta yangilik: X CLIENT endi telefonda ham bor!",
"Android telefoningda o'sha serverlar, botlar va mikrofon orqali gaplashish. Akkaunting bitta: kompyuterda yig'gan darajang telefonda ham saqlanadi.",
"Qayerdan yuklayman? cssborka.uz saytiga kir. Kompyuter uchun ham, Android uchun ham — tugmani bos, o'rnat va o'yna!",
"Tushunmadingmi yoki savoling bormi? Directga yoz — albatta yordam beramiz!",
"Obuna bo'l, do'stlaringga yubor va X CLIENTda uchrashamiz!"]
KEY = {'X', 'CLIENT', 'CLIENT!', 'CLIENTda', 'bepul!', '1500', 'PRO', 'CFG', "CFG'ingni", 'telefonda', 'Android', 'cssborka.uz', 'Directga', 'yoz', '10', 'lagni', 'bitta'}

TM = json.load(open(sys.argv[1])); S = TM['s']; TOTAL = TM['total']
def syl(w): return max(1, sum(ch in 'aeiouAEIOU' for ch in w.replace("o'", 'o')))
CH = []
for (a, b), txt in zip(S, SUB):
    ws = txt.split(); tot = sum(syl(w) for w in ws); t = a; cur = []
    for w in ws:
        d = (b - a) * syl(w) / tot; cur.append((w, t, t + d)); t += d
        if len(cur) >= 3 or w[-1] in '.!?:—': CH.append(cur); cur = []
    if cur: CH.append(cur)
def subtitle(fr, t):
    ch = None
    for c in CH:
        if c[0][1] - 0.04 <= t <= c[-1][2] + 0.18: ch = c
    if not ch: return
    d = ImageDraw.Draw(fr); sz = 76
    def width(sz): f = font(sz); return f, sum(d.textlength(w[0] + ' ', font=f) for w in ch) - d.textlength(' ', font=f)
    f, tw = width(sz)
    while tw > W - 120: sz -= 4; f, tw = width(sz)
    pop = ease((t - ch[0][1]) / 0.12); y = 1560 - int(18 * (1 - pop)); x = (W - tw) / 2
    pad = 22; d.rounded_rectangle((x - pad, y - 14, x + tw + pad, y + sz + 18), 18, fill=(0, 0, 0, 200))
    for w, a, b in ch:
        on = a - 0.03 <= t
        col = (RED if w.strip('.,!?:') in KEY or w in KEY else GOLD) if a <= t < b + 0.05 else (WHITE if on else (150, 150, 150))
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
    d = ImageDraw.Draw(fr); f = font(40); d.text((50, 46), 'X CLIENT', font=f, fill=WHITE); d.text((50 + d.textlength('X CLIENT ', font=f), 46), '· CS 1.6', font=f, fill=RED)

# ---- tayyor rasmlar
LOGO = img('logo_big.png'); HERO = img('hero_f.png'); HEROB = img('hero_b.png')
HOMEBG = blurbg(shot('home'), 0.36)
def crop(n, box, w, border=RED): return framed(shot(n).crop(box), w, border=border)
def cimg(n, w, border=RED, box=None):
    im = img(n)
    if box: im = im.crop(box)
    return framed(im, w, border=border)
def phoneL(n, w=980):                 # yotiq telefon (o'yin ekrani)
    im = img(n); s = w / im.width; r = im.resize((w, int(im.height * s)), Image.LANCZOS)
    bz = 24; out = Image.new('RGBA', (w + bz * 2, r.height + bz * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, out.width - 1, out.height - 1), 60, fill=(16, 16, 20, 255), outline=(80, 80, 90, 255), width=4)
    m = Image.new('L', r.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, r.width - 1, r.height - 1), 40, fill=255)
    out.paste(r, (bz, bz), m); d.rounded_rectangle((bz + 8, out.height / 2 - 60, bz + 30, out.height / 2 + 60), 10, fill=(0, 0, 0, 255))
    return out
P = {
 'lag': crop('lagfix', (350, 470, 1250, 860), 980),
 'pro': crop('set_pro', (220, 250, 830, 600), 980),
 'srv': cimg('pc_servers.png', 1000),
 'stats': crop('stats', (420, 50, 1180, 640), 900),
 'prof': crop('profile', (210, 40, 800, 560), 760),
 'fr': crop('friends', (420, 110, 1180, 420), 940),
 'chest': crop('chests', (420, 110, 1180, 740), 860, border=GOLD),
 'aim': crop('aimt', (400, 90, 1200, 830), 860),
 'nade': crop('nade', (400, 90, 1200, 830), 860),
 'bots': cimg('old2.png', 900),
 'lang': crop('langmenu', (1230, 470, 1490, 840), 470),
 'mob': crop('mobapp', (440, 40, 1190, 740), 880),
 'm_menu': phoneL('m_new1.png'), 'm_srv': phoneL('m_servers.png'), 'm_game': phoneL('m_new2.png'), 'm_tab': phoneL('m_tab.png'),
}
rnd = random.Random(5)
def oldimg(n):
    im = ImageEnhance.Brightness(ImageEnhance.Color(img(n)).enhance(0.25)).enhance(0.8)
    return framed(im, 560, border=(110, 110, 110))
OLD1, OLD2 = oldimg('old1.png'), oldimg('old2.png')
def carousel(fr, items, p, y, ttl_e=1.0):      # [(kalit, yorliq)] - gap davomida navbat bilan chiqadi
    n = len(items); k = min(n - 1, int(p * n)); lp = p * n - k; c = P[items[k][0]]
    x = (W - c.width) / 2 + 260 * (1 - ease(lp / 0.22)) * (1 if k else 0)
    shadow_paste(fr, c, x, y); pill(fr, items[k][1], W / 2, y + c.height + 34, 60, RED, lp / 0.15)
    return c
def pills(fr, words, p, y0, start=0.25, step=0.12, cols=2, sz=46):
    for k, w in enumerate(words):
        col = k % cols; row = k // cols
        cx = W / 2 if cols == 1 else (W * (0.28 if col == 0 else 0.72))
        pill(fr, w, cx, y0 + row * 120, sz, RED if (k % 2 == 0) else (30, 120, 255), (p - start - k * step) / 0.1)

def scene(i, t):
    a, b = S[i]; return (t - a) / max(0.01, b - a), t - a
def frame(t):
    i = 0
    for k, (a, b) in enumerate(S):
        if t >= a - 0.05: i = k
    p, e = scene(i, t)
    if i == 0:    # ilgak: eski launcher muammolari
        fr = HOMEBG.copy()
        for k, (im, x, y, ang) in enumerate([(OLD1, 30, 500, 5), (OLD2, 470, 700, -4)]):
            q = ease((e - 0.15 - k * 0.35) / 0.3)
            if q <= 0: continue
            r = im.rotate(ang, expand=True, resample=Image.BICUBIC); gx = x + (rnd.randint(-25, 25) if e < 1.2 and int(e * 20) % 3 == 0 else 0)
            shadow_paste(fr, r, gx, y + 120 * (1 - q))
        if e > 1.0:   # qizil "ESKI" muhri
            d = ImageDraw.Draw(fr); q = min(1, (e - 1.0) / 0.15); c = (230, 30, 40, int(255 * q))
            d.line((90, 560, 1000, 1060), fill=c, width=26); d.line((1000, 560, 90, 1060), fill=c, width=26)
        title(fr, "TO'XTA!", 190, 170, RED, (0, 0, 0), e / 0.25)
        title(fr, "HALI HAM ESKI LAUNCHERMI?", 400, 70, WHITE, (0, 0, 0), (e - 0.35) / 0.3)
        for k, w in enumerate(["×  LAG", "×  QOTISH", "×  QORA EKRAN", "×  ESKI MENYU"]):
            pill(fr, w, W * (0.27 if k % 2 == 0 else 0.73), 1180 + (k // 2) * 125, 56, (170, 20, 30), (p - 0.35 - k * 0.12) / 0.08)
    elif i == 1:  # reveal
        fr = HOMEBG.copy(); fl = max(0, 1 - e / 0.35)
        s = 1.25 - 0.25 * ease(e / 0.5); lg = LOGO.resize((int(540 * s), int(551 * s)), Image.LANCZOS)
        glow = lg.filter(ImageFilter.GaussianBlur(40)); xy = (int((W - lg.width) / 2), int(430 - (lg.height - 551) / 2))
        fr.alpha_composite(glow, xy); fr.alpha_composite(lg, xy)
        title(fr, "X CLIENT", 1030, 190, WHITE, RED, (e - 0.1) / 0.3)
        title(fr, "YANGI AVLOD LAUNCHERI", 1250, 64, GOLD, (0, 0, 0), (p - 0.35) / 0.15)
        pill(fr, "BUTUNLAY BEPUL!", W / 2, 1370, 66, RED, (p - 0.7) / 0.12)
        if fl > 0: fr.alpha_composite(Image.new('RGBA', (W, H), (255, 255, 255, int(255 * fl))))
    elif i == 2:  # +1500
        fr = HOMEBG.copy(); n = int(round(1500 * ease(p / 0.6)))
        title(fr, "O'TGAN VIDEODAN KEYIN", 400, 80, WHITE, (0, 0, 0), e / 0.3)
        title(fr, "+%d" % n, 560, 300, RED, (0, 0, 0), e / 0.2)
        title(fr, "O'YINCHI", 900, 120, GOLD, (0, 0, 0), (e - 0.2) / 0.3)
        pill(fr, "RAHMAT SIZLARGA!", W / 2, 1130, 66, RED, (p - 0.65) / 0.15)
    elif i == 3:  # lag
        fr = HOMEBG.copy(); title(fr, "LAG? 1 BOSISHDA!", 170, 104, WHITE, RED, e / 0.3)
        c = P['lag']; shadow_paste(fr, c, (W - c.width) / 2, 380 + 40 * (1 - ease(e / 0.3)))
        pill(fr, "KOMPYUTERNI O'ZI TEKSHIRADI", W / 2, 380 + c.height + 50, 50, RED, (p - 0.3) / 0.12)
        pill(fr, "ALT+TAB: QORA EKRAN YO'Q", W / 2, 380 + c.height + 170, 50, (30, 120, 255), (p - 0.72) / 0.12)
    elif i == 4:  # PRO CFG
        fr = HOMEBG.copy(); title(fr, "PRO CFG", 160, 150, WHITE, RED, e / 0.3)
        c = P['pro']; shadow_paste(fr, c, (W - c.width) / 2, 380)
        pill(fr, "BITTA TUGMA", W / 2, 380 + c.height + 40, 56, RED, (p - 0.15) / 0.1)
        pill(fr, "6 HARFLI KOD — DO'STINGGA", W / 2, 380 + c.height + 160, 50, (30, 120, 255), (p - 0.45) / 0.1)
        pill(fr, "★ MASHHUR CFGLAR", W / 2, 380 + c.height + 280, 50, (200, 140, 10), (p - 0.72) / 0.1)
    elif i == 5:  # serverlar
        fr = HOMEBG.copy(); title(fr, "SERVERLAR OYNASI", 160, 104, WHITE, RED, e / 0.3)
        c = P['srv']; z = 1 + 0.05 * p; im = c.resize((int(c.width * z), int(c.height * z)), Image.LANCZOS)
        shadow_paste(fr, im, (W - im.width) / 2, 360)
        pills(fr, ["PING", "O'YINCHILAR", "XARITA RASMI", "FILTRLAR"], p, 1080, 0.2, 0.1)
        pill(fr, "⚡ TEZ O'YIN", W / 2, 1330, 60, RED, (p - 0.75) / 0.1)
    elif i == 6:  # statistika
        fr = HOMEBG.copy(); title(fr, "HAR BIR KILL HISOBDA", 160, 90, WHITE, RED, e / 0.3)
        c = P['stats'] if p < 0.5 else P['prof']; shadow_paste(fr, c, (W - c.width) / 2, 330)
        pills(fr, ["DARAJA", "XP", "UNVONLAR", "HAFTA TOP"], p, 1130, 0.2, 0.12)
    elif i == 7:  # do'stlar + sandiq
        fr = HOMEBG.copy()
        if p < 0.5:
            title(fr, "DO'STLAR", 170, 130, WHITE, RED, e / 0.3); c = P['fr']; shadow_paste(fr, c, (W - c.width) / 2, 420)
            pills(fr, ["QO'SH", "YOZ", "BIRGA O'YNA"], p, 420 + c.height + 50, 0.12, 0.1, cols=1, sz=54)
        else:
            q = (p - 0.5) * 2; title(fr, "KUNLIK SOVG'A", 170, 120, GOLD, (0, 0, 0), q / 0.2)
            c = P['chest']; s = 0.9 + 0.1 * ease(q / 0.3); im = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
            shadow_paste(fr, im, (W - im.width) / 2, 360); pill(fr, "+ SANDIQLAR", W / 2, 1300, 62, RED, (q - 0.3) / 0.15)
    elif i == 8:  # mashq
        fr = HOMEBG.copy(); title(fr, "MASHQ QIL", 170, 130, WHITE, RED, e / 0.3)
        carousel(fr, [('aim', 'AIM TEST'), ('nade', 'GRANATA MASHQI')], p, 380)
        pill(fr, "INTERNETSIZ HAM!", W / 2, 1400, 52, (30, 120, 255), (p - 0.8) / 0.1)
    elif i == 9:  # tillar
        fr = HOMEBG.copy(); title(fr, "10 XIL TIL", 170, 140, WHITE, RED, e / 0.3)
        c = P['lang']; shadow_paste(fr, c, 110, 400)
        for k, w in enumerate(["O'ZBEKCHA", "РУССКИЙ", "ENGLISH", "ҚАЗАҚША", "ТОҶИКӢ", "TÜRKÇE", "+ YANA 4"]):
            pill(fr, w, W - 280, 400 + k * 125, 50, RED if k < 2 else (30, 120, 255), (p - 0.15 - k * 0.09) / 0.08)
    elif i == 10:  # telefonda
        fr = HOMEBG.copy(); c = P['m_menu']; xoff = 1100 * (1 - ease(e / 0.45))
        title(fr, "ENDI TELEFONDA!", 200, 120, WHITE, RED, e / 0.3)
        shadow_paste(fr, c, (W - c.width) / 2 + xoff, 560)
        pill(fr, "ANDROID", W / 2, 1150, 76, (52, 168, 83), (p - 0.45) / 0.12)
    elif i == 11:  # telefondagi imkoniyatlar
        fr = HOMEBG.copy(); title(fr, "TELEFONDA HAM", 170, 110, WHITE, RED, e / 0.3)
        seq = [('m_srv', 'SERVERLAR'), ('m_game', 'BOTLAR VA MIKROFON 🎤'.replace(' 🎤', '')), ('m_tab', 'BITTA AKKAUNT')]
        carousel(fr, seq, p, 470)
        pill(fr, "KOMPYUTER = TELEFON", W / 2, 1330, 52, (30, 120, 255), (p - 0.78) / 0.1)
    elif i == 12:  # yuklab olish
        fr = HOMEBG.copy(); title(fr, "QAYERDAN YUKLAYMAN?", 150, 86, WHITE, RED, e / 0.3)
        pul = 1 + 0.04 * math.sin(e * 6); pill(fr, "cssborka.uz", W / 2, 290, int(104 * pul), RED, (e - 0.25) / 0.25)
        c = P['mob']; s = 0.82; im = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS); shadow_paste(fr, im, (W - im.width) / 2, 500)
        for k, w in enumerate(["1. SAYTGA KIR", "2. TUGMANI BOS", "3. O'RNAT VA O'YNA!"]):
            pill(fr, w, W / 2, 500 + im.height + 40 + k * 112, 50, RED if k < 2 else (52, 168, 83), (p - 0.35 - k * 0.15) / 0.1)
    elif i == 13:  # Direct
        fr = HOMEBG.copy(); title(fr, "SAVOLING BORMI?", 330, 110, WHITE, (0, 0, 0), e / 0.3)
        d = ImageDraw.Draw(fr); s = 0.8 + 0.2 * ease(e / 0.4); r = int(170 * s); cx, cy = W // 2, 860
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(225, 48, 108, 255)); k = r * 0.55   # Direct belgisi (qog'oz samolyot)
        d.polygon([(cx - k, cy - k * 0.15), (cx + k, cy - k * 0.75), (cx + k * 0.35, cy + k * 0.8), (cx + k * 0.05, cy + k * 0.15)], fill=WHITE)
        d.polygon([(cx + k * 0.05, cy + k * 0.15), (cx + k, cy - k * 0.75), (cx - k * 0.1, cy + k * 0.05)], fill=(240, 200, 215, 255))
        pill(fr, "DIRECTGA YOZ!", W / 2, 1090, 80, (225, 48, 108), (p - 0.35) / 0.12)
        pill(fr, "YORDAM BERAMIZ", W / 2, 1250, 56, (30, 120, 255), (p - 0.6) / 0.12)
    else:         # outro
        fr = HOMEBG.copy(); hero = HERO.resize((440, 535), Image.LANCZOS); fr.alpha_composite(hero, (W - 450, 780))
        lg = LOGO.resize((300, 306), Image.LANCZOS); fr.alpha_composite(lg, ((W - 300) // 2, 230))
        title(fr, "X CLIENTDA", 600, 120, WHITE, RED, e / 0.3); title(fr, "UCHRASHAMIZ!", 740, 110, GOLD, (0, 0, 0), (e - 0.15) / 0.3)
        pill(fr, "OBUNA BO'L", 300, 950, 58, RED, (p - 0.1) / 0.12)
        pill(fr, "DO'STINGGA YUBOR", 330, 1080, 52, (30, 120, 255), (p - 0.35) / 0.12)
        pill(fr, "cssborka.uz", 300, 1210, 58, (200, 140, 10), (p - 0.6) / 0.12)
    fr.alpha_composite(VIG); brand(fr); subtitle(fr, t); progress(fr, t)
    if i in (0, 1, 2, 10) and e < 0.18:
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
