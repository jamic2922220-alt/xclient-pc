# Reels ovoz effektlari (sintez): python3 sfx9.py timing.json sfx.wav
import json, sys, wave, numpy as np
SR = 44100; TM = json.load(open(sys.argv[1])); S = TM['s']; N = int(SR * TM['total'])
out = np.zeros(N); rng = np.random.default_rng(3)
def env(n, a, d): x = np.arange(n) / SR; return np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / d)
def put(y, t, g=1.0):
    s = int(t * SR)
    if 0 <= s < N: y = y[:N - s]; out[s:s + len(y)] += y * g
def bandnoise(sec, lo, hi):
    n = int(sec * SR); w = rng.standard_normal(n); F = np.fft.rfft(w); fr = np.fft.rfftfreq(n, 1 / SR); F[(fr < lo) | (fr > hi)] = 0
    y = np.fft.irfft(F, n); return y / (np.abs(y).max() + 1e-9)
def boom():
    n = int(1.4 * SR); x = np.arange(n) / SR; f = 30 + 90 * np.exp(-x * 9)
    return np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .5)) * .9 + bandnoise(1.4, 40, 2500) * env(n, .002, .25) * .5
def shot():
    n = int(.5 * SR); x = np.arange(n) / SR
    return bandnoise(.5, 200, 7000) * env(n, .0005, .07) * .9 + np.sin(2 * np.pi * (60 + 140 * np.exp(-x * 40)) * x) * env(n, .001, .12) * .6
def whoosh(sec=.6, up=True):
    n = int(sec * SR); x = np.arange(n) / SR; seg = 512; w = rng.standard_normal(n); y = np.zeros(n)
    for i in range(0, n, seg):
        c = (400 + 5000 * (i / n)) if up else (5400 - 5000 * (i / n)); part = w[i:i + seg]; F = np.fft.rfft(part, seg); fr = np.fft.rfftfreq(seg, 1 / SR)
        F[(fr < c * .6) | (fr > c * 1.5)] = 0; y[i:i + seg] = np.fft.irfft(F, seg)[:len(part)]
    return y / (np.abs(y).max() + 1e-9) * np.sin(np.pi * x / sec) * .45
def ding(f=1320):
    n = int(.6 * SR); x = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * x) + .5 * np.sin(2 * np.pi * f * 2.76 * x)) * env(n, .001, .18) * .35
def tick(): n = int(.04 * SR); return bandnoise(.04, 2000, 9000) * env(n, .0003, .008) * .4
def pop(): n = int(.12 * SR); x = np.arange(n) / SR; return np.sin(2 * np.pi * (900 - 500 * x / .12) * x) * env(n, .001, .03) * .45
def bells():
    y = np.zeros(int(1.5 * SR))
    for k, f in enumerate((1568, 1760, 2093, 2349, 2637)):
        s = int(k * .09 * SR); d = ding(f)[:len(y) - s]; y[s:s + len(d)] += d * .6
    return y
st = [a for a, b in S]; du = [b - a for a, b in S]
put(boom(), st[0]); put(shot(), st[0] + .05, .7)                       # TO'XTA!
for k in range(3): put(shot(), st[1] + du[1] * (0.45 + k * 0.15), .8)  # x ESKI MENYU / LAG / QOTISH
put(whoosh(.7), st[2] - .7); put(boom(), st[2], 1.1)                   # X CLIENT reveal
for k in range(14): put(tick(), st[3] + k * .045 * du[3] / 6.2 * 5)     # hisoblagich
put(ding(1760), st[3] + du[3] * 0.62)
put(whoosh(.5), st[4] - .3); put(boom(), st[4] + .35, .6)              # telefon keladi
for k in range(4): put(pop(), st[5] + du[5] * (0.25 + k * 0.12))      # DARAJA XP DO'STLAR SOVG'A
put(pop(), st[6] + du[6] * .15); put(pop(), st[6] + du[6] * .55); put(ding(), st[6] + du[6] * .3, .6)
put(whoosh(.4), st[7]); put(pop(), st[7] + du[7] * .3)
for k in range(3): put(whoosh(.35, k % 2 == 0), st[8] + du[8] * k / 3, .8)
put(bells(), st[9]); put(pop(), st[9] + du[9] * .45); put(pop(), st[9] + du[9] * .65)
put(boom(), st[10], .6); put(ding(2093), st[10] + du[10] * .3, .7)
for k in range(3): put(pop(), st[11] + du[11] * (0.3 + k * 0.22))
out = np.tanh(out * 1.2) * .9
w = wave.open(sys.argv[2], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes()); w.close(); print('ok sfx')
