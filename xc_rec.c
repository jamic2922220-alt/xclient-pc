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
#include <d3d10.h>
#include <dxgi1_2.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <strmif.h>
#ifdef _MSC_VER
#pragma comment(lib, "dxguid.lib")
#pragma comment(lib, "mfuuid.lib")
#endif

#define REC_FPS      30             /* protsessor bilan siqilganda */
#define REC_FPS_GPU  60             /* videokarta bilan siqilganda - silliq va FPS ga ta'sir qilmaydi */
#define REC_MAX_W    1920
#define REC_MAX_H    1080
#define REC_MAX_SEC  (60 * 60)          /* bir video eng ko'pi 1 soat - disk to'lib qolmasin */
#define REC_HOTKEY   VK_F10

static const GUID XC_CLSID_MMDevEnum   = { 0xBCDE0395, 0xE52F, 0x467C, { 0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E } };
static const GUID XC_IID_IMMDevEnum    = { 0xA95664D2, 0x9614, 0x4F35, { 0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6 } };
static const GUID XC_IID_IAudioClient  = { 0x1CB9AD4C, 0xDBFA, 0x4C32, { 0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2 } };
static const GUID XC_IID_IAudioCapture = { 0xC8ADBD64, 0xE71E, 0x48A0, { 0xA4, 0xDE, 0x18, 0x5C, 0x39, 0x5C, 0xD3, 0x17 } };
/* siqgich sozlamalari (codecapi.h): o'zgaruvchan bitreyt - jim sahnada kam joy, harakatda ko'proq */
static const GUID XC_IID_ICodecAPI     = { 0x901DB4C7, 0x31CE, 0x41A2, { 0x85, 0xDC, 0x8F, 0xA0, 0xBF, 0x41, 0xB8, 0xDA } };
static const GUID XC_CAPI_RateControl  = { 0x1C0608E9, 0x370C, 0x4710, { 0x8A, 0x58, 0xCB, 0x61, 0x81, 0xC4, 0x24, 0x23 } };
static const GUID XC_CAPI_MeanBitRate  = { 0xF7222374, 0x2144, 0x4815, { 0xB5, 0x50, 0xA3, 0x7F, 0x8E, 0x12, 0xEE, 0x52 } };
static const GUID XC_CAPI_GOPSize      = { 0x95F31B26, 0x95A4, 0x41AA, { 0x93, 0x03, 0x24, 0x6A, 0x7F, 0xC6, 0xEE, 0xF1 } };
static const GUID XC_CAPI_BFrames      = { 0x8D390AAC, 0xDC5C, 0x4200, { 0xB5, 0x7F, 0x81, 0x4D, 0x04, 0xBA, 0xBA, 0xB2 } };
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
typedef HRESULT (WINAPI *t_MFCreateSourceReaderFromURL)(LPCWSTR, IMFAttributes *, IMFSourceReader **);
typedef HRESULT (WINAPI *t_MFCreateDXGIDeviceManager)(UINT *, IMFDXGIDeviceManager **);
typedef HRESULT (WINAPI *t_MFCreateDXGISurfaceBuffer)(REFIID, IUnknown *, UINT, BOOL, IMFMediaBuffer **);

static struct {
    t_D3D11CreateDevice D3D11CreateDevice; t_CreateDXGIFactory1 CreateDXGIFactory1;
    t_MFStartup MFStartup; t_MFShutdown MFShutdown; t_MFCreateMediaType MFCreateMediaType; t_MFCreateSample MFCreateSample;
    t_MFCreateMemoryBuffer MFCreateMemoryBuffer; t_MFCreateAttributes MFCreateAttributes; t_MFCreateSinkWriterFromURL MFCreateSinkWriterFromURL;
    t_MFCreateSourceReaderFromURL MFCreateSourceReaderFromURL;
    t_MFCreateDXGIDeviceManager MFCreateDXGIDeviceManager; t_MFCreateDXGISurfaceBuffer MFCreateDXGISurfaceBuffer;   /* Windows 8+; bo'lmasa - protsessor yo'li */
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
    rf.MFCreateSourceReaderFromURL = (t_MFCreateSourceReaderFromURL)GetProcAddress(mfrw, "MFCreateSourceReaderFromURL");
    rf.MFCreateDXGIDeviceManager = (t_MFCreateDXGIDeviceManager)GetProcAddress(mfp, "MFCreateDXGIDeviceManager");
    rf.MFCreateDXGISurfaceBuffer = (t_MFCreateDXGISurfaceBuffer)GetProcAddress(mfp, "MFCreateDXGISurfaceBuffer");
    if (!rf.D3D11CreateDevice || !rf.CreateDXGIFactory1 || !rf.MFStartup || !rf.MFShutdown || !rf.MFCreateMediaType || !rf.MFCreateSample
        || !rf.MFCreateMemoryBuffer || !rf.MFCreateAttributes || !rf.MFCreateSinkWriterFromURL) return FALSE;
    st = 1;
    return TRUE;
}

#define SREL(p) do { if (p) { (p)->lpVtbl->Release(p); (p) = NULL; } } while (0)

/* sifat (menyu > Demo > Video sifati): 2 - yuqori (videokarta, 60 kadr, asl o'lcham), 1 - o'rtacha (videokarta, 30 kadr),
 * 0 - kichik (720p, 30 kadr, kam bitreyt - Telegramga yuborish uchun) */
static int g_buf_fail = 0;                    /* bufer necha marta ochilmadi (4 dan keyin - bu kompyuterda F9 yo'q) */
static int g_vq = 1, g_mic = 0, g_rb = 1;   /* g_mic - mikrofon ovozi videoda; g_rb - "oxirgi 30 soniya" (F9) */
static void rec_quality(void)
{
    char url[200];
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=vq&d=%s", g_id); url[sizeof(url) - 1] = 0;
    char *r = http_get(url, NULL);
    if (r) {
        g_vq = !strncmp(r, "hi", 2) ? 2 : !strncmp(r, "low", 3) ? 0 : 1;
        char q[8]; int mic = 0, rb = 1;
        if (sscanf(r, "%7s %d %d", q, &mic, &rb) >= 2) { g_mic = mic ? 1 : 0; g_rb = rb ? 1 : 0; }
        free(r);
    }   /* internet bo'lmasa - oldingi tanlov */
}
static volatile LONG g_rec_run = 0;     /* 1 - yozilyapti; 0 ga tushsa yozuv oqimi faylni yopadi */
static HANDLE g_rec_th = NULL;
static HWND g_rec_wnd = NULL;
static wchar_t g_rec_last[MAX_PATH] = L"";
static int g_rec_saved = 0;

/* Videolar\X CLIENT papkasi */
static BOOL vid_dir(wchar_t *out)
{
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_MYVIDEO | CSIDL_FLAG_CREATE, NULL, 0, out))) return FALSE;
    wcscat(out, L"\\X CLIENT");
    CreateDirectoryW(out, NULL);
    return TRUE;
}
/* "&vl=xc_20261025_143012~85,..." - eng yangi 120 ta video (nom~MB) */
typedef struct { char n[20]; ULONGLONG t; unsigned mb; } VidF;
static int vid_cmp(const void *a, const void *b) { ULONGLONG x = ((const VidF *)a)->t, y = ((const VidF *)b)->t; return x < y ? 1 : x > y ? -1 : 0; }
static BOOL vid_name_ok(const char *n);
static void vid_list(char *out, size_t cap)
{
    wchar_t dir[MAX_PATH], pat[MAX_PATH];
    lstrcpynA(out, "&vl=", (int)cap);
    if (!vid_dir(dir)) return;
    _snwprintf(pat, MAX_PATH, L"%s\\xc_*.mp4", dir); pat[MAX_PATH - 1] = 0;
    VidF *l = (VidF *)malloc(sizeof(VidF) * 1000); int n = 0;
    if (!l) return;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do {
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || wcslen(fd.cFileName) != 22 || n >= 1000) continue;
            WideCharToMultiByte(CP_UTF8, 0, fd.cFileName, 18, l[n].n, 19, NULL, NULL); l[n].n[18] = 0;
            if (!vid_name_ok(l[n].n)) continue;
            l[n].t = ((ULONGLONG)fd.ftLastWriteTime.dwHighDateTime << 32) | fd.ftLastWriteTime.dwLowDateTime;
            l[n].mb = (unsigned)(((((ULONGLONG)fd.nFileSizeHigh << 32) | fd.nFileSizeLow) + 524288) / 1048576);
            n++;
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    qsort(l, n, sizeof(VidF), vid_cmp);
    size_t len = strlen(out);
    for (int i = 0; i < n && i < 120; i++) {
        if (len + 32 >= cap) break;
        len += _snprintf(out + len, cap - len, "%s%s~%u", i ? "," : "", l[i].n, l[i].mb);
    }
    out[cap - 1] = 0;
    free(l);
}
static BOOL vid_name_ok(const char *n)     /* xc_YYYYMMDD_HHMMSS */
{
    if (strlen(n) != 18 || strncmp(n, "xc_", 3) || n[11] != '_') return FALSE;
    for (int i = 3; i < 18; i++) if (i != 11 && (n[i] < '0' || n[i] > '9')) return FALSE;
    return TRUE;
}

