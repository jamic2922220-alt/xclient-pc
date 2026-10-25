/* =====================================================================
 *  X CLIENT — o'yinni MP4 qilib yozish (xclient_launcher.c ichiga #include qilinadi)
 *  O'yin ochiq turganda F10: yozishni boshlash / to'xtatish. Hech qanday qo'shimcha dastur kerak emas:
 *    tasvir - Desktop Duplication (DXGI 1.2, Windows 8+), ovoz - WASAPI loopback (o'yinda eshitilayotgan ovoz),
 *    siqish - Media Foundation (H.264 + AAC, .mp4). DLL lar dinamik yuklanadi: Windows N (Media Feature Pack siz)
 *    yoki Windows 7 da launcher baribir ochiladi, faqat yozish ishlamaydi (xato ovozi).
 *  Videolar: Videolar\X CLIENT\xc_YYYYMMDD_HHMMSS.mp4. O'yin yopilgach papka ochiladi.
 * ===================================================================== */
#define COBJMACROS
#include <d3d11.h>
#include <dxgi1_2.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#ifdef _MSC_VER
#pragma comment(lib, "dxguid.lib")
#pragma comment(lib, "mfuuid.lib")
#endif

#define REC_FPS      30
#define REC_MAX_W    1920
#define REC_MAX_H    1080
#define REC_MAX_SEC  (60 * 60)          /* bir video eng ko'pi 1 soat - disk to'lib qolmasin */
#define REC_HOTKEY   VK_F10

static const GUID XC_CLSID_MMDevEnum   = { 0xBCDE0395, 0xE52F, 0x467C, { 0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E } };
static const GUID XC_IID_IMMDevEnum    = { 0xA95664D2, 0x9614, 0x4F35, { 0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6 } };
static const GUID XC_IID_IAudioClient  = { 0x1CB9AD4C, 0xDBFA, 0x4C32, { 0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2 } };
static const GUID XC_IID_IAudioCapture = { 0xC8ADBD64, 0xE71E, 0x48A0, { 0xA4, 0xDE, 0x18, 0x5C, 0x39, 0x5C, 0xD3, 0x17 } };
static const GUID XC_SUBTYPE_FLOAT     = { 0x00000003, 0x0000, 0x0010, { 0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71 } };

typedef HRESULT (WINAPI *t_D3D11CreateDevice)(IDXGIAdapter *, D3D_DRIVER_TYPE, HMODULE, UINT, const D3D_FEATURE_LEVEL *, UINT, UINT,
                                              ID3D11Device **, D3D_FEATURE_LEVEL *, ID3D11DeviceContext **);
typedef HRESULT (WINAPI *t_CreateDXGIFactory1)(REFIID, void **);
typedef HRESULT (WINAPI *t_MFStartup)(ULONG, DWORD);
typedef HRESULT (WINAPI *t_MFShutdown)(void);
typedef HRESULT (WINAPI *t_MFCreateMediaType)(IMFMediaType **);
typedef HRESULT (WINAPI *t_MFCreateSample)(IMFSample **);
typedef HRESULT (WINAPI *t_MFCreateMemoryBuffer)(DWORD, IMFMediaBuffer **);
typedef HRESULT (WINAPI *t_MFCreateAttributes)(IMFAttributes **, UINT32);
typedef HRESULT (WINAPI *t_MFCreateSinkWriterFromURL)(LPCWSTR, IMFByteStream *, IMFAttributes *, IMFSinkWriter **);

static struct {
    t_D3D11CreateDevice D3D11CreateDevice; t_CreateDXGIFactory1 CreateDXGIFactory1;
    t_MFStartup MFStartup; t_MFShutdown MFShutdown; t_MFCreateMediaType MFCreateMediaType; t_MFCreateSample MFCreateSample;
    t_MFCreateMemoryBuffer MFCreateMemoryBuffer; t_MFCreateAttributes MFCreateAttributes; t_MFCreateSinkWriterFromURL MFCreateSinkWriterFromURL;
} rf;

