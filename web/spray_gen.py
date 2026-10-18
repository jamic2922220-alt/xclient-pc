import struct, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
W, H, K = 128, 112, 8                      # spray 128x112 = 14336 piksel (GoldSrc chegarasi)
logo = Image.open(sys.argv[1]).convert('RGBA')
big = Image.new('RGBA', (W * K, H * K), (0, 0, 0, 0))
lh = 74 * K; lw = int(logo.width * lh / logo.height)
lg = logo.resize((lw, lh), Image.LANCZOS)
r_, g_, b_, a_ = lg.split()
hard = a_.point(lambda v: 255 if v >= 170 else 0)               # yumshoq nur (glow) olib tashlanadi
lg = Image.merge('RGBA', (r_, g_, b_, hard))
rgb_ = ImageEnhance.Contrast(lg.convert('RGB')).enhance(1.35).point(lambda v: int(255 * (v / 255) ** 0.78))   # qora joylar biroz ochiladi
lg = Image.merge('RGBA', (*rgb_.split(), hard))
outl = hard.filter(ImageFilter.MaxFilter(2 * int(1.4 * K) + 1))   # qora kontur
pos = ((W * K - lw) // 2, 2 * K)
big.paste(Image.new('RGBA', lg.size, (10, 6, 8, 255)), pos, outl)
big.alpha_composite(lg, pos)
font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Black.otf', 23 * K)
d = ImageDraw.Draw(big)
t1, t2 = 'X', ' CLIENT'
w1 = d.textlength(t1, font=font); w2 = d.textlength(t2, font=font)
x = (W * K - (w1 + w2)) / 2; y = 80 * K
st = int(2.2 * K)
d.text((x, y), t1, font=font, fill=(255, 45, 45, 255), stroke_width=st, stroke_fill=(10, 6, 8, 255))
d.text((x + w1, y), t2, font=font, fill=(255, 255, 255, 255), stroke_width=st, stroke_fill=(10, 6, 8, 255))
def level(w, h):
    im = big.resize((w, h), Image.LANCZOS)
    rgb = Image.new('RGB', im.size, (0, 0, 0)); rgb.paste(im, mask=im.split()[3])
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1, percent=140, threshold=1))
    rgb = ImageEnhance.Color(rgb).enhance(1.2); rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
    return rgb, im.split()[3]
full, a0 = level(W, H)
opaque = [full.getpixel((x, y)) for y in range(H) for x in range(W) if a0.getpixel((x, y)) >= 110]
strip = Image.new('RGB', (len(opaque), 1)); strip.putdata(opaque)
pal = strip.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE).getpalette()[:255 * 3]
pal += [0] * (255 * 3 - len(pal)); palimg = Image.new('P', (1, 1)); palimg.putpalette(pal + [0, 0, 0]); pal += [0, 0, 255]
def idx(f):
    rgb, a = level(W // f, H // f)
    data = bytearray(rgb.quantize(palette=palimg, dither=Image.NONE).tobytes())
    for i, av in enumerate(a.tobytes()):
        if av < 110: data[i] = 255
        elif data[i] == 255: data[i] = 254
    return bytes(data)
mips = [idx(1), idx(2), idx(4), idx(8)]
name = b'{LOGO'.ljust(16, b'\0'); offs = []; o = 40
for m in mips: offs.append(o); o += len(m)
lump = name + struct.pack('<6I', W, H, *offs) + b''.join(mips) + struct.pack('<H', 256) + bytes(pal) + b'\0\0'
out = b'WAD3' + struct.pack('<II', 1, 12 + len(lump)) + lump + struct.pack('<iii', 12, len(lump), len(lump)) + bytes([0x43, 0, 0, 0]) + name
open(sys.argv[2], 'wb').write(out)
p = Image.frombytes('P', (W, H), mips[0]); p.putpalette(pal); p.convert('RGB').resize((W * 4, H * 4), Image.NEAREST).save(sys.argv[3])
wall = Image.new('RGB', (W, H), (150, 120, 80)); rgba = p.convert('RGBA'); m = Image.frombytes('L', (W, H), bytes(0 if v == 255 else 255 for v in mips[0])); wall.paste(p.convert('RGB'), mask=m)
wall.resize((W * 4, H * 4), Image.BILINEAR).save(sys.argv[4])
print(len(out))