/* ---- tasvir: o'yin turgan monitorni Desktop Duplication bilan olish ---- */
typedef struct {
    ID3D11Device *dev; ID3D11DeviceContext *ctx; IDXGIOutputDuplication *dup; IDXGIOutput1 *out1;
    ID3D11Texture2D *stg[2]; int si, sfull[2];  /* protsessor yo'li: ikki navbatli nusxa - videokartani kutib qolmaslik uchun */
    BOOL gpu, sizechg; ID3D11Texture2D *gtex;   /* videokarta yo'li: oxirgi kadr videokarta xotirasida */
    UINT fps, sw, sh;                           /* manba (monitor) o'lchami */
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

static BOOL cap_open(Cap *c, HWND game, BOOL gpu)
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
    UINT fl = D3D11_CREATE_DEVICE_BGRA_SUPPORT | (gpu ? D3D11_CREATE_DEVICE_VIDEO_SUPPORT : 0);
    HRESULT hr = rf.D3D11CreateDevice((IDXGIAdapter *)best_ad, D3D_DRIVER_TYPE_UNKNOWN, NULL, fl, NULL, 0, D3D11_SDK_VERSION, &c->dev, NULL, &c->ctx);
    if (SUCCEEDED(hr) && gpu) {            /* siqgich boshqa oqimda shu qurilmadan foydalanadi */
        ID3D10Multithread *mt = NULL;
        if (SUCCEEDED(ID3D11DeviceContext_QueryInterface(c->ctx, &IID_ID3D10Multithread, (void **)&mt))) { ID3D10Multithread_SetMultithreadProtected(mt, TRUE); SREL(mt); }
        else hr = E_FAIL;
    }
    SREL(best_ad);
    if (SUCCEEDED(hr)) hr = IDXGIOutput_QueryInterface(best, &IID_IDXGIOutput1, (void **)&c->out1);
    SREL(best);
    if (FAILED(hr)) return FALSE;
    if (FAILED(IDXGIOutput1_DuplicateOutput(c->out1, (IUnknown *)c->dev, &c->dup))) return FALSE;
    DXGI_OUTDUPL_DESC dd;
    IDXGIOutputDuplication_GetDesc(c->dup, &dd);
    c->sw = dd.ModeDesc.Width; c->sh = dd.ModeDesc.Height;
    if (c->sw < 64 || c->sh < 64) return FALSE;
    c->gpu = gpu; c->fps = gpu && g_vq == 2 ? REC_FPS_GPU : REC_FPS;
    if (gpu) {                              /* asl o'lchamda, kichraytirmasdan - eng tiniq */
        if ((c->sw | c->sh) & 1 || c->sw > 4096 || c->sh > 2304) return FALSE;
        c->tw = c->sw; c->th = c->sh;
        return TRUE;
    }
    double k = 1.0;
    UINT mw = g_vq ? REC_MAX_W : 1280, mh = g_vq ? REC_MAX_H : 720;
    if (c->sw > mw || c->sh > mh) { double kx = (double)mw / c->sw, ky = (double)mh / c->sh; k = kx < ky ? kx : ky; }
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

static void cap_cpu_copy(Cap *c, ID3D11Texture2D *stg)
{
    D3D11_TEXTURE2D_DESC td; D3D11_MAPPED_SUBRESOURCE m;
    ID3D11Texture2D_GetDesc(stg, &td);
    if (FAILED(ID3D11DeviceContext_Map(c->ctx, (ID3D11Resource *)stg, 0, D3D11_MAP_READ, 0, &m))) return;
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
    ID3D11DeviceContext_Unmap(c->ctx, (ID3D11Resource *)stg, 0);
}

static ID3D11Texture2D *tex_like(Cap *c, const D3D11_TEXTURE2D_DESC *td, BOOL staging)
{
    D3D11_TEXTURE2D_DESC d = *td; ID3D11Texture2D *t = NULL;
    d.MipLevels = 1; d.ArraySize = 1; d.SampleDesc.Count = 1; d.SampleDesc.Quality = 0; d.MiscFlags = 0;
    if (staging) { d.Usage = D3D11_USAGE_STAGING; d.BindFlags = 0; d.CPUAccessFlags = D3D11_CPU_ACCESS_READ; }
    else { d.Usage = D3D11_USAGE_DEFAULT; d.BindFlags = D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET; d.CPUAccessFlags = 0; }
    return SUCCEEDED(ID3D11Device_CreateTexture2D(c->dev, &d, NULL, &t)) ? t : NULL;
}

/* yangi kadr bo'lsa olinadi (videokarta yo'lida - c->gtex, protsessor yo'lida - c->frame); bo'lmasa oldingisi qoladi */
static void cap_grab(Cap *c, UINT wait_ms)
{
    if (!c->dup) { cap_reopen(c); if (!c->dup) return; }
    DXGI_OUTDUPL_FRAME_INFO fi; IDXGIResource *res = NULL; ID3D11Texture2D *tex = NULL;
    HRESULT hr = IDXGIOutputDuplication_AcquireNextFrame(c->dup, wait_ms, &fi, &res);
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
        /* protsessor yo'li: oldingi nusxa tayyor bo'lsa - endi o'qiymiz (bir kadr kechikish, lekin o'yin kutib qolmaydi) */
        if (!c->gpu) { int p = c->si ^ 1; if (c->sfull[p]) { cap_cpu_copy(c, c->stg[p]); c->sfull[p] = 0; } }
        return;
    }
    if (FAILED(hr)) { cap_reopen(c); return; }
    BOOL first = c->gpu ? !c->gtex : !c->sfull[0] && !c->sfull[1];
    if ((fi.LastPresentTime.QuadPart || first) && SUCCEEDED(IDXGIResource_QueryInterface(res, &IID_ID3D11Texture2D, (void **)&tex))) {
        D3D11_TEXTURE2D_DESC td; ID3D11Texture2D_GetDesc(tex, &td);
        if (td.Format == DXGI_FORMAT_B8G8R8A8_UNORM || td.Format == DXGI_FORMAT_B8G8R8A8_UNORM_SRGB) {
            if (c->gpu) {
                if (td.Width != c->tw || td.Height != c->th) c->sizechg = TRUE;     /* o'yin o'lchamni almashtirdi - shu video saqlanadi */
                else {
                    /* har kadr yangi tekstura: siqgich oldingisini hali o'qiyotgan bo'lishi mumkin (namuna o'z havolasini ushlaydi) */
                    ID3D11Texture2D *t = tex_like(c, &td, FALSE);
                    if (t) { ID3D11DeviceContext_CopyResource(c->ctx, (ID3D11Resource *)t, (ID3D11Resource *)tex); SREL(c->gtex); c->gtex = t; }
                }
            } else {
                int i = c->si;
                if (c->stg[i]) { D3D11_TEXTURE2D_DESC sd; ID3D11Texture2D_GetDesc(c->stg[i], &sd); if (sd.Width != td.Width || sd.Height != td.Height || sd.Format != td.Format) { SREL(c->stg[i]); c->sfull[i] = 0; } }
                if (!c->stg[i]) c->stg[i] = tex_like(c, &td, TRUE);
                if (c->stg[i]) {
                    ID3D11DeviceContext_CopyResource(c->ctx, (ID3D11Resource *)c->stg[i], (ID3D11Resource *)tex);
                    c->sfull[i] = 1;
                    int p = i ^ 1;
                    if (c->sfull[p]) { cap_cpu_copy(c, c->stg[p]); c->sfull[p] = 0; }
                    else if (first) { cap_cpu_copy(c, c->stg[i]); c->sfull[i] = 0; }   /* birinchi kadr darhol */
                    c->si = p;
                }
            }
        }
        SREL(tex);
    }
    SREL(res);
    IDXGIOutputDuplication_ReleaseFrame(c->dup);
}

static void cap_close(Cap *c)
{
    SREL(c->stg[0]); SREL(c->stg[1]); SREL(c->gtex); SREL(c->dup); SREL(c->out1); SREL(c->ctx); SREL(c->dev);
    free(c->frame); free(c->xmap); free(c->ymap);
    ZeroMemory(c, sizeof(*c));
}