static BOOL rec_load(void)
{
    static int st = 0;                  /* 0 - hali yuklanmagan, 1 - bor, -1 - yo'q */
    if (st) return st > 0;
    HMODULE d3d = LoadLibraryW(L"d3d11.dll"), dxgi = LoadLibraryW(L"dxgi.dll"), mfp = LoadLibraryW(L"mfplat.dll"), mfrw = LoadLibraryW(L"mfreadwrite.dll");
    st = -1;
    if (!d3d || !dxgi || !mfp || !mfrw) return FALSE;
    rf.D3D11CreateDevice = (t_D3D11CreateDevice)GetProcAddress(d3d, "D3D11CreateDevice");
    rf.CreateDXGIFactory1 = (t_CreateDXGIFactory1)GetProcAddress(dxgi, "CreateDXGIFactory1");
    rf.MFStartup = (t_MFStartup)GetProcAddress(mfp, "MFStartup");
    rf.MFShutdown = (t_MFShutdown)GetProcAddress(mfp, "MFShutdown");
    rf.MFCreateMediaType = (t_MFCreateMediaType)GetProcAddress(mfp, "MFCreateMediaType");
    rf.MFCreateSample = (t_MFCreateSample)GetProcAddress(mfp, "MFCreateSample");
    rf.MFCreateMemoryBuffer = (t_MFCreateMemoryBuffer)GetProcAddress(mfp, "MFCreateMemoryBuffer");
    rf.MFCreateAttributes = (t_MFCreateAttributes)GetProcAddress(mfp, "MFCreateAttributes");
    rf.MFCreateSinkWriterFromURL = (t_MFCreateSinkWriterFromURL)GetProcAddress(mfrw, "MFCreateSinkWriterFromURL");
    if (!rf.D3D11CreateDevice || !rf.CreateDXGIFactory1 || !rf.MFStartup || !rf.MFShutdown || !rf.MFCreateMediaType || !rf.MFCreateSample
        || !rf.MFCreateMemoryBuffer || !rf.MFCreateAttributes || !rf.MFCreateSinkWriterFromURL) return FALSE;
    st = 1;
    return TRUE;
}

#define SREL(p) do { if (p) { (p)->lpVtbl->Release(p); (p) = NULL; } } while (0)

static volatile LONG g_rec_run = 0;     /* 1 - yozilyapti; 0 ga tushsa yozuv oqimi faylni yopadi */
static HANDLE g_rec_th = NULL;
static HWND g_rec_wnd = NULL;
static wchar_t g_rec_last[MAX_PATH] = L"";
static int g_rec_saved = 0;

/* ---- tasvir: o'yin turgan monitorni Desktop Duplication bilan olish ---- */
typedef struct {
    ID3D11Device *dev; ID3D11DeviceContext *ctx; IDXGIOutputDuplication *dup; IDXGIOutput1 *out1;
    ID3D11Texture2D *stg; UINT sw, sh;          /* manba (monitor) o'lchami */
    UINT tw, th; BYTE *frame;                   /* video o'lchami va oxirgi kadr (BGRA, tepadan pastga) */
    int *xmap, *ymap; UINT mw, mh;              /* manba -> video (kattalashtirish/kichraytirish) */
} Cap;

static void cap_maps(Cap *c, UINT sw, UINT sh)
{
    if (c->xmap && c->mw == sw && c->mh == sh) return;
    free(c->xmap); free(c->ymap);
    c->xmap = (int *)malloc(sizeof(int) * c->tw); c->ymap = (int *)malloc(sizeof(int) * c->th);
    if (!c->xmap || !c->ymap) { free(c->xmap); free(c->ymap); c->xmap = c->ymap = NULL; return; }
    for (UINT x = 0; x < c->tw; x++) c->xmap[x] = (int)((ULONGLONG)x * sw / c->tw) * 4;
    for (UINT y = 0; y < c->th; y++) c->ymap[y] = (int)((ULONGLONG)y * sh / c->th);
    c->mw = sw; c->mh = sh;
}

