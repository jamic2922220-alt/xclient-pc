# X CLIENT: launcher yuborgan o'yin damplarini (xc_data/dumps) o'qish - modullar, xato manzili, registrlar, stek. Ishlatish: python3 mdump.py [qurilma_id_boshi]
import struct, glob, os, json, sys
D = '/var/www/boost_top_co_usr/data/www/boost-top.com/mmb/xc_data/dumps'
fs = []
for f in glob.glob(D + '/*.dmp'):
    try: m = json.load(open(f + '.txt'))
    except Exception: m = {}
    fs.append((os.path.getmtime(f), f, m))
fs.sort(reverse=True)
pick = [x for x in fs if x[2].get('k') == 'start' and (len(sys.argv) < 2 or os.path.basename(x[1]).startswith(sys.argv[1]))]
if not pick: print('damp topilmadi:', [os.path.basename(x[1]) for x in fs[:8]]); sys.exit()
_, f, meta = pick[0]; b = open(f, 'rb').read()
print('== FAYL', os.path.basename(f), len(b), meta)
u32 = lambda o: struct.unpack_from('<I', b, o)[0]
u64 = lambda o: struct.unpack_from('<Q', b, o)[0]
def name(rva): n = u32(rva); return b[rva + 4: rva + 4 + n].decode('utf-16-le', 'replace')
ns, dr = u32(8), u32(12); st = {}
for i in range(ns): t, sz, rva = struct.unpack_from('<III', b, dr + i * 12); st[t] = (sz, rva)
mods = []
if 4 in st:
    rva = st[4][1]; n = u32(rva)
    for i in range(n):
        o = rva + 4 + i * 108
        base, size, ts, nrva = u64(o), u32(o + 8), u32(o + 16), u32(o + 20)
        ms, ls = u32(o + 24 + 8), u32(o + 24 + 12)
        ver = '%d.%d.%d.%d' % (ms >> 16, ms & 0xffff, ls >> 16, ls & 0xffff)
        mods.append((base, size, name(nrva), ver, ts))
def where(a):
    for base, size, nm, ver, ts in mods:
        if base <= a < base + size: return '%s+%x' % (nm.split('\\')[-1], a - base)
    return '?%x' % a
print('== MODULLAR (%d)' % len(mods))
for base, size, nm, ver, ts in mods: print('  %08x %8x %-16s %s' % (base, size, ver, nm))
tid = None
if 6 in st:
    o = st[6][1]; tid = u32(o); e = o + 8
    code, addr, np = u32(e), u64(e + 16), u32(e + 24)
    params = [u64(e + 32 + 8 * k) for k in range(min(np, 4))]
    print('== XATO kod=%08x manzil=%s param=%s oqim=%d' % (code, where(addr), [hex(p) for p in params], tid))
    csz, crva = u32(o + 8 + 152), u32(o + 8 + 152 + 4)
    if csz >= 204:
        c = crva; R = lambda k: u32(c + k)
        print('  eax=%08x ebx=%08x ecx=%08x edx=%08x esi=%08x edi=%08x ebp=%08x esp=%08x eip=%s' % (R(176), R(164), R(172), R(168), R(160), R(156), R(180), R(196), where(R(184))))
if 3 in st and tid is not None:
    rva = st[3][1]; n = u32(rva)
    for i in range(n):
        o = rva + 4 + i * 48
        if u32(o) != tid: continue
        sbase, ssz, srva = u64(o + 24), u32(o + 32), u32(o + 36)
        out = []
        for k in range(0, min(ssz, 0x4000), 4):
            v = u32(srva + k); w = where(v)
            if not w.startswith('?'): out.append(w)
        print('== STEK (modullarga ishora qiluvchi qiymatlar, birinchi 40):'); print('  ' + ' | '.join(out[:40]))