/* ---- ovoz: kompyuterda eshitilayotgan hamma narsa (o'yin, ovozli chat) ---- */
typedef struct {
    IAudioClient *ac; IAudioCaptureClient *cc;
    UINT rate, ch, bits, step;  BOOL flt;       /* manba formati; step - 96/192 kHz ni 48 kHz ga tushirish */
    UINT out_rate; ULONGLONG written;           /* yozilgan kadrlar (out_rate da) */
    short *buf; UINT cap;
    /* mikrofon (ixtiyoriy): o'yin ovoziga qo'shiladi */
    IAudioClient *mac; IAudioCaptureClient *mcc;
    UINT mrate, mch, mbits; BOOL mflt; double mstep, mpos; float mlast;
    short *mring; UINT mcap, mhead, mcount;
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

static short f2s(float v) { v *= 32767.0f; return (short)(v > 32767.0f ? 32767 : v < -32768.0f ? -32768 : v); }

static BOOL mic_open(Aud *a)
{
    IMMDeviceEnumerator *en = NULL; IMMDevice *dev = NULL; WAVEFORMATEX *wf = NULL;
    BOOL ok = FALSE;
    if (!a->out_rate || FAILED(CoCreateInstance(&XC_CLSID_MMDevEnum, NULL, CLSCTX_ALL, &XC_IID_IMMDevEnum, (void **)&en))) return FALSE;
    if (SUCCEEDED(IMMDeviceEnumerator_GetDefaultAudioEndpoint(en, eCapture, eCommunications, &dev))
        && SUCCEEDED(IMMDevice_Activate(dev, &XC_IID_IAudioClient, CLSCTX_ALL, NULL, (void **)&a->mac))
        && SUCCEEDED(IAudioClient_GetMixFormat(a->mac, &wf))) {
        a->mrate = wf->nSamplesPerSec; a->mch = wf->nChannels; a->mbits = wf->wBitsPerSample;
        a->mflt = wf->wFormatTag == WAVE_FORMAT_IEEE_FLOAT
               || (wf->wFormatTag == WAVE_FORMAT_EXTENSIBLE && IsEqualGUID(&((WAVEFORMATEXTENSIBLE *)wf)->SubFormat, &XC_SUBTYPE_FLOAT));
        a->mstep = (double)a->mrate / a->out_rate;          /* mikrofon chastotasi -> video chastotasi */
        a->mcap = a->out_rate * 2; a->mring = (short *)calloc(a->mcap, sizeof(short));
        BOOL fmt_ok = a->mring && a->mch >= 1 && a->mrate >= 8000 && ((a->mflt && a->mbits == 32) || (!a->mflt && (a->mbits == 16 || a->mbits == 32)));
        if (fmt_ok && SUCCEEDED(IAudioClient_Initialize(a->mac, AUDCLNT_SHAREMODE_SHARED, 0, 10000000, 0, wf, NULL))
            && SUCCEEDED(IAudioClient_GetService(a->mac, &XC_IID_IAudioCapture, (void **)&a->mcc))
            && SUCCEEDED(IAudioClient_Start(a->mac))) ok = TRUE;
    }
    if (wf) CoTaskMemFree(wf);
    SREL(dev); SREL(en);
    if (!ok) { SREL(a->mcc); SREL(a->mac); free(a->mring); a->mring = NULL; }
    return ok;
}

/* mikrofon paketlari -> bir kanalli 16 bit, video chastotasida halqa buferga */
static void mic_pump(Aud *a)
{
    UINT32 n = 0;
    while (a->mcc && SUCCEEDED(IAudioCaptureClient_GetNextPacketSize(a->mcc, &n)) && n) {
        BYTE *d = NULL; UINT32 fr = 0; DWORD fl = 0;
        if (FAILED(IAudioCaptureClient_GetBuffer(a->mcc, &d, &fr, &fl, NULL, NULL))) break;
        for (UINT32 i = 0; i < fr; i++) {
            float v;
            if (fl & AUDCLNT_BUFFERFLAGS_SILENT) v = 0;
            else if (a->mflt) v = ((const float *)d)[(size_t)i * a->mch];
            else if (a->mbits == 16) v = ((const short *)d)[(size_t)i * a->mch] / 32768.0f;
            else v = (float)(((const int *)d)[(size_t)i * a->mch] / 2147483648.0);
            /* oddiy chiziqli qayta namunalash */
            while (a->mpos <= 1.0) {
                float o = a->mlast + (v - a->mlast) * (float)a->mpos;
                short sv = f2s(o);
                if (a->mcount < a->mcap) { a->mring[(a->mhead + a->mcount) % a->mcap] = sv; a->mcount++; }
                else { a->mring[a->mhead] = sv; a->mhead = (a->mhead + 1) % a->mcap; }
                a->mpos += a->mstep;
            }
            a->mpos -= 1.0; a->mlast = v;
        }
        IAudioCaptureClient_ReleaseBuffer(a->mcc, fr);
    }
    if (a->mcount > a->out_rate / 4) {                         /* kechikish to'planmasin (ovoz tasvirdan orqada qolmasin) */
        UINT drop = a->mcount - a->out_rate / 20;
        a->mhead = (a->mhead + drop) % a->mcap; a->mcount -= drop;
    }
}

static void mic_mix(Aud *a, short *buf, UINT frames)
{
    if (!a->mcc) return;
    for (UINT i = 0; i < frames && a->mcount; i++) {
        int m = a->mring[a->mhead]; a->mhead = (a->mhead + 1) % a->mcap; a->mcount--;
        int l = buf[i * 2] + m, r = buf[i * 2 + 1] + m;
        buf[i * 2] = (short)(l > 32767 ? 32767 : l < -32768 ? -32768 : l);
        buf[i * 2 + 1] = (short)(r > 32767 ? 32767 : r < -32768 ? -32768 : r);
    }
}

static void aud_close(Aud *a)
{
    if (a->ac) IAudioClient_Stop(a->ac);
    if (a->mac) IAudioClient_Stop(a->mac);
    SREL(a->cc); SREL(a->ac); SREL(a->mcc); SREL(a->mac);
    free(a->buf); free(a->mring); ZeroMemory(a, sizeof(*a));
}

/* ---- yozuvchi (Media Foundation Sink Writer) ---- */
typedef struct { IMFSinkWriter *w; DWORD vs, as; BOOL audio; } Enc;

static IMFMediaType *mt_new(void) { IMFMediaType *t = NULL; return SUCCEEDED(rf.MFCreateMediaType(&t)) ? t : NULL; }
#define PACK2(a, b) (((UINT64)(a) << 32) | (UINT32)(b))

/* mgr - videokarta yo'li (teksturalar to'g'ridan-to'g'ri siqgichga); hw - videokarta siqgichi (protsessor yo'lida ham) */
static BOOL enc_open(Enc *e, const wchar_t *path, const Cap *c, const Aud *a, BOOL hw, IMFDXGIDeviceManager *mgr)
{
    IMFAttributes *at = NULL; IMFMediaType *t = NULL;
    HRESULT hr = rf.MFCreateAttributes(&at, 3);
    if (SUCCEEDED(hr) && mgr) IMFAttributes_SetUnknown(at, &MF_SINK_WRITER_D3D_MANAGER, (IUnknown *)mgr);
    if (SUCCEEDED(hr)) { IMFAttributes_SetUINT32(at, &MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, hw || mgr ? 1 : 0); IMFAttributes_SetGUID(at, &MF_TRANSCODE_CONTAINERTYPE, &MFTranscodeContainerType_MPEG4); }
    if (SUCCEEDED(hr)) hr = rf.MFCreateSinkWriterFromURL(path, NULL, at, &e->w);
    SREL(at);
    if (FAILED(hr)) return FALSE;
    /* tiniq: 1080p60 ~25 Mbit/s, 1080p30 ~16 Mbit/s (YouTube tavsiyasidan yuqori) */
    /* 1080p60 ~25 Mbit/s (yuqori), 1080p30 ~8 Mbit/s (o'rtacha), 720p30 ~2.3 Mbit/s (kichik) */
    /* High profil + o'zgaruvchan bitreyt: CS 1.6 tasviri oddiy - kamroq bitreytda ham tiniq.
     * 1080p60 ~15 Mbit/s (~110 MB/daq), 1080p30 ~5 Mbit/s (~40 MB/daq), 720p30 ~1.7 Mbit/s (~13 MB/daq) */
    UINT32 br = (UINT32)((ULONGLONG)c->tw * c->th * c->fps / (g_vq == 2 ? 8 : g_vq == 1 ? 12 : 16));
    if (br > 50000000) br = 50000000;
    if (br < 1200000) br = 1200000;
    /* tasvir: chiqish H.264, kirish RGB32 (tepadan pastga) - rang o'zgartirgichni Sink Writer o'zi qo'yadi */
    hr = (t = mt_new()) ? S_OK : E_FAIL;
    if (SUCCEEDED(hr)) {
        IMFMediaType_SetGUID(t, &MF_MT_MAJOR_TYPE, &MFMediaType_Video); IMFMediaType_SetGUID(t, &MF_MT_SUBTYPE, &MFVideoFormat_H264);
        IMFMediaType_SetUINT32(t, &MF_MT_AVG_BITRATE, br); IMFMediaType_SetUINT32(t, &MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
        IMFMediaType_SetUINT64(t, &MF_MT_FRAME_SIZE, PACK2(c->tw, c->th)); IMFMediaType_SetUINT64(t, &MF_MT_FRAME_RATE, PACK2(c->fps, 1));
        IMFMediaType_SetUINT64(t, &MF_MT_PIXEL_ASPECT_RATIO, PACK2(1, 1));
        IMFMediaType_SetUINT32(t, &MF_MT_MPEG2_PROFILE, 100 /* eAVEncH264VProfile_High */);
        hr = IMFSinkWriter_AddStream(e->w, t, &e->vs);
        if (FAILED(hr)) { IMFMediaType_DeleteItem(t, &MF_MT_MPEG2_PROFILE); hr = IMFSinkWriter_AddStream(e->w, t, &e->vs); }   /* High ni bilmaydigan siqgich */
    }
    SREL(t);
    if (SUCCEEDED(hr)) hr = (t = mt_new()) ? S_OK : E_FAIL;
    if (SUCCEEDED(hr)) {
        IMFMediaType_SetGUID(t, &MF_MT_MAJOR_TYPE, &MFMediaType_Video); IMFMediaType_SetGUID(t, &MF_MT_SUBTYPE, &MFVideoFormat_RGB32);
        IMFMediaType_SetUINT32(t, &MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
        IMFMediaType_SetUINT64(t, &MF_MT_FRAME_SIZE, PACK2(c->tw, c->th)); IMFMediaType_SetUINT64(t, &MF_MT_FRAME_RATE, PACK2(c->fps, 1));
        IMFMediaType_SetUINT64(t, &MF_MT_PIXEL_ASPECT_RATIO, PACK2(1, 1));
        IMFMediaType_SetUINT32(t, &MF_MT_DEFAULT_STRIDE, c->tw * 4);
        hr = IMFSinkWriter_SetInputMediaType(e->w, e->vs, t, NULL);
    }
    SREL(t);
    if (SUCCEEDED(hr)) {                    /* bo'lmasa - siqgichning o'z rejimi (o'rtacha bitreyt baribir shu) */
        ICodecAPI *api = NULL;
        if (SUCCEEDED(IMFSinkWriter_GetServiceForStream(e->w, e->vs, &GUID_NULL, &XC_IID_ICodecAPI, (void **)&api)) && api) {
            VARIANT v; ZeroMemory(&v, sizeof(v)); v.vt = VT_UI4;   /* VariantInit emas - oleaut32 kerak bo'lmasin */
            v.ulVal = 2;  ICodecAPI_SetValue(api, &XC_CAPI_RateControl, &v);   /* eAVEncCommonRateControlMode_UnconstrainedVBR */
            v.ulVal = br; ICodecAPI_SetValue(api, &XC_CAPI_MeanBitRate, &v);
            v.ulVal = c->fps * 2; ICodecAPI_SetValue(api, &XC_CAPI_GOPSize, &v);   /* har 2 soniyada kalit kadr - kesish/klip shu nuqtalardan */
            v.ulVal = 0; ICodecAPI_SetValue(api, &XC_CAPI_BFrames, &v);              /* B-kadrsiz - qayta siqmasdan birlashtirish uchun */
            SREL(api);
        }
    }
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

/* videokarta yo'li: tekstura nusxalanmasdan siqgichga beriladi */
static BOOL enc_write_tex(Enc *e, ID3D11Texture2D *tex, LONGLONG t, LONGLONG dur)
{
    IMFMediaBuffer *b = NULL; IMF2DBuffer *b2 = NULL; IMFSample *s = NULL; DWORD len = 0;
    HRESULT hr = rf.MFCreateDXGISurfaceBuffer(&IID_ID3D11Texture2D, (IUnknown *)tex, 0, FALSE, &b);
    if (SUCCEEDED(hr)) hr = IMFMediaBuffer_QueryInterface(b, &IID_IMF2DBuffer, (void **)&b2);
    if (SUCCEEDED(hr)) hr = IMF2DBuffer_GetContiguousLength(b2, &len);
    if (SUCCEEDED(hr)) hr = IMFMediaBuffer_SetCurrentLength(b, len);
    if (SUCCEEDED(hr)) hr = rf.MFCreateSample(&s);
    if (SUCCEEDED(hr)) hr = IMFSample_AddBuffer(s, b);
    if (SUCCEEDED(hr)) hr = IMFSample_SetSampleTime(s, t);
    if (SUCCEEDED(hr)) hr = IMFSample_SetSampleDuration(s, dur);
    if (SUCCEEDED(hr)) hr = IMFSinkWriter_WriteSample(e->w, e->vs, s);
    SREL(s); SREL(b2); SREL(b);
    return SUCCEEDED(hr);
}

static BOOL enc_frame(Enc *e, Cap *c, LONGLONG t, LONGLONG dur)
{
    if (c->gpu) return c->gtex ? enc_write_tex(e, c->gtex, t, dur) : TRUE;   /* hali kadr yo'q - o'tkazib yuboramiz */
    return enc_write(e, e->vs, c->frame, c->tw * c->th * 4, t, dur);
}


/* WASAPI paketlarini 16 bit stereo ga aylantirib yozadi; jimlikda (paket kelmaydi) vaqt bo'yicha sukunat qo'shadi */
static void aud_pump(Aud *a, Enc *e, ULONGLONG want)
{
    UINT32 n = 0;
    if (a->mcc) mic_pump(a);
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
            mic_mix(a, a->buf, outn);
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
            const short *data = NULL;                      /* o'yin jim - lekin mikrofon bo'lsa uning ovozi */
            if (a->mcc) {
                if (chunk > a->cap) { free(a->buf); a->cap = chunk + 4096; a->buf = (short *)malloc(sizeof(short) * 2 * a->cap); if (!a->buf) a->cap = 0; }
                if (a->buf) { memset(a->buf, 0, (size_t)chunk * 4); mic_mix(a, a->buf, chunk); data = a->buf; }
            }
            enc_write(e, e->as, data, chunk * 4, (LONGLONG)(a->written * 10000000ULL / a->out_rate), (LONGLONG)(chunk * 10000000ULL / a->out_rate));
            a->written += chunk; gap -= chunk;
        }
    }
}

/* ---- qayta siqmasdan birlashtirish / kesish (Source Reader -> Sink Writer, "passthrough"): bir necha soniyada tayyor, sifat yo'qolmaydi.
 *      Har bo'lakda from/to (100 ns, 0 - cheklovsiz): boshlanish eng yaqin oldingi kalit kadrdan (har 2 soniyada).
 *      Bir videoning bir necha bo'lagi ketma-ket qo'yilsa - o'rtasidagi qism kesib tashlanadi (muharrirdagi qaychi). ---- */
typedef struct { const wchar_t *src; LONGLONG from, to; } RemuxPart;
static BOOL remux_parts(const RemuxPart *parts, int n, const wchar_t *dst, LONGLONG *outdur)
{
    IMFAttributes *at = NULL; IMFSinkWriter *w = NULL;
    DWORD ov = 0, oa = 0; BOOL haveA = FALSE, began = FALSE, ok = FALSE;
    LONGLONG off = 0;
    if (!rf.MFCreateSourceReaderFromURL || n < 1) return FALSE;
    if (FAILED(rf.MFCreateAttributes(&at, 1))) return FALSE;
    IMFAttributes_SetGUID(at, &MF_TRANSCODE_CONTAINERTYPE, &MFTranscodeContainerType_MPEG4);
    HRESULT hr = rf.MFCreateSinkWriterFromURL(dst, NULL, at, &w);
    SREL(at);
    if (FAILED(hr)) return FALSE;
    for (int i = 0; i < n; i++) {
        IMFSourceReader *r = NULL;
        LONGLONG from = parts[i].from, to = parts[i].to;
        if (FAILED(rf.MFCreateSourceReaderFromURL(parts[i].src, NULL, &r))) continue;
        /* oqimlar: birinchi video va birinchi ovoz */
        int vi = -1, ai = -1;
        for (DWORD si = 0; si < 8; si++) {
            IMFMediaType *t = NULL; GUID mj;
            if (FAILED(IMFSourceReader_GetNativeMediaType(r, si, 0, &t))) break;
            if (SUCCEEDED(IMFMediaType_GetGUID(t, &MF_MT_MAJOR_TYPE, &mj))) {
                if (vi < 0 && IsEqualGUID(&mj, &MFMediaType_Video)) vi = (int)si;
                else if (ai < 0 && IsEqualGUID(&mj, &MFMediaType_Audio)) ai = (int)si;
            }
            SREL(t);
        }
        if (vi < 0) { SREL(r); continue; }
        if (!began) {
            IMFMediaType *tv = NULL, *ta = NULL;
            if (SUCCEEDED(IMFSourceReader_GetNativeMediaType(r, vi, 0, &tv)) && SUCCEEDED(IMFSinkWriter_AddStream(w, tv, &ov))
                && SUCCEEDED(IMFSinkWriter_SetInputMediaType(w, ov, tv, NULL))) {
                if (ai >= 0 && SUCCEEDED(IMFSourceReader_GetNativeMediaType(r, ai, 0, &ta)) && SUCCEEDED(IMFSinkWriter_AddStream(w, ta, &oa))
                    && SUCCEEDED(IMFSinkWriter_SetInputMediaType(w, oa, ta, NULL))) haveA = TRUE;
                began = SUCCEEDED(IMFSinkWriter_BeginWriting(w));
            }
            SREL(tv); SREL(ta);
            if (!began) { SREL(r); break; }
        }
        IMFSourceReader_SetStreamSelection(r, MF_SOURCE_READER_ALL_STREAMS, FALSE);
        IMFSourceReader_SetStreamSelection(r, vi, TRUE);
        if (haveA && ai >= 0) IMFSourceReader_SetStreamSelection(r, ai, TRUE);
        if (from > 0) { PROPVARIANT pv; ZeroMemory(&pv, sizeof(pv)); pv.vt = VT_I8; pv.hVal.QuadPart = from; IMFSourceReader_SetCurrentPosition(r, &GUID_NULL, &pv); }
        LONGLONG base = -1, last = off;
        BOOL vend = FALSE, aend = !(haveA && ai >= 0);
        while (!vend || !aend) {
            DWORD idx = 0, fl = 0; LONGLONG ts = 0; IMFSample *smp = NULL;
            if (FAILED(IMFSourceReader_ReadSample(r, MF_SOURCE_READER_ANY_STREAM, 0, &idx, &fl, &ts, &smp))) break;
            BOOL isv = (int)idx == vi;
            if (fl & MF_SOURCE_READERF_ENDOFSTREAM) { if (isv) vend = TRUE; else aend = TRUE; }
            if (!smp) continue;
            if (to > 0 && ts > to) { if (isv) vend = TRUE; else aend = TRUE; SREL(smp); continue; }
            if (base < 0) base = ts;
            LONGLONG nt = ts - base + off, dur = 0;
            if (nt >= off) {
                IMFSample_SetSampleTime(smp, nt);
                IMFSample_GetSampleDuration(smp, &dur);
                if (SUCCEEDED(IMFSinkWriter_WriteSample(w, isv ? ov : oa, smp))) { ok = TRUE; if (nt + dur > last) last = nt + dur; }
            }
            SREL(smp);
        }
        off = last;
        SREL(r);
    }
    if (began && FAILED(IMFSinkWriter_Finalize(w))) ok = FALSE;
    SREL(w);
    if (outdur) *outdur = off;
    if (!ok) DeleteFileW(dst);
    return ok;
}
static BOOL remux(const wchar_t *const *src, int n, const wchar_t *dst, LONGLONG from, LONGLONG to, LONGLONG *outdur)
{
    RemuxPart p[16];
    if (n < 1 || n > 16) return FALSE;
    for (int i = 0; i < n; i++) { p[i].src = src[i]; p[i].from = n == 1 ? from : 0; p[i].to = n == 1 ? to : 0; }
    return remux_parts(p, n, dst, outdur);
}

static void rec_beep(int kind)          /* 1 - boshlandi, 0 - saqlandi, -1 - xato */
{
    if (kind > 0) { Beep(1200, 70); Beep(1600, 90); }
    else if (kind == 0) { Beep(1600, 70); Beep(1000, 120); }
    else { Beep(400, 300); }
}

/* ---- ekrandagi belgi: yozilyapti / saqlandi / xato. Videoga tushmaydi (WDA_EXCLUDEFROMCAPTURE, Windows 10 2004+);
 *      eski Windows'da "REC" faqat 3 soniya ko'rinadi. Oyna fokusni olmaydi va sichqonchani o'tkazadi - o'yin yig'ilib qolmaydi. ---- */
#define WM_REC_STATE (WM_APP + 2)
static HWND g_ov = NULL;
static int g_ov_mode = 0;                /* 0 - yashirin, 1 - yozilyapti, 2 - saqlandi, 3 - xato, 4 - klip saqlandi, 5 - F9 o'chiq, 6 - kesildi */
static DWORD g_ov_t0 = 0;
static BOOL g_ov_excl = FALSE;          /* videodan chiqarib bo'ldimi */

static LRESULT CALLBACK ov_proc(HWND h, UINT m, WPARAM w, LPARAM l)
{
    if (m == WM_PAINT) {
        PAINTSTRUCT ps; HDC dc = BeginPaint(h, &ps); RECT r; GetClientRect(h, &r);
        HBRUSH bg = CreateSolidBrush(RGB(22, 10, 13)), red = CreateSolidBrush(g_ov_mode == 2 || g_ov_mode == 4 || g_ov_mode == 6 ? RGB(46, 204, 113) : RGB(255, 59, 59));
        FillRect(dc, &r, bg);
        RECT b = r; FrameRect(dc, &b, red); InflateRect(&b, -1, -1); FrameRect(dc, &b, red);
        HGDIOBJ ob = SelectObject(dc, red); HGDIOBJ op = SelectObject(dc, GetStockObject(NULL_PEN));
        if (g_ov_mode == 1 && (GetTickCount() / 500) % 2 == 0) Ellipse(dc, 16, r.bottom / 2 - 8, 32, r.bottom / 2 + 8);   /* miltillovchi nuqta */
        SelectObject(dc, op); SelectObject(dc, ob);
        HFONT f = CreateFontW(22, 0, 0, 0, FW_BOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
        HGDIOBJ of = SelectObject(dc, f);
        SetBkMode(dc, TRANSPARENT); SetTextColor(dc, RGB(255, 255, 255));
        BOOL ru = !strcmp(g_lang, "ru");
        wchar_t t[160];
        if (g_ov_mode == 1) {
            DWORD s = (GetTickCount() - g_ov_t0) / 1000;
            _snwprintf(t, 160, ru ? L"REC  %02lu:%02lu   \u00b7   F10 \u2014 \u0441\u0442\u043e\u043f" : L"REC  %02lu:%02lu   \u00b7   F10 \u2014 to\u2018xtatish", s / 60, s % 60);
        } else if (g_ov_mode == 4) lstrcpynW(t, ru ? L"\u2713  \u041a\u043b\u0438\u043f \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d \u2014 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 30 \u0441" : L"\u2713  Klip saqlandi \u2014 oxirgi 30 soniya", 160);
        else if (g_ov_mode == 5) lstrcpynW(t, ru ? L"F9: \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0435 \u00ab\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 30 \u0441\u0435\u043a\u0443\u043d\u0434\u00bb \u0432 \u043c\u0435\u043d\u044e \u2192 \u0414\u0435\u043c\u043e" : L"F9: menyu \u2192 Demo \u2192 \u00abOxirgi 30 soniya\u00bb ni yoqing", 160);
        else if (g_ov_mode == 7) lstrcpynW(t, ru ? L"F9 \u043d\u0435 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u043d\u0430 \u044d\u0442\u043e\u043c \u041f\u041a (\u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u0430) \u2014 \u0437\u0430\u043f\u0438\u0441\u044b\u0432\u0430\u0439\u0442\u0435 F10" : L"F9 bu kompyuterda ishlamaydi (videokarta) \u2014 F10 bilan yozing", 160);
        else if (g_ov_mode == 8) lstrcpynW(t, ru ? L"F9 \u0435\u0449\u0451 \u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0441\u044f \u2014 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043f\u0430\u0440\u0443 \u0441\u0435\u043a\u0443\u043d\u0434" : L"F9 hali tayyorlanmoqda \u2014 birozdan keyin bosing", 160);
        else if (g_ov_mode == 9) lstrcpynW(t, ru ? L"\u2713  \u041a\u043b\u0438\u043f \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d" : L"\u2713  Klip saytga joylandi", 160);
        else if (g_ov_mode == 10) lstrcpynW(t, ru ? L"\u2716  \u041a\u043b\u0438\u043f \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f" : L"\u2716  Klip yuklanmadi", 160);
        else if (g_ov_mode == 6) lstrcpynW(t, ru ? L"\u2713  \u0412\u0438\u0434\u0435\u043e \u043e\u0431\u0440\u0435\u0437\u0430\u043d\u043e" : L"\u2713  Video kesildi", 160);
        else if (g_ov_mode == 2) lstrcpynW(t, ru ? L"\u2713  \u0412\u0438\u0434\u0435\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e" : L"\u2713  Video saqlandi", 160);
        else lstrcpynW(t, ru ? L"\u2716  \u0412\u0438\u0434\u0435\u043e \u043d\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043b\u043e\u0441\u044c" : L"\u2716  Video yozilmadi", 160);
        t[159] = 0;
        RECT tr = r; tr.left = g_ov_mode == 1 ? 42 : 18;
        DrawTextW(dc, t, -1, &tr, DT_SINGLELINE | DT_VCENTER | DT_LEFT | DT_NOPREFIX);
        SelectObject(dc, of); DeleteObject(f); DeleteObject(bg); DeleteObject(red);
        EndPaint(h, &ps);
        return 0;
    }
    if (m == WM_TIMER) {
        if (w == 1) InvalidateRect(h, NULL, FALSE);                                   /* vaqt va nuqta */
        if (w == 2) { KillTimer(h, 2); ShowWindow(h, SW_HIDE); if (g_ov_mode != 1) KillTimer(h, 1); }
        return 0;
    }
    if (m == WM_NCHITTEST) return HTTRANSPARENT;
    return DefWindowProcW(h, m, w, l);
}

static void ov_show(int mode)
{
    if (!g_ov) {
        WNDCLASSW wc = { 0 }; wc.lpfnWndProc = ov_proc; wc.hInstance = GetModuleHandleW(NULL); wc.lpszClassName = L"XCRecOverlay"; wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        RegisterClassW(&wc);
        g_ov = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED | WS_EX_TRANSPARENT, wc.lpszClassName, L"", WS_POPUP,
                               0, 0, 10, 10, NULL, NULL, wc.hInstance, NULL);
        if (!g_ov) return;
        SetLayeredWindowAttributes(g_ov, 0, 235, LWA_ALPHA);
        typedef BOOL (WINAPI *t_SWDA)(HWND, DWORD);
        t_SWDA swda = (t_SWDA)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetWindowDisplayAffinity");
        g_ov_excl = swda && swda(g_ov, 0x11 /* WDA_EXCLUDEFROMCAPTURE */);
    }
    g_ov_mode = mode;
    if (mode == 1) g_ov_t0 = GetTickCount();
    /* o'yin turgan monitorning tepasida, o'rtada */
    MONITORINFO mi = { sizeof(mi) };
    HMONITOR mon = MonitorFromWindow(g_rec_wnd ? g_rec_wnd : GetForegroundWindow(), MONITOR_DEFAULTTOPRIMARY);
    GetMonitorInfoW(mon, &mi);
    int W = mode == 1 ? 380 : mode == 4 ? 440 : mode == 5 || mode == 7 || mode == 8 ? 600 : 330, H = 46;
    int x = (mi.rcMonitor.left + mi.rcMonitor.right - W) / 2, y = mi.rcMonitor.top + 28;
    SetWindowRgn(g_ov, CreateRoundRectRgn(0, 0, W + 1, H + 1, 12, 12), FALSE);
    SetWindowPos(g_ov, HWND_TOPMOST, x, y, W, H, SWP_NOACTIVATE | SWP_SHOWWINDOW);
    InvalidateRect(g_ov, NULL, TRUE);
    KillTimer(g_ov, 2);
    if (mode == 1) { SetTimer(g_ov, 1, 500, NULL); if (!g_ov_excl) SetTimer(g_ov, 2, 3000, NULL); }   /* videoga tushadigan bo'lsa - qisqa */
    else { KillTimer(g_ov, 1); SetTimer(g_ov, 2, 3500, NULL); }
}

static void ov_close(void)
{
    if (g_ov) { DestroyWindow(g_ov); g_ov = NULL; }
    g_ov_mode = 0;
}

static DWORD g_hk_tid = 0, g_game_pid = 0;

/* yozishni boshlash: videokarta yo'li (gpu_only bo'lsa - faqat shu), bo'lmasa protsessor yo'li; birinchi kadr yoziladi */
static BOOL rec_begin(Cap *c, Aud *a, Enc *e, const wchar_t *path, IMFDXGIDeviceManager **mgr, BOOL gpu_only)
{
    UINT tok = 0;
    if ((g_vq || gpu_only) && rf.MFCreateDXGIDeviceManager && rf.MFCreateDXGISurfaceBuffer && cap_open(c, g_rec_wnd, TRUE)
        && SUCCEEDED(rf.MFCreateDXGIDeviceManager(&tok, mgr)) && SUCCEEDED(IMFDXGIDeviceManager_ResetDevice(*mgr, (IUnknown *)c->dev, tok))
        && enc_open(e, path, c, a, TRUE, *mgr)) {
        cap_grab(c, 200);
        if (c->gtex && enc_frame(e, c, 0, 10000000 / c->fps)) return TRUE;
    }
    if (e->w) { IMFSinkWriter_Finalize(e->w); SREL(e->w); }
    DeleteFileW(path);
    cap_close(c); SREL(*mgr);
    if (!cap_open(c, g_rec_wnd, FALSE)) return FALSE;
    BOOL hw = TRUE;
    /* gpu_only (F9 buferi): videokarta siqgichi bo'lmasa - protsessor siqgichi doimiy ishlab FPS ni tushirmasin */
    if (!enc_open(e, path, c, a, TRUE, NULL)) { hw = FALSE; if (gpu_only || !enc_open(e, path, c, a, FALSE, NULL)) { cap_close(c); return FALSE; } }
    cap_grab(c, 200);
    if (enc_frame(e, c, 0, 10000000 / c->fps)) return TRUE;
    IMFSinkWriter_Finalize(e->w); SREL(e->w); DeleteFileW(path);
    if (!hw || gpu_only) { cap_close(c); return FALSE; }
    return enc_open(e, path, c, a, FALSE, NULL) && enc_frame(e, c, 0, 10000000 / c->fps);
}

/* siqgich ochilguncha to'plangan ovozni tashlaymiz - aks holda ovoz tasvirdan oldinda bo'ladi */
static void aud_drain(Aud *a)
{
    UINT32 n = 0;
    for (; a->cc && SUCCEEDED(IAudioCaptureClient_GetNextPacketSize(a->cc, &n)) && n; ) {
        BYTE *d; UINT32 fr; DWORD fl;
        if (FAILED(IAudioCaptureClient_GetBuffer(a->cc, &d, &fr, &fl, NULL, NULL))) break;
        IAudioCaptureClient_ReleaseBuffer(a->cc, fr);
    }
    if (a->mcc) { mic_pump(a); a->mcount = 0; }
}

/* Videolar\X CLIENT\xc_YYYYMMDD_HHMMSS.mp4 (shu soniyada fayl bo'lsa - keyingi soniya) */
static BOOL vid_newpath(wchar_t *path)
{
    wchar_t dir[MAX_PATH];
    if (!vid_dir(dir)) return FALSE;
    for (int i = 0; i < 5; i++) {
        SYSTEMTIME st; GetLocalTime(&st);
        _snwprintf(path, MAX_PATH, L"%s\\xc_%04u%02u%02u_%02u%02u%02u.mp4", dir, st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
        path[MAX_PATH - 1] = 0;
        if (GetFileAttributesW(path) == INVALID_FILE_ATTRIBUTES) return TRUE;
        Sleep(1000);
    }
    return FALSE;
}

/* menyudagi "Videolarim" ro'yxatiga */
static void vid_report(const wchar_t *path, unsigned sec)
{
    WIN32_FILE_ATTRIBUTE_DATA fa; char url[300], nm[24] = "";
    const wchar_t *b = wcsrchr(path, L'\\');
    if (b) WideCharToMultiByte(CP_UTF8, 0, b + 1, 18, nm, 19, NULL, NULL);
    nm[18] = 0;
    ULONGLONG mb = GetFileAttributesExW(path, GetFileExInfoStandard, &fa) ? ((((ULONGLONG)fa.nFileSizeHigh << 32) | fa.nFileSizeLow) + 524288) / 1048576 : 0;
    if (!vid_name_ok(nm)) return;
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=vadd&d=%s&n=%s&mb=%u&sec=%u&q=%s", g_id, nm, (unsigned)mb, sec, g_vq == 2 ? "hi" : g_vq ? "mid" : "low");
    url[sizeof(url) - 1] = 0;
    free(http_get(url, NULL));
}

/* ---- "oxirgi 30 soniya" buferi: o'yin davomida videokartada 10 soniyalik bo'laklar (vaqtinchalik papkada, eng ko'pi 6 ta).
 *      F9 (yoki menyudagi avtomatik klip) - oxirgi bo'laklar qayta siqilmasdan bitta MP4 ga. F10 bosilganda bufer to'xtaydi. ---- */
#define BUF_SEGS 6
#define BUF_SEG_SEC 10
#define CLIP_SEC 30
static volatile LONG g_buf_run = 0, g_clip_req = 0, g_clip_busy = 0;
static HANDLE g_buf_th = NULL;
static BOOL g_buf_want = FALSE;
static wchar_t g_buf_dir[MAX_PATH] = L"";

typedef struct { wchar_t src[BUF_SEGS][MAX_PATH]; int n; } ClipJob;
static DWORD WINAPI clip_thread(LPVOID p)
{
    ClipJob *j = (ClipJob *)p;
    wchar_t out[MAX_PATH]; const wchar_t *v[BUF_SEGS]; LONGLONG dur = 0; BOOL ok = FALSE;
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (SUCCEEDED(rf.MFStartup(0x00020070, 0))) {
        for (int i = 0; i < j->n; i++) v[i] = j->src[i];
        if (vid_newpath(out)) ok = remux(v, j->n, out, 0, 0, &dur);
        rf.MFShutdown();
    }
    if (ok) { vid_report(out, (unsigned)(dur / 10000000)); lstrcpynW(g_rec_last, out, MAX_PATH); g_rec_saved++; PostThreadMessageW(g_hk_tid, WM_REC_STATE, 4, 0); rec_beep(0); }
    else { PostThreadMessageW(g_hk_tid, WM_REC_STATE, 3, 0); rec_beep(-1); }
    CoUninitialize();
    free(j);
    InterlockedDecrement(&g_clip_busy);
    return 0;
}

static DWORD WINAPI buf_thread(LPVOID unused)
{
    (void)unused;
    Cap c; Aud a; Enc e;
    ZeroMemory(&c, sizeof(c)); ZeroMemory(&a, sizeof(a)); ZeroMemory(&e, sizeof(e));
    IMFDXGIDeviceManager *mgr = NULL;
    wchar_t seg[BUF_SEGS][MAX_PATH]; LONGLONG sdur[BUF_SEGS]; BOOL sok[BUF_SEGS];
    int ci = 0; BOOL mf = FALSE, restart = FALSE;
    ZeroMemory(sdur, sizeof(sdur)); ZeroMemory(sok, sizeof(sok));
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (!rec_load() || FAILED(rf.MFStartup(0x00020070, 0))) { g_buf_want = FALSE; goto done; }
    mf = TRUE;
    if (!GetTempPathW(MAX_PATH - 20, g_buf_dir)) goto done;
    wcscat(g_buf_dir, L"XClientBuf");
    CreateDirectoryW(g_buf_dir, NULL);
    for (int i = 0; i < BUF_SEGS; i++) { _snwprintf(seg[i], MAX_PATH, L"%s\\s%d.mp4", g_buf_dir, i); seg[i][MAX_PATH - 1] = 0; }
    aud_open(&a);
    if (g_mic) mic_open(&a);
    if (!rec_begin(&c, &a, &e, seg[0], &mgr, TRUE)) {   /* videokarta siqgichi yo'q yoki o'yin hali to'liq ochilmagan - birozdan keyin yana */
        if (++g_buf_fail < 4) PostThreadMessageW(g_hk_tid, WM_REC_STATE, 102, 0);
        goto done;
    }
    g_buf_fail = 0;
    aud_drain(&a);
    LARGE_INTEGER f, t0, now;
    QueryPerformanceFrequency(&f); QueryPerformanceCounter(&t0);
    const LONGLONG fdur = 10000000 / c.fps;
    ULONGLONG k = 1;
    while (g_buf_run) {
        QueryPerformanceCounter(&now);
        ULONGLONG el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);
        LONG clip = InterlockedExchange(&g_clip_req, 0);
        if (clip || el >= (ULONGLONG)BUF_SEG_SEC * 10000000ULL) {
            BOOL fin = SUCCEEDED(IMFSinkWriter_Finalize(e.w)); SREL(e.w);
            sdur[ci] = (LONGLONG)(k * fdur); sok[ci] = fin;
            if (clip) {                                    /* oxirgi ~30 soniya: eng yangi bo'lakdan orqaga */
                int idx[BUF_SEGS], m = 0; LONGLONG tot = 0;
                for (int b = 0; b < BUF_SEGS && tot < (LONGLONG)CLIP_SEC * 10000000; b++) {
                    int s2 = (ci - b + BUF_SEGS) % BUF_SEGS;
                    if (!sok[s2]) break;
                    idx[m++] = s2; tot += sdur[s2];
                }
                ClipJob *j = m ? (ClipJob *)calloc(1, sizeof(ClipJob)) : NULL;
                if (j) {
                    for (int q = 0; q < m; q++) lstrcpynW(j->src[q], seg[idx[m - 1 - q]], MAX_PATH);
                    j->n = m;
                    InterlockedIncrement(&g_clip_busy);
                    HANDLE th = CreateThread(NULL, 0, clip_thread, j, 0, NULL);
                    if (th) CloseHandle(th); else { InterlockedDecrement(&g_clip_busy); free(j); }
                }
            }
            ci = (ci + 1) % BUF_SEGS; sok[ci] = FALSE;
            if (!enc_open(&e, seg[ci], &c, &a, TRUE, mgr) || !enc_frame(&e, &c, 0, fdur)) break;
            QueryPerformanceCounter(&t0); k = 1; a.written = 0;
            continue;
        }
        if (el >= k * fdur) {
            cap_grab(&c, 0);
            if (c.sizechg) { restart = TRUE; break; }       /* o'yin o'lchamini almashtirdi - qaytadan */
            if (el > (k + c.fps) * fdur) k = el / fdur;
            if (!enc_frame(&e, &c, (LONGLONG)(k * fdur), fdur)) { restart = TRUE; break; }
            k++;
        }
        if (a.cc) aud_pump(&a, &e, el * a.out_rate / 10000000ULL);
        QueryPerformanceCounter(&now);
        el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);
        if (k * fdur > el + 20000) Sleep((DWORD)((k * fdur - el) / 10000 > 15 ? 15 : (k * fdur - el) / 10000));
    }
done:
    if (e.w) { IMFSinkWriter_Finalize(e.w); SREL(e.w); }
    SREL(mgr);
    aud_close(&a); cap_close(&c);
    if (mf) rf.MFShutdown();
    CoUninitialize();
    InterlockedExchange(&g_buf_run, 0);
    if (restart && g_buf_want) PostThreadMessageW(g_hk_tid, WM_REC_STATE, 101, 0);
    return 0;
}

static void buf_start(void)
{
    if (!g_buf_want || g_buf_run || g_rec_run) return;
    if (g_buf_th) { if (WaitForSingleObject(g_buf_th, 0) != WAIT_OBJECT_0) return; CloseHandle(g_buf_th); g_buf_th = NULL; }
    InterlockedExchange(&g_buf_run, 1);
    g_buf_th = CreateThread(NULL, 0, buf_thread, NULL, 0, NULL);
    if (!g_buf_th) InterlockedExchange(&g_buf_run, 0);
}

static void buf_stop(void)
{
    InterlockedExchange(&g_buf_run, 0);
    if (g_buf_th) { WaitForSingleObject(g_buf_th, 8000); CloseHandle(g_buf_th); g_buf_th = NULL; }
}

/* ---- F10: to'liq yozish (bufer shu vaqtda to'xtaydi, keyin yana ishga tushadi) ---- */
static DWORD WINAPI rec_thread(LPVOID unused)
{
    (void)unused;
    Cap c; Aud a; Enc e;
    ZeroMemory(&c, sizeof(c)); ZeroMemory(&a, sizeof(a)); ZeroMemory(&e, sizeof(e));
    wchar_t path[MAX_PATH] = L"";
    BOOL mf = FALSE, ok = FALSE;
    IMFDXGIDeviceManager *mgr = NULL;   /* videokarta yo'li: yozuvchi yopilguncha yashashi kerak */
    ULONGLONG k = 0;                   /* yozilgan kadrlar - davomiylik uchun */
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (!rec_load() || FAILED(rf.MFStartup(0x00020070 /* MF_VERSION */, 0))) goto done;
    mf = TRUE;
    rec_quality();
    if (!vid_newpath(path)) goto done;
    aud_open(&a);                       /* ovoz bo'lmasa ham video yoziladi */
    if (g_mic) mic_open(&a);
    /* 1) videokarta yo'li: kadr videokarta xotirasidan chiqmaydi - o'yin FPS iga ta'sir qilmaydi.
     * 2) bo'lmasa (eski videokarta/drayver, Windows 7, "Kichik" sifat) - protsessor yo'li: 30 kadr, kichraytirish bilan. */
    if (!rec_begin(&c, &a, &e, path, &mgr, FALSE)) goto done;
    rec_beep(1);                       /* ovoz signali videoga tushmasin - undan keyin to'plangan ovoz tashlanadi */
    aud_drain(&a);
    ok = TRUE;
    PostThreadMessageW(g_hk_tid, WM_REC_STATE, 1, 0);   /* ekranda REC */

    LARGE_INTEGER f, t0, now;
    QueryPerformanceFrequency(&f); QueryPerformanceCounter(&t0);
    const LONGLONG fdur = 10000000 / c.fps;
    k = 1;                             /* 0-kadr yuqorida yozildi */
    while (g_rec_run) {
        QueryPerformanceCounter(&now);
        ULONGLONG el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);   /* 100 ns */
        if (el >= (ULONGLONG)REC_MAX_SEC * 10000000ULL) break;
        if (el >= k * fdur) {
            cap_grab(&c, 0);
            if (c.sizechg) break;                               /* o'yin o'lchami o'zgardi - shu joygacha saqlanadi */
            if (el > (k + c.fps) * fdur) k = el / fdur;         /* kompyuter qotib qolgan bo'lsa - kadrlarni to'plamasdan davom etamiz */
            if (!enc_frame(&e, &c, (LONGLONG)(k * fdur), fdur)) break;
            k++;
        }
        if (a.cc) aud_pump(&a, &e, el * a.out_rate / 10000000ULL);
        QueryPerformanceCounter(&now);
        el = (ULONGLONG)((now.QuadPart - t0.QuadPart) * 10000000.0 / f.QuadPart);
        if (k * fdur > el + 20000) Sleep((DWORD)((k * fdur - el) / 10000 > 15 ? 15 : (k * fdur - el) / 10000));
    }
done:
    if (e.w) { if (FAILED(IMFSinkWriter_Finalize(e.w))) ok = FALSE; SREL(e.w); }
    SREL(mgr);
    aud_close(&a); cap_close(&c);
    if (mf) rf.MFShutdown();
    CoUninitialize();
    InterlockedExchange(&g_rec_run, 0);
    if (ok) { vid_report(path, (unsigned)(k / (c.fps ? c.fps : 30))); lstrcpynW(g_rec_last, path, MAX_PATH); g_rec_saved++; PostThreadMessageW(g_hk_tid, WM_REC_STATE, 2, 0); rec_beep(0); }
    else { if (path[0]) DeleteFileW(path); PostThreadMessageW(g_hk_tid, WM_REC_STATE, 3, 0); rec_beep(-1); }
    if (g_buf_want) PostThreadMessageW(g_hk_tid, WM_REC_STATE, 101, 0);   /* bufer qayta */
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
    buf_stop();                                                         /* bitta ekran - bitta yozuvchi */
    InterlockedExchange(&g_rec_run, 1);
    g_rec_th = CreateThread(NULL, 0, rec_thread, NULL, 0, NULL);
    if (!g_rec_th) InterlockedExchange(&g_rec_run, 0);
}

