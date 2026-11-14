#!/usr/bin/env python3
"""Skrinshotlarni oldingi (baseline) bilan solishtiradi. python3 visual.py <yangi papka> [--update]
Farq katta bo'lsa (piksellarning 2% dan ko'pi o'zgargan) - FAIL va farq rasmi diff_*.png. Ataylab o'zgartirilgan bo'lsa: --update."""
import os, sys, glob, shutil
from PIL import Image, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__)); BASE = os.path.join(HERE, 'baseline'); new = sys.argv[1]
os.makedirs(BASE, exist_ok=True); bad = []
for f in sorted(glob.glob(os.path.join(new, '*.png'))):
    n = os.path.basename(f); im = Image.open(f).convert('RGB').resize((800, 450)); bp = os.path.join(BASE, n)
    if '--update' in sys.argv or not os.path.exists(bp): im.save(bp, optimize=True); continue
    d = ImageChops.difference(im, Image.open(bp).convert('RGB')).convert('L').point(lambda v: 255 if v > 40 else 0)
    pct = 100.0 * sum(d.histogram()[255:]) / (800 * 450)
    if pct > 2: bad.append('%s: %.1f%% o\'zgargan' % (n, pct)); Image.merge('RGB', (d, ImageChops.constant(d, 0), ImageChops.constant(d, 0))).save(os.path.join(new, 'diff_' + n))
print(('FAIL visual\n  ' + '\n  '.join(bad)) if bad else 'PASS visual (%d rasm)' % len(glob.glob(os.path.join(new, '*.png'))))
sys.exit(1 if bad else 0)