static BOOL cap_open(Cap *c, HWND game)
{
    IDXGIFactory1 *fac = NULL; IDXGIAdapter1 *ad = NULL, *best_ad = NULL; IDXGIOutput *out = NULL, *best = NULL;
    RECT wr; POINT pt = { 0, 0 };
    if (game && GetWindowRect(game, &wr)) { pt.x = (wr.left + wr.right) / 2; pt.y = (wr.top + wr.bottom) / 2; }
    if (FAILED(rf.CreateDXGIFactory1(&IID_IDXGIFactory1, (void **)&fac))) return FALSE;
    for (UINT a = 0; IDXGIFactory1_EnumAdapters1(fac, a, &ad) != DXGI_ERROR_NOT_FOUND; a++) {
        for (UINT o = 0; IDXGIAdapter1_EnumOutputs(ad, o, &out) != DXGI_ERROR_NOT_FOUND; o++) {
            DXGI_OUTPUT_DESC d;
            BOOL hit = SUCCEEDED(IDXGIOutput_GetDesc(out, &d)) && d.AttachedToDesktop && PtInRect(&d.DesktopCoordinates, pt);
            if (!best || hit) {         /* birinchi monitor - zaxira; o'yin oynasi turgani - asosiy */
                SREL(best); SREL(best_ad);
                best = out; best_ad = ad; IDXGIAdapter1_AddRef(ad); out = NULL;
                if (hit) break;
            }
            SREL(out);
        }
        SREL(ad);
        if (best && game) { DXGI_OUTPUT_DESC d; if (SUCCEEDED(IDXGIOutput_GetDesc(best, &d)) && PtInRect(&d.DesktopCoordinates, pt)) break; }
    }
    SREL(fac);
    if (!best) { SREL(best_ad); return FALSE; }
    HRESULT hr = rf.D3D11CreateDevice((IDXGIAdapter *)best_ad, D3D_DRIVER_TYPE_UNKNOWN, NULL, 0, NULL, 0, D3D11_SDK_VERSION, &c->dev, NULL, &c->ctx);
    SREL(best_ad);
    if (SUCCEEDED(hr)) hr = IDXGIOutput_QueryInterface(best, &IID_IDXGIOutput1, (void **)&c->out1);
    SREL(best);
    if (FAILED(hr)) return FALSE;
    if (FAILED(IDXGIOutput1_DuplicateOutput(c->out1, (IUnknown *)c->dev, &c->dup))) return FALSE;
    DXGI_OUTDUPL_DESC dd;
    IDXGIOutputDuplication_GetDesc(c->dup, &dd);
    c->sw = dd.ModeDesc.Width; c->sh = dd.ModeDesc.Height;
    if (c->sw < 64 || c->sh < 64) return FALSE;
    double k = 1.0;
    if (c->sw > REC_MAX_W || c->sh > REC_MAX_H) { double kx = (double)REC_MAX_W / c->sw, ky = (double)REC_MAX_H / c->sh; k = kx < ky ? kx : ky; }
    c->tw = ((UINT)(c->sw * k)) & ~1u; c->th = ((UINT)(c->sh * k)) & ~1u;
    c->frame = (BYTE *)calloc((size_t)c->tw * c->th, 4);
    return c->frame != NULL;
}

/* o'yin o'lchamni almashtirsa (to'liq ekran / oyna) duplication yo'qoladi - qayta ochamiz, video o'lchami o'zgarmaydi */
static void cap_reopen(Cap *c)
{
    SREL(c->dup);
    if (c->out1 && SUCCEEDED(IDXGIOutput1_DuplicateOutput(c->out1, (IUnknown *)c->dev, &c->dup))) {
        DXGI_OUTDUPL_DESC dd; IDXGIOutputDuplication_GetDesc(c->dup, &dd);
        c->sw = dd.ModeDesc.Width; c->sh = dd.ModeDesc.Height;
    }
}

/* yangi kadr bo'lsa c->frame ga yoziladi; bo'lmasa oldingisi qoladi (video baribir tekis 30 kadr) */
static void cap_grab(Cap *c)
{
    if (!c->dup) { cap_reopen(c); if (!c->dup) return; }
    DXGI_OUTDUPL_FRAME_INFO fi; IDXGIResource *res = NULL; ID3D11Texture2D *tex = NULL;
    HRESULT hr = IDXGIOutputDuplication_AcquireNextFrame(c->dup, 0, &fi, &res);
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) return;
    if (FAILED(hr)) { cap_reopen(c); return; }
    if (fi.LastPresentTime.QuadPart && SUCCEEDED(IDXGIResource_QueryInterface(res, &IID_ID3D11Texture2D, (void **)&tex))) {
        D3D11_TEXTURE2D_DESC td; ID3D11Texture2D_GetDesc(tex, &td);
        if (c->stg) { D3D11_TEXTURE2D_DESC sd; ID3D11Texture2D_GetDesc(c->stg, &sd); if (sd.Width != td.Width || sd.Height != td.Height || sd.Format != td.Format) SREL(c->stg); }
        if (!c->stg) {
            D3D11_TEXTURE2D_DESC sd = td;
            sd.Usage = D3D11_USAGE_STAGING; sd.BindFlags = 0; sd.CPUAccessFlags = D3D11_CPU_ACCESS_READ; sd.MiscFlags = 0; sd.MipLevels = 1; sd.ArraySize = 1;
            sd.SampleDesc.Count = 1; sd.SampleDesc.Quality = 0;
            ID3D11Device_CreateTexture2D(c->dev, &sd, NULL, &c->stg);
        }
        if (c->stg && (td.Format == DXGI_FORMAT_B8G8R8A8_UNORM || td.Format == DXGI_FORMAT_B8G8R8A8_UNORM_SRGB)) {
            ID3D11DeviceContext_CopyResource(c->ctx, (ID3D11Resource *)c->stg, (ID3D11Resource *)tex);
            D3D11_MAPPED_SUBRESOURCE m;
            if (SUCCEEDED(ID3D11DeviceContext_Map(c->ctx, (ID3D11Resource *)c->stg, 0, D3D11_MAP_READ, 0, &m))) {
                const BYTE *src = (const BYTE *)m.pData;
                if (td.Width >= c->tw && td.Height >= c->th && td.Width - c->tw <= 1 && td.Height - c->th <= 1) {
                    for (UINT y = 0; y < c->th; y++) memcpy(c->frame + (size_t)y * c->tw * 4, src + (size_t)y * m.RowPitch, (size_t)c->tw * 4);
                } else {
                    cap_maps(c, td.Width, td.Height);
                    if (c->xmap) for (UINT y = 0; y < c->th; y++) {
                        const BYTE *row = src + (size_t)c->ymap[y] * m.RowPitch;
                        DWORD *dst = (DWORD *)(c->frame + (size_t)y * c->tw * 4);
                        for (UINT x = 0; x < c->tw; x++) dst[x] = *(const DWORD *)(row + c->xmap[x]);
                    }
                }
                ID3D11DeviceContext_Unmap(c->ctx, (ID3D11Resource *)c->stg, 0);
            }
        }
        SREL(tex);
    }
    SREL(res);
    IDXGIOutputDuplication_ReleaseFrame(c->dup);
}

