# X CLIENT spray: tayyor logotip (RGBA PNG/WebP) -> tempdecal.wad (WAD3 "{LOGO", 128x112, 255 rang + shaffof)
# Ishlatish: python3 spray_gen.py logo.png spray_default.wad [ko'rinish.png]
import struct, sys
from PIL import Image, ImageFilter, ImageEnhance
W, H, CUT = 128, 112, 140                  # 128x112 = 14336 piksel (GoldSrc chegarasi); CUT: yumshoq nur chegarasi
src = Image.open(sys.argv[1]).convert('RGBA')
r, g, b, a = src.split()
a = a.point(lambda v: 255 if v >= CUT else 0)
src = Image.merge('RGBA', (r, g, b, a)).crop(a.getbbox())
sc = min((W - 2) / src.width, (H - 2) / src.height)
def level(f):
    w, h = W // f, H // f
    tw, th = max(1, round(src.width * sc / f)), max(1, round(src.height * sc / f))
    # rang chetlari qorayib ketmasin: alfa bilan ko'paytirib kichraytiramiz
    pm = Image.new('RGBA', src.size); pm.paste(src.convert('RGB'), mask=src.split()[3])
    rgb = pm.convert('RGB').resize((tw, th), Image.LANCZOS)
    al = src.split()[3].resize((tw, th), Image.LANCZOS)
    px = rgb.load(); ap = al.load()
    for y in range(th):
        for x in range(tw):
            av = ap[x, y]
            if av: px[x, y] = tuple(min(255, c * 255 // av) for c in px[x, y])
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=1))
    rgb = ImageEnhance.Color(rgb).enhance(1.15)
    out = Image.new('RGB', (w, h)); msk = Image.new('L', (w, h), 0)
    ox, oy = (w - tw) // 2, (h - th) // 2
    out.paste(rgb, (ox, oy)); msk.paste(al, (ox, oy))
    return out, msk
full, a0 = level(1)
opaque = [full.getpixel((x, y)) for y in range(H) for x in range(W) if a0.getpixel((x, y)) >= 128]
strip = Image.new('RGB', (len(opaque), 1)); strip.putdata(opaque)
pal = strip.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE).getpalette()[:255 * 3]
pal += [0] * (255 * 3 - len(pal)); palimg = Image.new('P', (1, 1)); palimg.putpalette(pal + [0, 0, 0]); pal += [0, 0, 255]
def idx(f):
    rgb, al = level(f)
    data = bytearray(rgb.quantize(palette=palimg, dither=Image.NONE).tobytes())
    for i, av in enumerate(al.tobytes()):
        if av < 128: data[i] = 255
        elif data[i] == 255: data[i] = 254
    return bytes(data)
mips = [idx(1), idx(2), idx(4), idx(8)]
name = b'{LOGO'.ljust(16, b'\0'); offs = []; o = 40
for m in mips: offs.append(o); o += len(m)
lump = name + struct.pack('<6I', W, H, *offs) + b''.join(mips) + struct.pack('<H', 256) + bytes(pal) + b'\0\0'
wad = b'WAD3' + struct.pack('<II', 1, 12 + len(lump)) + lump + struct.pack('<iii', 12, len(lump), len(lump)) + bytes([0x43, 0, 0, 0]) + name
open(sys.argv[2], 'wb').write(wad)
if len(sys.argv) > 3:                      # devordagi ko'rinish (sinov uchun)
    p = Image.frombytes('P', (W, H), mips[0]); p.putpalette(pal)
    wall = Image.new('RGB', (W, H), (150, 120, 80)); m = Image.frombytes('L', (W, H), bytes(0 if v == 255 else 255 for v in mips[0]))
    wall.paste(p.convert('RGB'), mask=m); wall.resize((W * 4, H * 4), Image.BILINEAR).save(sys.argv[3])
print(len(wad))
