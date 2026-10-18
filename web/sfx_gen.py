# X CLIENT menyu ovozlari: sintez qilinadi -> theme/cstrike/sound/xclient/*.wav (22050 Hz, 16-bit, mono)
# Ishlatish: python3 web/sfx_gen.py theme/cstrike/sound/xclient
import sys, wave, numpy as np
SR = 22050
def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, attack=0.002, decay=0.05):
    x = np.arange(n) / SR
    return np.minimum(1, x / attack) * np.exp(-x / decay)
def tone(freqs, sec, decay, amps=None, drop=0.0):
    x = t(sec); y = np.zeros_like(x)
    for i, f in enumerate(freqs):
        fr = f * (1 - drop * x / sec)                                  # ozgina pastga sirpanish
        ph = 2 * np.pi * np.cumsum(fr) / SR
        y += (amps[i] if amps else 1 / (i + 1)) * np.sin(ph)
    return y * env(len(x), decay=decay)
def noise(sec, lo, hi, decay):                                         # oddiy tovush shovqini, filtrlangan
    n = int(SR * sec); w = np.random.default_rng(7).standard_normal(n)
    f = np.fft.rfft(w); fr = np.fft.rfftfreq(n, 1 / SR); f[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(f, n) / 3 * env(n, 0.004, decay)
def sweep(sec, f0, f1, decay):                                         # "vush": chastotasi o'zgaradigan shovqin
    n = int(SR * sec); w = np.random.default_rng(3).standard_normal(n); out = np.zeros(n); seg = 256
    for i in range(0, n, seg):
        c = f0 + (f1 - f0) * i / n; part = w[i:i + seg]
        f = np.fft.rfft(part, seg); fr = np.fft.rfftfreq(seg, 1 / SR); f[(fr < c * 0.6) | (fr > c * 1.6)] = 0
        out[i:i + seg] = np.fft.irfft(f, seg)[:len(part)]
    return out / 2 * env(n, 0.03, decay)
def at(y, sec, total):                                                  # y ni sec soniyadan boshlab joylash
    out = np.zeros(int(SR * total)); s = int(SR * sec); out[s:s + len(y)] += y[:len(out) - s]; return out
def room(y, mix=0.18):                                                  # yengil aks-sado
    out = y.copy()
    for d, g in ((0.031, 0.5), (0.047, 0.35), (0.071, 0.22)):
        k = int(SR * d); out[k:] += mix * g * y[:-k]
    return out
def save(name, y, peak):
    y = y / (np.max(np.abs(y)) or 1) * peak
    fade = min(len(y), int(SR * 0.004)); y[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(f'{sys.argv[1]}/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())
L = 0.30
save('hover',   room(tone([2600, 5200], 0.045, 0.010, [1, 0.25]) + noise(0.045, 3000, 8000, 0.004) * 0.3), 0.16)
save('click',   room(tone([1050, 1575, 2100], 0.12, 0.030, [1, 0.45, 0.2], 0.08) + tone([170], 0.12, 0.020) * 0.8 + noise(0.12, 1500, 6000, 0.006) * 0.4), 0.42)
save('tab',     room(tone([1500, 3000], 0.08, 0.018, [1, 0.3], 0.05) + noise(0.08, 2000, 7000, 0.005) * 0.3), 0.30)
save('open',    room(at(sweep(0.26, 500, 2600, 0.09), 0, 0.42) + at(tone([1046, 1568, 2093], 0.30, 0.11, [1, 0.5, 0.25]), 0.06, 0.42) * 0.7, 0.25), 0.34)
save('close',   room(at(sweep(0.22, 2200, 500, 0.07), 0, 0.36) + at(tone([784, 523], 0.26, 0.08, [1, 0.6]), 0.04, 0.36) * 0.6, 0.22), 0.30)
save('on',      room(at(tone([1320, 2640], 0.06, 0.02, [1, 0.3]), 0, 0.16) + at(tone([1980, 3960], 0.08, 0.025, [1, 0.3]), 0.055, 0.16)), 0.30)
save('off',     room(at(tone([1650, 3300], 0.06, 0.02, [1, 0.3]), 0, 0.16) + at(tone([1100, 2200], 0.08, 0.025, [1, 0.3]), 0.055, 0.16)), 0.27)
save('save',    room(sum(at(tone([f, f * 2, f * 3], 0.32, 0.14, [1, 0.35, 0.12]), i * 0.07, 0.6) for i, f in enumerate([784, 988, 1175, 1568])), 0.3), 0.36)
print('ok')