static void cap_close(Cap *c)
{
    SREL(c->stg); SREL(c->dup); SREL(c->out1); SREL(c->ctx); SREL(c->dev);
    free(c->frame); free(c->xmap); free(c->ymap);
    ZeroMemory(c, sizeof(*c));
}

/* ---- ovoz: kompyuterda eshitilayotgan hamma narsa (o'yin, ovozli chat) ---- */
typedef struct {
    IAudioClient *ac; IAudioCaptureClient *cc;
    UINT rate, ch, bits, step;  BOOL flt;       /* manba formati; step - 96/192 kHz ni 48 kHz ga tushirish */
    UINT out_rate; ULONGLONG written;           /* yozilgan kadrlar (out_rate da) */
    short *buf; UINT cap;
} Aud;

static BOOL aud_open(Aud *a)
{
    IMMDeviceEnumerator *en = NULL; IMMDevice *dev = NULL; WAVEFORMATEX *wf = NULL;
    BOOL ok = FALSE;
    if (FAILED(CoCreateInstance(&XC_CLSID_MMDevEnum, NULL, CLSCTX_ALL, &XC_IID_IMMDevEnum, (void **)&en))) return FALSE;
    if (SUCCEEDED(IMMDeviceEnumerator_GetDefaultAudioEndpoint(en, eRender, eConsole, &dev))
        && SUCCEEDED(IMMDevice_Activate(dev, &XC_IID_IAudioClient, CLSCTX_ALL, NULL, (void **)&a->ac))
        && SUCCEEDED(IAudioClient_GetMixFormat(a->ac, &wf))) {
        a->rate = wf->nSamplesPerSec; a->ch = wf->nChannels; a->bits = wf->wBitsPerSample;
        a->flt = wf->wFormatTag == WAVE_FORMAT_IEEE_FLOAT
              || (wf->wFormatTag == WAVE_FORMAT_EXTENSIBLE && IsEqualGUID(&((WAVEFORMATEXTENSIBLE *)wf)->SubFormat, &XC_SUBTYPE_FLOAT));
        a->step = 1;
        if (a->rate == 48000 || a->rate == 44100) a->step = 1;
        else if (a->rate % 48000 == 0) a->step = a->rate / 48000;
        else if (a->rate % 44100 == 0) a->step = a->rate / 44100;
        else a->step = 0;
        a->out_rate = a->step ? a->rate / a->step : 0;
        BOOL fmt_ok = a->step && a->ch >= 1 && ((a->flt && a->bits == 32) || (!a->flt && (a->bits == 16 || a->bits == 32)));
        if (fmt_ok && SUCCEEDED(IAudioClient_Initialize(a->ac, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 10000000, 0, wf, NULL))
            && SUCCEEDED(IAudioClient_GetService(a->ac, &XC_IID_IAudioCapture, (void **)&a->cc))
            && SUCCEEDED(IAudioClient_Start(a->ac))) ok = TRUE;
    }
    if (wf) CoTaskMemFree(wf);
    SREL(dev); SREL(en);
    if (!ok) { SREL(a->cc); SREL(a->ac); }
    return ok;
}

