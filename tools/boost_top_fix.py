#!/usr/bin/env python3
"""boost-top.com tuzatishlari (2026-11-28) - sayt serverida, sayt papkasida ishga tushiriladi:

    cd /var/www/boost_top_co_usr/data/www/boost-top.com && python3 /root/btfix/boost_top_fix.py /root/btfix

Nima qiladi:
  * avval o'zgaradigan fayllarning zaxirasi: /root/bt_zaxira_<vaqt>.tgz (qaytarish: shu arxivni sayt papkasida ochish);
  * templates/user/boost-top/main.tpl va js/bt-dplus.js ga kichik o'zgarishlar (patch.json) - har bir joy faylda
    aynan bir marta topilmasa, HECH NARSA o'zgartirilmaydi;
  * yangi fayllar: css/bt-fix.css, js/bt-fix.js;
  * shablon keshi (engine_cache/template) tozalanadi - sayt yangi shablonni o'qisin.
Qaytarish:  cd <sayt papkasi> && tar xzf /root/bt_zaxira_<vaqt>.tgz   (asl noimage.png ham shu arxivda) && rm -f templates/user/boost-top/css/bt-fix.css templates/user/boost-top/js/bt-fix.js && rm -rf engine_cache/template/*
"""
import json, os, shutil, sys, tarfile, time

src = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
site = os.getcwd()
T = 'templates/user/boost-top/'
if not os.path.isfile(os.path.join(site, T + 'main.tpl')):
    sys.exit("XATO: sayt papkasida emassiz (templates/user/boost-top/main.tpl yo'q)")
patch = json.load(open(os.path.join(src, 'patch.json'), encoding='utf-8'))

new = {}
upg = patch.pop('_upgrade', {})                                # oldingi versiya o'rnatilgan bo'lsa - yangilanadi
for f, hunks in patch.items():
    txt = open(os.path.join(site, f), encoding='utf-8').read()
    for a, b in upg.get(f, []):
        if a != b and a in txt: txt = txt.replace(a, b); new[f] = txt
    if all(txt.count(b) >= 1 for a, b in hunks):                 # qayta ishga tushirilsa - ikki marta qo'shilmaydi
        print("allaqachon o'rnatilgan:", f); new.setdefault(f, None); continue
    for a, b in hunks:
        n = txt.count(a)
        if n != 1:
            sys.exit("XATO: %s faylida kutilgan joy %d marta topildi (1 bo'lishi kerak) - fayl o'zgargan. Hech narsa o'zgartirilmadi." % (f, n))
        txt = txt.replace(a, b)
    new[f] = txt

bk = '/root/bt_zaxira_%s.tgz' % time.strftime('%Y-%m-%d_%H%M')
with tarfile.open(bk, 'w:gz') as tz:
    for f in list(patch) + [T + 'css/bt-fix.css', T + 'js/bt-fix.js', 'media/maps/cs16/noimage.png']:
        if os.path.isfile(os.path.join(site, f)): tz.add(os.path.join(site, f), arcname=f)
print('zaxira:', bk)

st = os.stat(site)
def own(p):
    try: os.chown(p, st.st_uid, st.st_gid)
    except Exception: pass

for f, txt in new.items():
    if txt is None: continue
    p = os.path.join(site, f); tmp = p + '.btfix.tmp'
    open(tmp, 'w', encoding='utf-8').write(txt); own(tmp); os.chmod(tmp, os.stat(p).st_mode & 0o777); os.replace(tmp, p)
    print("o'zgartirildi:", f)
for f in ['css/bt-fix.css', 'js/bt-fix.js']:
    d = os.path.join(site, T + f); shutil.copyfile(os.path.join(src, os.path.basename(f)), d); own(d); os.chmod(d, 0o644)
    print("qo'yildi:", T + f)

# rasmi yo'q xaritalar uchun umumiy rasm (CS 1.6 rasmi) - asl noimage.png zaxirada
ni = os.path.join(src, 'noimage.png'); nd = os.path.join(site, 'media/maps/cs16/noimage.png')
if os.path.isfile(ni) and os.path.isdir(os.path.dirname(nd)):
    if not os.path.isfile(nd) or open(nd, 'rb').read() != open(ni, 'rb').read():
        shutil.copyfile(ni, nd); own(nd); os.chmod(nd, 0o644); print("qo'yildi: media/maps/cs16/noimage.png (rasmi yo'q xaritalar uchun)")

cache = os.path.join(site, 'engine_cache', 'template'); n = 0
if os.path.isdir(cache):
    for root, dirs, files in os.walk(cache):
        for fn in files:
            if fn.startswith('.ht'): continue
            try: os.remove(os.path.join(root, fn)); n += 1
            except Exception: pass
print("shablon keshi tozalandi:", n, "fayl")
print('TAYYOR')