/* F10 - yozish, F9 - oxirgi 30 soniya. RegisterHotKey (klaviatura kuzatuvchisi emas) - faqat o'yin oynasi oldinda bo'lsa ishlaydi.
 * Tugmalar o'yinga bormaydi. */
static HANDLE g_hk_th = NULL;

static DWORD WINAPI rec_hotkey_thread(LPVOID unused)
{
    (void)unused;
    MSG m;
    PeekMessageW(&m, NULL, WM_USER, WM_USER, PM_NOREMOVE);              /* navbat yaratilsin */
    BOOL reg = RegisterHotKey(NULL, 0xC10, 0x4000 /* MOD_NOREPEAT */, REC_HOTKEY);
    BOOL reg9 = RegisterHotKey(NULL, 0xC09, 0x4000, VK_F9);
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    rec_quality();                                                      /* bufer yoqilganmi (menyu > Demo) */
    g_buf_want = g_rb; g_buf_fail = 0;
    SetTimer(NULL, 0, 8000, NULL);                                      /* o'yin ochilib, to'liq ekranga o'tgach - bufer */
    while (GetMessageW(&m, NULL, 0, 0) > 0) {
        if (m.hwnd) { TranslateMessage(&m); DispatchMessageW(&m); continue; }   /* ekrandagi belgi oynasi */
        if (m.message == WM_TIMER) { KillTimer(NULL, m.wParam); buf_start(); continue; }
        if (m.message == WM_REC_STATE) {
            if (m.wParam == 100) buf_start();
            else if (m.wParam == 101) SetTimer(NULL, 0, 3000, NULL);
            else if (m.wParam == 102) SetTimer(NULL, 0, 15000, NULL);   /* bufer ochilmadi - 15 soniyadan keyin yana */
            else ov_show((int)m.wParam);
            continue;
        }
        if (m.message == WM_HOTKEY) {
            HWND fg = GetForegroundWindow(); DWORD pid = 0;
            GetWindowThreadProcessId(fg, &pid);
            if (pid != g_game_pid) continue;
            if (!g_rec_wnd) g_rec_wnd = fg;
            if (m.wParam == 0xC10) rec_toggle(fg);
            else if (m.wParam == 0xC09) {
                if (g_buf_run) { InterlockedExchange(&g_clip_req, 1); Beep(1400, 60); }
                else if (!g_rec_run) ov_show(!g_rb ? 5 : g_buf_fail >= 4 ? 7 : 8);   /* yoqilgan, lekin bu kompyuterda ishlamadi / o'chirilgan */
            }
        }
    }
    if (reg) UnregisterHotKey(NULL, 0xC10);
    if (reg9) UnregisterHotKey(NULL, 0xC09);
    ov_close();
    CoUninitialize();
    return 0;
}