static void aud_close(Aud *a)
{
    if (a->ac) IAudioClient_Stop(a->ac);
    SREL(a->cc); SREL(a->ac);
    free(a->buf); ZeroMemory(a, sizeof(*a));
}

/* ---- yozuvchi (Media Foundation Sink Writer) ---- */
typedef struct { IMFSinkWriter *w; DWORD vs, as; BOOL audio; } Enc;

static IMFMediaType *mt_new(void) { IMFMediaType *t = NULL; return SUCCEEDED(rf.MFCreateMediaType(&t)) ? t : NULL; }
#define PACK2(a, b) (((UINT64)(a) << 32) | (UINT32)(b))

static BOOL enc_open(Enc *e, const wchar_t *path, const Cap *c, const Aud *a, BOOL hw)
{
    IMFAttributes *at = NULL; IMFMediaType *t = NULL;
    HRESULT hr = rf.MFCreateAttributes(&at, 2);
    if (SUCCEEDED(hr)) { IMFAttributes_SetUINT32(at, &MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, hw ? 1 : 0); IMFAttributes_SetGUID(at, &MF_TRANSCODE_CONTAINERTYPE, &MFTranscodeContainerType_MPEG4); }
    if (SUCCEEDED(hr)) hr = rf.MFCreateSinkWriterFromURL(path, NULL, at, &e->w);
    SREL(at);
    if (FAILED(hr)) return FALSE;
    UINT32 br = (UINT32)((ULONGLONG)c->tw * c->th * REC_FPS / 6);   /* ~10 Mbit/s 1080p30 da */
    if (br > 12000000) br = 12000000;
    if (br < 2000000) br = 2000000;
    /* tasvir: chiqish H.264, kirish RGB32 (tepadan pastga) - rang o'zgartirgichni Sink Writer o'zi qo'yadi */
    hr = (t = mt_new()) ? S_OK : E_FAIL;
    if (SUCCEEDED(hr)) {
        IMFMediaType_SetGUID(t, &MF_MT_MAJOR_TYPE, &MFMediaType_Video); IMFMediaType_SetGUID(t, &MF_MT_SUBTYPE, &MFVideoFormat_H264);
        IMFMediaType_SetUINT32(t, &MF_MT_AVG_BITRATE, br); IMFMediaType_SetUINT32(t, &MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
        IMFMediaType_SetUINT64(t, &MF_MT_FRAME_SIZE, PACK2(c->tw, c->th)); IMFMediaType_SetUINT64(t, &MF_MT_FRAME_RATE, PACK2(REC_FPS, 1));
        IMFMediaType_SetUINT64(t, &MF_MT_PIXEL_ASPECT_RATIO, PACK2(1, 1));
        hr = IMFSinkWriter_AddStream(e->w, t, &e->vs);
    }
    SREL(t);
    if (SUCCEEDED(hr)) hr = (t = mt_new()) ? S_OK : E_FAIL;
    if (SUCCEEDED(hr)) {
        IMFMediaType_SetGUID(t, &MF_MT_MAJOR_TYPE, &MFMediaType_Video); IMFMediaType_SetGUID(t, &MF_MT_SUBTYPE, &MFVideoFormat_RGB32);
        IMFMediaType_SetUINT32(t, &MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
        IMFMediaType_SetUINT64(t, &MF_MT_FRAME_SIZE, PACK2(c->tw, c->th)); IMFMediaType_SetUINT64(t, &MF_MT_FRAME_RATE, PACK2(REC_FPS, 1));
        IMFMediaType_SetUINT64(t, &MF_MT_PIXEL_ASPECT_RATIO, PACK2(1, 1));
        IMFMediaType_SetUINT32(t, &MF_MT_DEFAULT_STRIDE, c->tw * 4);
        hr = IMFSinkWriter_SetInputMediaType(e->w, e->vs, t, NULL);
    }
    SREL(t);
    /* ovoz: AAC 192 kbit/s; kirish 16 bit stereo PCM. Ovoz qo'shilmasa ham video yoziladi */
    e->audio = FALSE;
    if (SUCCEEDED(hr) && a->cc) {
        IMFMediaType *o = mt_new(), *i = mt_new();
        if (o && i) {
            IMFMediaType_SetGUID(o, &MF_MT_MAJOR_TYPE, &MFMediaType_Audio); IMFMediaType_SetGUID(o, &MF_MT_SUBTYPE, &MFAudioFormat_AAC);
            IMFMediaType_SetUINT32(o, &MF_MT_AUDIO_BITS_PER_SAMPLE, 16); IMFMediaType_SetUINT32(o, &MF_MT_AUDIO_SAMPLES_PER_SECOND, a->out_rate);
            IMFMediaType_SetUINT32(o, &MF_MT_AUDIO_NUM_CHANNELS, 2); IMFMediaType_SetUINT32(o, &MF_MT_AUDIO_AVG_BYTES_PER_SECOND, 24000);
            IMFMediaType_SetGUID(i, &MF_MT_MAJOR_TYPE, &MFMediaType_Audio); IMFMediaType_SetGUID(i, &MF_MT_SUBTYPE, &MFAudioFormat_PCM);
            IMFMediaType_SetUINT32(i, &MF_MT_AUDIO_BITS_PER_SAMPLE, 16); IMFMediaType_SetUINT32(i, &MF_MT_AUDIO_SAMPLES_PER_SECOND, a->out_rate);
            IMFMediaType_SetUINT32(i, &MF_MT_AUDIO_NUM_CHANNELS, 2); IMFMediaType_SetUINT32(i, &MF_MT_AUDIO_BLOCK_ALIGNMENT, 4);
            IMFMediaType_SetUINT32(i, &MF_MT_AUDIO_AVG_BYTES_PER_SECOND, a->out_rate * 4);
            if (SUCCEEDED(IMFSinkWriter_AddStream(e->w, o, &e->as)) && SUCCEEDED(IMFSinkWriter_SetInputMediaType(e->w, e->as, i, NULL))) e->audio = TRUE;
        }
        SREL(o); SREL(i);
    }
    if (SUCCEEDED(hr)) hr = IMFSinkWriter_BeginWriting(e->w);
    if (FAILED(hr)) { SREL(e->w); return FALSE; }
    return TRUE;
}

static BOOL enc_write(Enc *e, DWORD stream, const void *data, DWORD bytes, LONGLONG t, LONGLONG dur)
{
    IMFMediaBuffer *b = NULL; IMFSample *s = NULL; BYTE *p = NULL;
    HRESULT hr = rf.MFCreateMemoryBuffer(bytes, &b);
    if (SUCCEEDED(hr)) hr = IMFMediaBuffer_Lock(b, &p, NULL, NULL);
    if (SUCCEEDED(hr)) { if (data) memcpy(p, data, bytes); else memset(p, 0, bytes); IMFMediaBuffer_Unlock(b); hr = IMFMediaBuffer_SetCurrentLength(b, bytes); }
    if (SUCCEEDED(hr)) hr = rf.MFCreateSample(&s);
    if (SUCCEEDED(hr)) hr = IMFSample_AddBuffer(s, b);
    if (SUCCEEDED(hr)) hr = IMFSample_SetSampleTime(s, t);
    if (SUCCEEDED(hr)) hr = IMFSample_SetSampleDuration(s, dur);
    if (SUCCEEDED(hr)) hr = IMFSinkWriter_WriteSample(e->w, stream, s);
    SREL(s); SREL(b);
    return SUCCEEDED(hr);
}

static short f2s(float v) { v *= 32767.0f; return (short)(v > 32767.0f ? 32767 : v < -32768.0f ? -32768 : v); }

/* WASAPI paketlarini 16 bit stereo ga aylantirib yozadi; jimlikda (paket kelmaydi) vaqt bo'yicha sukunat qo'shadi */
static void aud_pump(Aud *a, Enc *e, ULONGLONG want)
{
    UINT32 n = 0;
    while (a->cc && SUCCEEDED(IAudioCaptureClient_GetNextPacketSize(a->cc, &n)) && n) {
        BYTE *d = NULL; UINT32 fr = 0; DWORD fl = 0;
        if (FAILED(IAudioCaptureClient_GetBuffer(a->cc, &d, &fr, &fl, NULL, NULL))) break;
        UINT outn = a->step ? fr / a->step : 0;
        if (outn > a->cap) { free(a->buf); a->cap = outn + 4096; a->buf = (short *)malloc(sizeof(short) * 2 * a->cap); if (!a->buf) a->cap = 0; }
        if (a->buf && outn) {
            for (UINT i = 0; i < outn; i++) {
                UINT src = i * a->step, c1 = a->ch > 1 ? 1 : 0;
                short l, r;
                if (fl & AUDCLNT_BUFFERFLAGS_SILENT) l = r = 0;
                else if (a->flt) { const float *f = (const float *)d + (size_t)src * a->ch; l = f2s(f[0]); r = f2s(f[c1]); }
                else if (a->bits == 16) { const short *s = (const short *)d + (size_t)src * a->ch; l = s[0]; r = s[c1]; }
                else { const int *s = (const int *)d + (size_t)src * a->ch; l = (short)(s[0] >> 16); r = (short)(s[c1] >> 16); }
                a->buf[i * 2] = l; a->buf[i * 2 + 1] = r;
            }
            if (e->audio) enc_write(e, e->as, a->buf, outn * 4, (LONGLONG)(a->written * 10000000ULL / a->out_rate), (LONGLONG)(outn * 10000000ULL / a->out_rate));
            a->written += outn;
        }
        IAudioCaptureClient_ReleaseBuffer(a->cc, fr);
    }
    /* hech narsa eshitilmayotgan bo'lsa Windows paket bermaydi - ovoz videodan orqada qolmasin */
    if (e->audio && want > a->written + a->out_rate / 5) {
        ULONGLONG gap = want - a->written;
        while (gap) {
            UINT chunk = gap > a->out_rate / 10 ? a->out_rate / 10 : (UINT)gap;
            enc_write(e, e->as, NULL, chunk * 4, (LONGLONG)(a->written * 10000000ULL / a->out_rate), (LONGLONG)(chunk * 10000000ULL / a->out_rate));
            a->written += chunk; gap -= chunk;
        }
    }
}

static void rec_beep(int kind)          /* 1 - boshlandi, 0 - saqlandi, -1 - xato */
{
    if (kind > 0) { Beep(1200, 70); Beep(1600, 90); }
    else if (kind == 0) { Beep(1600, 70); Beep(1000, 120); }
    else { Beep(400, 300); }
}

static DWORD WINAPI rec_thread(LPVOID unused)
{
    (void)unused;
    Cap c; Aud a; Enc e;
    ZeroMemory(&c, sizeof(c)); ZeroMemory(&a, sizeof(a)); ZeroMemory(&e, sizeof(e));
    wchar_t dir[MAX_PATH], path[MAX_PATH] = L"";
    BOOL mf = FALSE, ok = FALSE;
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (!rec_load() || FAILED(rf.MFStartup(0x00020070 /* MF_VERSION */, 0))) goto done;
    mf = TRUE;
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_MYVIDEO | CSIDL_FLAG_CREATE, NULL, 0, dir))) goto done;
    wcscat(dir, L"\\X CLIENT");
    CreateDirectoryW(dir, NULL);
    SYSTEMTIME st; GetLocalTime(&st);
    _snwprintf(path, MAX_PATH, L"%s\\xc_%04u%02u%02u_%02u%02u%02u.mp4", dir, st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
    path[MAX_PATH - 1] = 0;
    if (!cap_open(&c, g_rec_wnd)) goto done;
    aud_open(&a);                       /* ovoz bo'lmasa ham video yoziladi */
    BOOL hw = TRUE;
    if (!enc_open(&e, path, &c, &a, TRUE)) { hw = FALSE; if (!enc_open(&e, path, &c, &a, FALSE)) goto done; }
    /* videokarta siqgichi birinchi kadrni qabul qilmasa - oddiy (protsessor) siqgich bilan qaytadan */
    cap_grab(&c);
    if (!enc_write(&e, e.vs, c.frame, c.tw * c.th * 4, 0, 10000000 / REC_FPS)) {
        if (!hw) goto done;
        IMFSinkWriter_Finalize(e.w); SREL(e.w); DeleteFileW(path);
        if (!enc_open(&e, path, &c, &a, FALSE) || !enc_write(&e, e.vs, c.frame, c.tw * c.th * 4, 0, 10000000 / REC_FPS)) goto done;
    }
    rec_beep(1);                       /* ovoz signali videoga tushmasin - undan keyin to'plangan ovoz tashlanadi */
    /* siqgich ochilguncha (1 soniyagacha) to'plangan ovozni tashlaymiz - aks holda ovoz tasvirdan oldinda bo'ladi */
    for (UINT32 n = 0; a.cc && SUCCEEDED(IAudioCaptureClient_GetNextPacketSize(a.cc, &n)) && n; ) {
        BYTE *d; UINT32 fr; DWORD fl;
        if (FAILED(IAudioCaptureClient_GetBuffer(a.cc, &d, &fr, &fl, NULL, NULL))) break;
        IAudioCaptureClient_ReleaseBuffer(a.cc, fr);
    }
    ok = TRUE;

    LARGE_INTEGER f, t0, now;
    QueryPerformanceFrequency(&f); QueryPerformanceCounter(&t0);
    const LONGLONG fdur = 10000000 / REC_FPS;
    ULONGLONG k = 1;                   /* 0-kadr yuqorida yozildi */
    DWORD fbytes = c.tw * c.th * 4;
    while (g_rec_run) {
        QueryPerformanceCounter(&now);
        ULONGLONG el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);   /* 100 ns */
        if (el >= (ULONGLONG)REC_MAX_SEC * 10000000ULL) break;
        if (el >= k * fdur) {
            cap_grab(&c);
            if (el > (k + REC_FPS) * fdur) k = el / fdur;      /* kompyuter qotib qolgan bo'lsa - kadrlarni to'plamasdan davom etamiz */
            if (!enc_write(&e, e.vs, c.frame, fbytes, (LONGLONG)(k * fdur), fdur)) break;
            k++;
        }
        if (a.cc) aud_pump(&a, &e, el * a.out_rate / 10000000ULL);
        QueryPerformanceCounter(&now);
        el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);
        if (k * fdur > el + 20000) Sleep((DWORD)((k * fdur - el) / 10000 > 15 ? 15 : (k * fdur - el) / 10000));
    }
