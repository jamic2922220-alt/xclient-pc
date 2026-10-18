# X CLIENT spray 64x64: tepada X logotipi, pastda "X CLIENT" yozuvi (piksellarga mos chizilgan)
import struct, sys
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
W = H = 64; CUT = 140
src = Image.open(sys.argv[1]).convert('RGBA')
src = src.crop((0, 0, src.width, int(src.height * 0.7125)))       # faqat X qismi
r, g, b, a = src.split(); a = a.point(lambda v: 255 if v >= CUT else 0)
src = Image.merge('RGBA', (r, g, b, a)).crop(a.getbbox())
def logo(w, h):
    sc = min(w / src.width, h / src.height); tw, th = max(1, round(src.width * sc)), max(1, round(src.height * sc))
    pm = Image.new('RGBA', src.size); pm.paste(src.convert('RGB'), mask=src.split()[3])
    rgb = pm.convert('RGB').resize((tw, th), Image.LANCZOS); al = src.split()[3].resize((tw, th), Image.LANCZOS)
    px = rgb.load(); ap = al.load()
    for y in range(th):
        for x in range(tw):
            if ap[x, y]: px[x, y] = tuple(min(255, c * 255 // ap[x, y]) for c in px[x, y])
    rgb = ImageEnhance.Color(rgb.filter(ImageFilter.UnsharpMask(radius=1, percent=160, threshold=1))).enhance(1.15)
    return rgb, al
def compose(f):
    w, h = W // f, H // f
    out = Image.new('RGB', (w, h)); msk = Image.new('L', (w, h), 0)
    lh = round(45 / f)
    rgb, al = logo(w - 2 // f, lh)
    ox = (w - rgb.width) // 2
    out.paste(rgb, (ox, 0)); msk.paste(al, (ox, 0))
    # yozuv: 8 marta katta chizib, kichraytiramiz; qora kontur bilan
    K = 8; tw, th = w * K, (h - lh) * K
    t = Image.new('RGBA', (tw, th), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    t1, t2 = 'X', 'CLIENT'; fs = int(16 * K / f)
    while True:                                                      # yozuv eniga va bo'yiga sig'sin (kontur bilan)
        font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Black.otf', fs)
        w1 = d.textlength(t1, font=font); gap = 1.5 * K / f; w2 = d.textlength(t2, font=font)
        bb0 = d.textbbox((0, 0), 'XC', font=font)
        if (w1 + gap + w2 + 3 * K / f <= tw and bb0[3] - bb0[1] + 3 * K / f <= th) or fs < 6: break
        fs -= max(1, K // 4)
    x0 = (tw - (w1 + gap + w2)) / 2; bb = d.textbbox((0, 0), 'XC', font=font); y0 = (th - (bb[3] - bb[1])) / 2 - bb[1]
    st = max(1, int(1.2 * K / f))
    d.text((x0, y0), t1, font=font, fill=(255, 40, 40, 255), stroke_width=st, stroke_fill=(8, 4, 6, 255))
    d.text((x0 + w1 + gap, y0), t2, font=font, fill=(245, 245, 250, 255), stroke_width=st, stroke_fill=(8, 4, 6, 255))
    ts = t.resize((w, h - lh), Image.LANCZOS)
    trgb = Image.new('RGB', ts.size); trgb.paste(ts, mask=ts.split()[3])
    out.paste(trgb, (0, lh), ts.split()[3].point(lambda v: 255 if v >= 110 else 0)); msk.paste(ts.split()[3], (0, lh))
    return out, msk
full, a0 = compose(1)
opaque = [full.getpixel((x, y)) for y in range(H) for x in range(W) if a0.getpixel((x, y)) >= 110]
strip = Image.new('RGB', (len(opaque), 1)); strip.putdata(opaque)
pal = strip.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE).getpalette()[:255 * 3]
pal += [0] * (255 * 3 - len(pal)); palimg = Image.new('P', (1, 1)); palimg.putpalette(pal + [0, 0, 0]); pal += [0, 0, 255]
def idx(f):
    rgb, al = compose(f)
    data = bytearray(rgb.quantize(palette=palimg, dither=Image.NONE).tobytes())
    for i, av in enumerate(al.tobytes()):
        if av < 110: data[i] = 255
        elif data[i] == 255: data[i] = 254
    return bytes(data)
mips = [idx(1), idx(2), idx(4), idx(8)]
name = b'{LOGO'.ljust(16, b'\0'); offs = []; o = 40
for m in mips: offs.append(o); o += len(m)
lump = name + struct.pack('<6I', W, H, *offs) + b''.join(mips) + struct.pack('<H', 256) + bytes(pal) + b'\0\0'
wad = b'WAD3' + struct.pack('<II', 1, 12 + len(lump)) + lump + struct.pack('<iii', 12, len(lump), len(lump)) + bytes([0x43, 0, 0, 0]) + name
open(sys.argv[2], 'wb').write(wad)
if len(sys.argv) > 3:
    p = Image.frombytes('P', (W, H), mips[0]); p.putpalette(pal)
    wall = Image.new('RGB', (W, H), (150, 120, 80)); m = Image.frombytes('L', (W, H), bytes(0 if v == 255 else 255 for v in mips[0]))
    wall.paste(p.convert('RGB'), mask=m); wall.resize((W * 6, H * 6), Image.NEAREST).save(sys.argv[3])
print(len(wad))
