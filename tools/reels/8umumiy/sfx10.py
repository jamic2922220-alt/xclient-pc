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
put(boom(), st[0]); put(shot(), st[0] + .05, .7)                                   # TO'XTA!
put(whoosh(.4), st[0] + .15, .6); put(whoosh(.4, False), st[0] + .5, .6)            # eski rasmlar
put(shot(), st[0] + 1.0, .9)                                                        # qizil X
for k in range(4): put(shot(), st[0] + du[0] * (0.35 + k * 0.12), .6)               # muammolar
put(whoosh(.7), st[1] - .7); put(boom(), st[1], 1.1); put(ding(2093), st[1] + du[1] * .72, .6)
for k in range(22): put(tick(), st[2] + k * du[2] * 0.6 / 22)                     # +1500 hisoblagich
put(bells(), st[2] + du[2] * 0.6); put(pop(), st[2] + du[2] * .67)
for i in range(3, 10):                                                              # imkoniyatlar
    put(whoosh(.45), st[i] - .25, .8); put(pop(), st[i] + .1, .7)
put(pop(), st[3] + du[3] * .3); put(ding(), st[3] + du[3] * .72, .5)
for f in (.15, .45, .72): put(pop(), st[4] + du[4] * f)
for k in range(5): put(pop(), st[5] + du[5] * (0.2 + k * 0.1))
for k in range(4): put(pop(), st[6] + du[6] * (0.2 + k * 0.12))
put(whoosh(.35), st[6] + du[6] * .5, .6)
put(pop(), st[7] + du[7] * .15); put(whoosh(.4), st[7] + du[7] * .5, .7); put(bells(), st[7] + du[7] * .55, .7)
put(whoosh(.4), st[8] + du[8] * .5, .7)
for k in range(7): put(pop(), st[9] + du[9] * (0.15 + k * 0.09), .6)
put(whoosh(.8), st[10] - .5); put(boom(), st[10] + .2, 1.0); put(ding(2349), st[10] + du[10] * .45, .7)
for k in range(3): put(whoosh(.35, k % 2 == 0), st[11] + du[11] * k / 3, .8)
put(pop(), st[11] + du[11] * .78)
put(boom(), st[12] + .25, .6); put(ding(1760), st[12] + .3, .6)
for k in range(3): put(pop(), st[12] + du[12] * (0.35 + k * 0.15))
put(pop(), st[13] + .1); put(ding(1568), st[13] + du[13] * .35, .7); put(pop(), st[13] + du[13] * .6)
put(whoosh(.6), st[14] - .4); put(boom(), st[14], .8)
for k in range(3): put(pop(), st[14] + du[14] * (0.1 + k * 0.25))
put(bells(), S[-1][1] - 1.0, .7)
out = np.tanh(out * 1.2) * .9
w = wave.open(sys.argv[2], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes()); w.close(); print('ok sfx')