done:
    if (e.w) { if (FAILED(IMFSinkWriter_Finalize(e.w))) ok = FALSE; SREL(e.w); }
    aud_close(&a); cap_close(&c);
    if (mf) rf.MFShutdown();
    CoUninitialize();
    InterlockedExchange(&g_rec_run, 0);
    if (ok) { lstrcpynW(g_rec_last, path, MAX_PATH); g_rec_saved++; rec_beep(0); }
    else { if (path[0]) DeleteFileW(path); rec_beep(-1); }
    return 0;
}

static void rec_toggle(HWND game)
{
    if (g_rec_run) { InterlockedExchange(&g_rec_run, 0); return; }        /* to'xtatish: oqim faylni yopib, ovoz beradi */
    if (g_rec_th) {
        if (WaitForSingleObject(g_rec_th, 0) != WAIT_OBJECT_0) return;    /* oldingi video hali yopilyapti */
        CloseHandle(g_rec_th); g_rec_th = NULL;
    }
    g_rec_wnd = game;
    InterlockedExchange(&g_rec_run, 1);
    g_rec_th = CreateThread(NULL, 0, rec_thread, NULL, 0, NULL);
    if (!g_rec_th) InterlockedExchange(&g_rec_run, 0);
}

/* F10: RegisterHotKey (klaviatura kuzatuvchisi emas) - faqat o'yin oynasi oldinda bo'lsa ishlaydi.
 * Tugma o'yinga bormaydi (F10 ba'zi sozlamalarda "quit prompt"). */
