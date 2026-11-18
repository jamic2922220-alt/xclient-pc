# 140 BPM phonk/trap uslubidagi fon musiqasi (sintez). Intro 8 takt (filtrlangan), keyin "drop".
import numpy as np, wave, sys
SR=44100; BPM=140; BEAT=60/BPM; BAR=4*BEAT
TOTAL=float(sys.argv[1]) if len(sys.argv)>1 else 90.0; DROP=8*BAR
N=int(SR*TOTAL); L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(11)
def put(y,t,pan=0.0,g=1.0):
    s=int(t*SR); 
    if s>=N: return
    y=y[:N-s]*g; L[s:s+len(y)]+=y*(1-max(0,pan)); R[s:s+len(y)]+=y*(1+min(0,pan))
def env(n,a,d): x=np.arange(n)/SR; return np.minimum(1,x/max(a,1e-4))*np.exp(-x/d)
def kick():
    n=int(.45*SR); x=np.arange(n)/SR; f=45+110*np.exp(-x*28); ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(2.2*np.sin(ph)*env(n,.001,.22))*.9
def snare():
    n=int(.3*SR); w=rng.standard_normal(n); F=np.fft.rfft(w); fr=np.fft.rfftfreq(n,1/SR); F[(fr<900)|(fr>9000)]=0
    nz=np.fft.irfft(F,n); nz/=np.abs(nz).max(); x=np.arange(n)/SR
    return (nz*env(n,.001,.09)*.8+np.sin(2*np.pi*190*x)*env(n,.001,.05)*.5)
def hat(o=False):
    n=int((.18 if o else .05)*SR); w=rng.standard_normal(n); F=np.fft.rfft(w); fr=np.fft.rfftfreq(n,1/SR); F[(fr<6500)|(fr>13000)]=0
    nz=np.fft.irfft(F,n); nz/=np.abs(nz).max()+1e-9; return nz*env(n,.0005,.06 if o else .012)*.16
def bass808(f0,dur,glide=None):
    n=int(dur*SR); x=np.arange(n)/SR; f=np.full(n,f0)
    if glide: f=f0+(glide-f0)*np.clip((x-dur*0.55)/(dur*0.25),0,1)
    ph=2*np.pi*np.cumsum(f)/SR; y=np.sin(ph)*np.minimum(1,x/.005)*np.exp(-x/1.4)
    return np.tanh(1.8*y)*.75
def bell(f,dur=.22):
    n=int(dur*SR); x=np.arange(n)/SR
    y=(np.sign(np.sin(2*np.pi*f*x))*.12+np.sin(2*np.pi*f*1.505*x)*.4+np.sin(2*np.pi*f*2.01*x)*.2)
    return y*env(n,.002,.07)*.32
def pad(f,dur):
    n=int(dur*SR); x=np.arange(n)/SR; y=np.zeros(n)
    for d in (-0.4,0,0.45): y+=np.sin(2*np.pi*(f*(1+d/100))*x)+0.3*np.sin(2*np.pi*f*2*(1+d/100)*x)
    a=np.minimum(1,x/0.6)*np.minimum(1,(dur-x)/0.6); return y*a*.06
# akkordlar (F# minor atrofida): har 2 taktda
roots=[46.25,41.2,36.71,41.2]          # F#1 E1 D1 E1
mel=[[740,0,880,740,0,659,0,587],[659,0,740,659,0,554,0,494],[587,0,659,587,0,740,0,880],[659,0,554,0,659,740,0,0]]
nb=int(TOTAL/BAR)+1
for b in range(nb):
    t0=b*BAR; ci=(b//2)%4; drop=t0>=DROP-1e-6; last=TOTAL-t0<BAR*2
    if b%2==0: put(pad(roots[ci]*8,BAR*2),t0,0,1.0 if not drop else 0.7)
    if drop and not last:
        for k in (0,1.5,2.5) if b%2 else (0,1.75,2.5):
            put(kick(),t0+k*BEAT)
        for k in (1,3): put(snare(),t0+k*BEAT,0.05,0.8)
        for s in range(16):
            if s in (14,) and b%4==3: [put(hat(),t0+(s+q/3)*BEAT/4,0.3) for q in range(3)]
            else: put(hat(s%8==6),t0+s*BEAT/4,0.3 if s%2 else -0.2,0.8 if s%2 else 1)
        put(bass808(roots[ci]*2,BAR*0.95,roots[(ci+1)%4]*2 if b%2 else None),t0)
        for s,f in enumerate(mel[ci]):
            if f: put(bell(f),t0+s*BEAT/2,-0.25 if s%2 else 0.25)
    elif not drop:
        for s in range(8): put(hat(),t0+s*BEAT/2,0.2,0.35)
        if b>=4:
            for s,f in enumerate(mel[ci]):
                if f: put(bell(f),t0+s*BEAT/2,0,0.45)
# drop oldidan kuchayuvchi "vush" va zarb
n=int(BAR*2*SR); x=np.arange(n)/SR; w=rng.standard_normal(n)
from numpy.fft import rfft,irfft,rfftfreq
seg=512; out=np.zeros(n)
for i in range(0,n,seg):
    c=300+6000*(i/n)**2; part=w[i:i+seg]; F=rfft(part,seg); fr=rfftfreq(seg,1/SR); F[(fr<c*.5)|(fr>c*1.8)]=0; out[i:i+seg]=irfft(F,seg)[:len(part)]
put(out/np.abs(out).max()*.25*(x/x[-1])**2,DROP-BAR*2)
put(kick()*1.2,DROP); 
# intro uchun past chastota filtri (drop gacha)
d=int(DROP*SR)
for ch in (L,R):
    a=0.08; y=ch[:d].copy(); z=np.zeros_like(y); acc=0
    for i in range(len(y)): acc+=a*(y[i]-acc); z[i]=acc
    ch[:d]=z*2.2
m=max(np.abs(L).max(),np.abs(R).max()); L/=m/0.9; R/=m/0.9
fo=int(1.5*SR); fade=np.linspace(1,0,fo); L[-fo:]*=fade; R[-fo:]*=fade
st=np.empty(2*N,dtype=np.int16); st[0::2]=(L*32767).astype(np.int16); st[1::2]=(R*32767).astype(np.int16)
w=wave.open(sys.argv[2] if len(sys.argv)>2 else 'music9.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
print('ok', TOTAL, 'drop at', round(DROP,2))
