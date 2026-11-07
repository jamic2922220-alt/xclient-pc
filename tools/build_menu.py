#!/usr/bin/env python3
"""X CLIENT menyusi uchun yuklash paketi (FastPanel > mmb papkasiga ochiladi).

  python3 tools/build_menu.py web/menyu-v<versiya>.zip            # oddiy: faqat rel/<versiya>/ (admin panelda Beta / Hammaga)
  python3 tools/build_menu.py web/x.zip --root                     # + asosiy sahifa (xc.html, index.html, ver.txt) - darhol hammaga
  python3 tools/build_menu.py web/x.zip --php xc_api.php admin.php # + sayt fayllari (web/site dan)

Versiya theme/platform/xclient/ver.txt dan olinadi. rel/<versiya>/index.html dagi xc.css, xc_lang.js, xc.js manzillari
rel/<versiya>/ ga yo'naltiriladi - sahifaning o'zi asosiy manzilda (xc.html) qoladi, boshqa fayllar (xc_api.php, rasmlar) o'zgarmaydi.
"""
import argparse, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MENU = os.path.join(ROOT, 'theme', 'platform', 'xclient')
SITE = os.path.join(ROOT, 'web', 'site')
ASSETS = ('xc.css', 'xc_lang.js', 'xc.js')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--root', action='store_true', help='asosiy sahifani ham almashtirish (darhol hammaga)')
    ap.add_argument('--php', nargs='*', default=[], help='web/site dagi qo\'shimcha fayllar')
    a = ap.parse_args()

    ver = open(os.path.join(MENU, 'ver.txt')).read().strip()
    if not re.match(r'^\d{6,12}$', ver):
        sys.exit('ver.txt noto\'g\'ri: %r' % ver)
    html = open(os.path.join(MENU, 'index.html'), encoding='utf-8').read()
    if "var V = '%s'" % ver not in html:
        sys.exit('index.html dagi V (%s) ver.txt bilan bir xil emas' % ver)
    for f in ASSETS:
        n = html.count('"%s?v=%s"' % (f, ver))
        if n != 1:
            sys.exit('index.html da "%s?v=%s" %d marta (1 bo\'lishi kerak)' % (f, ver, n))
        html = html.replace('"%s?v=%s"' % (f, ver), '"rel/%s/%s?v=%s"' % (ver, f, ver))

    with zipfile.ZipFile(a.out, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in ASSETS:
            z.write(os.path.join(MENU, f), 'rel/%s/%s' % (ver, f))
        z.writestr('rel/%s/index.html' % ver, html)
        if a.root:
            z.writestr('xc.html', html)
            z.writestr('index.html', html)
            z.writestr('ver.txt', ver + '\n')
        for f in a.php:
            z.write(os.path.join(SITE, f), f)
    print('%s: v%s%s%s' % (a.out, ver, ' + asosiy sahifa' if a.root else '', (' + ' + ', '.join(a.php)) if a.php else ''))


if __name__ == '__main__':
    main()