static DWORD g_hk_tid = 0, g_game_pid = 0;
static HANDLE g_hk_th = NULL;

static DWORD WINAPI rec_hotkey_thread(LPVOID unused)
{
    (void)unused;
    MSG m;
    PeekMessageW(&m, NULL, WM_USER, WM_USER, PM_NOREMOVE);              /* navbat yaratilsin */
    BOOL reg = RegisterHotKey(NULL, 0xC10, 0x4000 /* MOD_NOREPEAT */, REC_HOTKEY);
    while (GetMessageW(&m, NULL, 0, 0) > 0) {
        if (m.message == WM_HOTKEY && m.wParam == 0xC10) {
            HWND fg = GetForegroundWindow(); DWORD pid = 0;
            GetWindowThreadProcessId(fg, &pid);
            if (pid == g_game_pid) rec_toggle(fg);
        }
    }
    if (reg) UnregisterHotKey(NULL, 0xC10);
    return 0;
}

static void rec_session_begin(DWORD game_pid)
{
    g_game_pid = game_pid; g_rec_saved = 0; g_rec_last[0] = 0;
    g_hk_th = CreateThread(NULL, 0, rec_hotkey_thread, NULL, 0, &g_hk_tid);
}

/* o'yin yopildi: yozilayotgan bo'lsa saqlaymiz; yangi video bo'lsa papkani ochib, faylni belgilaymiz */
static void rec_session_end(void)
{
    if (g_hk_th) { PostThreadMessageW(g_hk_tid, WM_QUIT, 0, 0); WaitForSingleObject(g_hk_th, 3000); CloseHandle(g_hk_th); g_hk_th = NULL; }
    InterlockedExchange(&g_rec_run, 0);
    if (g_rec_th) { WaitForSingleObject(g_rec_th, 30000); CloseHandle(g_rec_th); g_rec_th = NULL; }
    if (g_rec_saved && g_rec_last[0]) {
        wchar_t args[MAX_PATH + 16];
        _snwprintf(args, MAX_PATH + 16, L"/select,\"%s\"", g_rec_last); args[MAX_PATH + 15] = 0;
        ShellExecuteW(NULL, L"open", L"explorer.exe", args, NULL, SW_SHOWNORMAL);
    }
}