/* o'yin oynasi (shu jarayonning eng katta ko'rinadigan oynasi) */
typedef struct { DWORD pid; HWND best; LONG area; } GameFind;
static BOOL CALLBACK game_enum(HWND h, LPARAM l)
{
    GameFind *g = (GameFind *)l; DWORD pid = 0; RECT r;
    GetWindowThreadProcessId(h, &pid);
    if (pid == g->pid && IsWindowVisible(h) && GetWindowRect(h, &r)) {
        LONG a = (r.right - r.left) * (r.bottom - r.top);
        if (a > g->area) { g->area = a; g->best = h; }
    }
    return TRUE;
}
static HWND game_window(void)
{
    GameFind g = { g_game_pid, NULL, 0 };
    if (!g.pid) return NULL;
    EnumWindows(game_enum, (LPARAM)&g);
    return g.best;
}
/* oynani oldinga: Windows boshqa dasturga oldinga chiqishni man qiladi - qisqa "eng ustida" + kirish navbatini ulash */
static void win_to_front(HWND w)
{
    HWND fg = GetForegroundWindow();
    DWORD me = GetCurrentThreadId(), ft = fg ? GetWindowThreadProcessId(fg, NULL) : 0;
    if (ft && ft != me) AttachThreadInput(ft, me, TRUE);
    SetWindowPos(w, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    SetWindowPos(w, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    BringWindowToTop(w); SetForegroundWindow(w); SetActiveWindow(w);
    if (ft && ft != me) AttachThreadInput(ft, me, FALSE);
}
/* menyudan video/papka ochilganda: o'yin yig'iladi, ochilgan dastur oldinga chiqa oladi */
static void game_minimize_for_shell(void)
{
    HWND g = game_window();
    if (g) ShowWindowAsync(g, SW_MINIMIZE);
    AllowSetForegroundWindow(ASFW_ANY);
    Sleep(300);
}

#include "xc_edit.c"   /* video muharriri (menyu > Demo > ✂) */

/* o'yin paytida menyudagi "Videolarim" tugmalari: sayt navbatidan buyruqlarni olib bajaradi (har 4 soniya) */
static HANDLE g_vp_th = NULL, g_vp_stop = NULL;
/* ---- klipni ulashish: saytga 900 KB lik bo'laklar bilan (ko'p hostinglarda so'rov chegarasi 1 MB; uzilsa - shu joydan davom) ---- */
#define SHARE_CHUNK (900 * 1024)
static volatile LONG g_share_busy = 0;
typedef struct { wchar_t f[MAX_PATH]; char tk[40]; } ShareJob;
static char *share_post(const char *path, const void *data, DWORD len)
{
    for (int sec = g_https_bad ? 0 : 1; sec >= 0; sec--) {
        HINTERNET c = InternetConnectA(g_net, "mmb.boost-top.com", sec ? INTERNET_DEFAULT_HTTPS_PORT : INTERNET_DEFAULT_HTTP_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
        if (!c) continue;
        HINTERNET r = HttpOpenRequestA(c, "POST", path, NULL, NULL, NULL, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_UI | (sec ? INTERNET_FLAG_SECURE : 0), 0);
        char *out = NULL;
        if (r && HttpSendRequestA(r, "Content-Type: application/octet-stream\r\n", (DWORD)-1L, (LPVOID)data, len)) {
            out = (char *)calloc(1, 257);
            DWORD got, n = 0;
            while (out && n < 256 && InternetReadFile(r, out + n, 256 - n, &got) && got) n += got;
        }
        if (r) InternetCloseHandle(r);
        InternetCloseHandle(c);
        if (out) return out;
        if (sec) g_https_bad = TRUE;
    }
    return NULL;
}
static DWORD WINAPI share_thread(LPVOID arg)
{
    ShareJob *j = (ShareJob *)arg;
    BOOL ok = FALSE;
    HANDLE h = CreateFileW(j->f, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_DELETE, NULL, OPEN_EXISTING, 0, NULL);
    BYTE *buf = (BYTE *)malloc(SHARE_CHUNK);
    LARGE_INTEGER sz; sz.QuadPart = 0;
    if (h != INVALID_HANDLE_VALUE && buf && GetFileSizeEx(h, &sz) && sz.QuadPart > 0 && sz.QuadPart <= 60LL * 1024 * 1024) {
        LONGLONG off = 0; int fails = 0, guard = 0;
        while (off < sz.QuadPart && fails < 5 && guard++ < 400) {   /* 60 MB / 900 KB = 69 bo'lak - qayta yuborishlar bilan ham yetadi */
            LARGE_INTEGER pos; pos.QuadPart = off;
            DWORD want = (DWORD)(sz.QuadPart - off > SHARE_CHUNK ? SHARE_CHUNK : sz.QuadPart - off), got = 0;
            if (!SetFilePointerEx(h, pos, NULL, FILE_BEGIN) || !ReadFile(h, buf, want, &got, NULL) || got != want) break;
            char path[200];
            _snprintf(path, sizeof(path), "/xc_api.php?a=clipup&tk=%s&off=%lld&tot=%lld", j->tk, off, sz.QuadPart); path[sizeof(path) - 1] = 0;
            char *r = share_post(path, buf, got);
            long long n = -1;
            if (r && (sscanf(r, "ok %lld", &n) == 1 || sscanf(r, "off %lld", &n) == 1) && n >= 0 && n <= sz.QuadPart) { off = n; fails = 0; }
            else if (r && (!strncmp(r, "gone", 4) || !strncmp(r, "big", 3))) { free(r); break; }
            else { fails++; Sleep(2000 * fails); }
            free(r);
        }
        if (off == sz.QuadPart) {
            char path[160];
            _snprintf(path, sizeof(path), "/xc_api.php?a=clipdone&tk=%s", j->tk); path[sizeof(path) - 1] = 0;
            for (int i = 0; i < 3 && !ok; i++) { char *r = share_post(path, "", 0); ok = r && !strncmp(r, "ok ", 3); if (r && !strncmp(r, "bad", 3)) i = 3; free(r); if (!ok) Sleep(2000); }
        }
    }
    if (h != INVALID_HANDLE_VALUE) CloseHandle(h);
    free(buf); free(j);
    if (g_hk_tid) PostThreadMessageW(g_hk_tid, WM_REC_STATE, ok ? 9 : 10, 0);
    InterlockedDecrement(&g_share_busy);
    return 0;
}

static void vid_exec(const char *line)
{
    char c[8] = "", n[24] = "", tk[40] = ""; int fa = 0, fb = 0;
    if (sscanf(line, "%7s %23s %d %d", c, n, &fa, &fb) < 1) return;
    if (!strcmp(c, "share")) sscanf(line, "%*s %*s %39s", tk);
    if (!strcmp(c, "clip")) { if (g_buf_run) InterlockedExchange(&g_clip_req, 1); return; }   /* menyu: avtomatik klip (3+ kill) */
    if (!strcmp(c, "opt")) {                           /* menyuda bufer/mikrofon o'zgardi */
        rec_quality(); g_buf_want = g_rb;
        if (!g_rb) buf_stop(); else PostThreadMessageW(g_hk_tid, WM_REC_STATE, 100, 0);
        return;
    }
    wchar_t dir[MAX_PATH], f[MAX_PATH], wn[24];
    if (!vid_dir(dir)) return;
    if (!strcmp(c, "folder")) { game_minimize_for_shell(); ShellExecuteW(NULL, L"open", dir, NULL, NULL, SW_SHOWNORMAL); return; }
    if (!vid_name_ok(n)) return;                       /* faqat o'zimiz yozgan nomlar - boshqa fayllarga tegilmaydi */
    MultiByteToWideChar(CP_UTF8, 0, n, -1, wn, 24);
    _snwprintf(f, MAX_PATH - 2, L"%s\\%s.mp4", dir, wn); f[MAX_PATH - 3] = 0;
    if (GetFileAttributesW(f) == INVALID_FILE_ATTRIBUTES) return;
    if (!strcmp(c, "open")) { game_minimize_for_shell(); ShellExecuteW(NULL, L"open", f, NULL, NULL, SW_SHOWNORMAL); }
    else if (!strcmp(c, "edit")) editor_open(f);
    else if (!strcmp(c, "share") && strlen(tk) == 32 && strspn(tk, "0123456789abcdef") == 32) {
        ShareJob *j = (ShareJob *)calloc(1, sizeof(ShareJob));
        if (!j) return;
        lstrcpynW(j->f, f, MAX_PATH); lstrcpynA(j->tk, tk, sizeof(j->tk));
        InterlockedIncrement(&g_share_busy);
        HANDLE th = CreateThread(NULL, 0, share_thread, j, 0, NULL);
        if (th) CloseHandle(th); else { InterlockedDecrement(&g_share_busy); free(j); }
    }
    else if (!strcmp(c, "del")) {                      /* Savatga - adashib o'chirilsa qaytarish mumkin */
        size_t L = wcslen(f); f[L + 1] = 0;
        SHFILEOPSTRUCTW op = { 0 }; op.wFunc = FO_DELETE; op.pFrom = f;
        op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI;
        SHFileOperationW(&op);
    }
    else if (!strcmp(c, "trim") && fb > fa && fa >= 0) {   /* kesish: yangi fayl, asli qoladi */
        wchar_t out[MAX_PATH]; const wchar_t *src[1] = { f }; LONGLONG dur = 0;
        if (!rec_load() || FAILED(rf.MFStartup(0x00020070, 0))) return;
        BOOL ok = vid_newpath(out) && remux(src, 1, out, (LONGLONG)fa * 10000000, (LONGLONG)fb * 10000000, &dur);
        rf.MFShutdown();
        if (ok) { vid_report(out, (unsigned)(dur / 10000000)); PostThreadMessageW(g_hk_tid, WM_REC_STATE, 6, 0); }
        else PostThreadMessageW(g_hk_tid, WM_REC_STATE, 3, 0);
    }
}
static DWORD WINAPI vid_poll_thread(LPVOID unused)
{
    (void)unused;
    char url[200];
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=vpoll&d=%s", g_id); url[sizeof(url) - 1] = 0;
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    while (WaitForSingleObject(g_vp_stop, 4000) == WAIT_TIMEOUT) {
        char *r = http_get(url, NULL);
        if (!r) continue;
        for (char *ctx = NULL, *ln = strtok_s(r, "\r\n", &ctx); ln; ln = strtok_s(NULL, "\r\n", &ctx)) vid_exec(ln);
        free(r);
    }
    CoUninitialize();
    return 0;
}

static void rec_session_begin(DWORD game_pid)
{
    g_vp_stop = CreateEventW(NULL, TRUE, FALSE, NULL);
    if (g_vp_stop) g_vp_th = CreateThread(NULL, 0, vid_poll_thread, NULL, 0, NULL);
    g_game_pid = game_pid; g_rec_saved = 0; g_rec_last[0] = 0; g_rec_wnd = NULL;
    g_hk_th = CreateThread(NULL, 0, rec_hotkey_thread, NULL, 0, &g_hk_tid);
}

/* o'yin yopildi: yozilayotgan bo'lsa saqlaymiz; yangi video bo'lsa papkani ochib, faylni belgilaymiz */
static void rec_session_end(void)
{
    if (g_vp_th) { SetEvent(g_vp_stop); WaitForSingleObject(g_vp_th, 15000); CloseHandle(g_vp_th); g_vp_th = NULL; }
    if (g_vp_stop) { CloseHandle(g_vp_stop); g_vp_stop = NULL; }
    g_buf_want = FALSE;
    buf_stop();
    InterlockedExchange(&g_rec_run, 0);
    if (g_rec_th) { WaitForSingleObject(g_rec_th, 30000); CloseHandle(g_rec_th); g_rec_th = NULL; }
    for (int i = 0; i < 300 && g_clip_busy > 0; i++) Sleep(100);        /* klip birlashtirilayotgan bo'lsa - kutamiz */
    for (int i = 0; i < 6000 && g_share_busy > 0; i++) Sleep(100);      /* klip saytga yuklanayotgan bo'lsa - 10 daqiqagacha */
    if (g_hk_th) { PostThreadMessageW(g_hk_tid, WM_QUIT, 0, 0); WaitForSingleObject(g_hk_th, 3000); CloseHandle(g_hk_th); g_hk_th = NULL; }
    if (g_buf_dir[0]) {                                                  /* vaqtinchalik bo'laklar */
        for (int i = 0; i < BUF_SEGS; i++) { wchar_t p[MAX_PATH]; _snwprintf(p, MAX_PATH, L"%s\\s%d.mp4", g_buf_dir, i); p[MAX_PATH - 1] = 0; DeleteFileW(p); }
        RemoveDirectoryW(g_buf_dir);
    }
    if (g_rec_saved && g_rec_last[0]) {
        wchar_t args[MAX_PATH + 16];
        _snwprintf(args, MAX_PATH + 16, L"/select,\"%s\"", g_rec_last); args[MAX_PATH + 15] = 0;
        ShellExecuteW(NULL, L"open", L"explorer.exe", args, NULL, SW_SHOWNORMAL);
    }
}
