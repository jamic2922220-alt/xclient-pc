/* =====================================================================
 *  X CLIENT — ishga tushiruvchi (launcher) va avto-yangilovchi
 *
 *  1) Birinchi marta ("X CLIENT Setup.exe"): C:\Games\XClient ga o'rnatadi,
 *     ish stolida yorliq yaratadi, serverga "install" yuboradi.
 *  2) Har ishga tushganda: serverdan eng yangi versiyani so'raydi (vetka:
 *     stable/beta), o'zgargan fayllarnigina yuklab oladi (SHA-256 bilan
 *     tekshiriladi), "launch" yuboradi va o'yinni ochadi.
 *  3) X CLIENT dizaynini (xc_theme papkasi) o'yin papkasiga qo'yadi va
 *     cstrike.exe ni TO'G'RIDAN-TO'G'RI ochadi — alohida oyna yo'q,
 *     hamma narsa (menyu, serverlar, sozlamalar) o'yinning o'zida.
 *  4) Internet bo'lmasa — o'yin baribir ochiladi.
 *
 *  Kalit va vetka: .exe oxiriga yozilgan "XCKEY:kalit|vetka" (sayt qo'shadi)
 *  yoki o'rnatilgandan keyin xclient.ini dan olinadi.
 *  Windows XP SP3 / 7 / 8 / 10 / 11, 32-bit.
 * ===================================================================== */
#define WIN32_LEAN_AND_MEAN
#define _CRT_SECURE_NO_WARNINGS
#include <windows.h>
#include "xc_ver.h"     /* XC_VERSTR - exe versiyasi */
#include <wininet.h>
#include <wincrypt.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <objbase.h>
#include <shobjidl.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef XC_API
#define XC_API "http://mmb.boost-top.com/xclient/api.php"   /* admin.php > Yangilanishlar */
#endif
#ifndef XC_GAME_URL
/* asl PC CS 1.6 (boost-top PRO) o'rnatuvchisi - o'yin yo'q bo'lsa shundan o'rnatiladi; panel "game=" bilan almashtirishi mumkin */
#define XC_GAME_URL "https://cssborka.uz/uploads/files/1791198609_6ac38591b615c_CS_1_6_boost-top_PRO_2_5_3.exe"
#endif
/* 1. zaxira manzil: cssborka.uz ishlamasa yoki juda sekin bo'lsa (GitHub Releases, Range qo'llaydi) */
#define XC_GAME_MIRROR "https://github.com/jamic2922220-alt/xclient-pc/releases/download/cs16/CS_1_6_boost-top_PRO_2_5_3.exe"
#define XC_GAME_SIZE 238932805ULL   /* CS_1_6_boost-top_PRO_2_5_3.exe aniq hajmi (ikkala manzilda bir xil). Chala yuklansa - o'rnatuvchi "buzilgan" (inno=1) */
#define XC_VERSION_FILE L"xclient_version.txt"
/* Launcher fayli nomi. Eski nomi "XClient.exe" ba'zi server himoyalarida (Vanga/ReChecker) 5 yil oldingi
 * shu nomli cheat sifatida ro'yxatda turibdi - o'yin papkasida bu nomdagi fayl qolmasligi kerak. */
#define XC_EXE        L"XCLauncher.exe"
#define XC_EXE_LEGACY L"XClient.exe"
#define WM_XC_STATUS (WM_APP + 1)
#define WM_XC_DONE   (WM_APP + 2)

static HANDLE  g_one = NULL;            /* bitta nusxa mutexi: o'yin ishga tushgach (yoki qayta ishga tushishdan oldin) bo'shatiladi */
static wchar_t g_dir[MAX_PATH];        /* klient papkasi */
static wchar_t g_self[MAX_PATH];       /* shu exe */
static char    g_key[64]   = "";
static char    g_chan[16]  = "stable";
static char    g_id[48]    = "";
static int     g_build     = 0;        /* o'rnatilgan build */
static char    g_version[32] = "";
static char    g_os[48]    = "Windows";
static HWND    g_wnd, g_txt, g_bar;
static wchar_t g_status[256] = L"X CLIENT ishga tushmoqda...";
static int     g_pct = 0;
static HINTERNET g_net;

/* ---------------------------------------------------------------- yordamchi */
static void status(const wchar_t *s, int pct)
{
    lstrcpynW(g_status, s, 256);
    if (pct >= 0) g_pct = pct;
    if (g_wnd) PostMessageW(g_wnd, WM_XC_STATUS, 0, 0);
}

static void path_join(wchar_t *out, const wchar_t *a, const wchar_t *b)
{
    _snwprintf(out, MAX_PATH, L"%s\\%s", a, b);
    out[MAX_PATH - 1] = 0;
    for (wchar_t *p = out; *p; p++) if (*p == L'/') *p = L'\\';
}

static void mkdirs_for(const wchar_t *file)
{
    wchar_t tmp[MAX_PATH];
    lstrcpynW(tmp, file, MAX_PATH);
    for (wchar_t *p = tmp + 3; *p; p++) {
        if (*p == L'\\') { *p = 0; CreateDirectoryW(tmp, NULL); *p = L'\\'; }
    }
}

static void url_escape(char *out, size_t cap, const char *in)
{
    static const char hx[] = "0123456789ABCDEF";
    size_t o = 0;
    for (; *in && o + 4 < cap; in++) {
        unsigned char c = (unsigned char)*in;
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || strchr("-_.~/", c))
            out[o++] = (char)c;
        else { out[o++] = '%'; out[o++] = hx[c >> 4]; out[o++] = hx[c & 15]; }
    }
    out[o] = 0;
}

/* ---------------------------------------------------------------- HTTP */
/* Sekin/uzilib-ulanayotgan internet: o'yin ochilishidan oldingi tarmoq ishlari (sozlamalar, yangilanish, serverlar ro'yxati)
 * shu muddatdan keyin darhol "internet yo'q" deb o'tkazib yuboriladi - launcher "Yangilanish tekshirilmoqda" da qotib turmaydi,
 * o'yin bor fayllar bilan ochiladi. 0 - cheklov yo'q (yangilanishni yuklash, o'yin yopilgandan keyingi ishlar) */
static wchar_t g_err[256];                         /* launcher yopilishida ko'rsatiladigan xato (pastda ham e'lon qilingan) */
static void prob_send(const char *kind, DWORD wait);   /* admin panel > Muammolar (pastda) */
static void fn_send(const char *stage);   /* admin panel > Voronka: birinchi ochilish bosqichlari (har bosqich bir marta) */
static char g_probx[1800];
static DWORD g_played_s = 0;
static char g_cmod[64];   /* oxirgi yiqilishda aybdor modul (aqlli tuzatish uchun), bo'lmasa bo'sh */   /* oxirgi o'yin necha soniya davom etdi (muammo hisobotiga) */   /* prob_send uchun qo'shimcha tafsilot (url-escape qilingan), bo'lmasa bo'sh */
static volatile DWORD g_net_dl = 0;
static volatile LONG g_probe_ok = 0;
static HINTERNET open_url_raw(const char *url)
{
    if (g_net_dl && (LONG)(GetTickCount() - g_net_dl) > 0) return NULL;
    DWORD fl = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_UI | INTERNET_FLAG_KEEP_CONNECTION;
    if (!_strnicmp(url, "https://", 8)) fl |= INTERNET_FLAG_SECURE;
    HINTERNET h = InternetOpenUrlA(g_net, url, NULL, 0, fl, 0);
    if (!h) return NULL;
    DWORD code = 0, len = sizeof(code);
    if (HttpQueryInfoA(h, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &code, &len, NULL) && code != 200) {
        InternetCloseHandle(h);
        return NULL;
    }
    return h;
}

/* O'z saytimizga so'rovlar avval https bilan (internet-kafe, provayder tarmog'ida o'qib/o'zgartirib bo'lmasin).
 * Ishlamasa (Windows 7 da TLS 1.2 yo'q, sertifikat muammosi) - shu ishga tushish davomida http. Sertifikat tekshiruvi o'chirilmaydi. */
static BOOL g_https_bad = FALSE;
static HINTERNET open_url(const char *url)
{
    static const char own[] = "http://mmb.boost-top.com/";
    if (!g_https_bad && !_strnicmp(url, own, sizeof(own) - 1) && strlen(url) < 8000) {
        char su[8200];
        _snprintf(su, sizeof(su), "https://%s", url + 7); su[sizeof(su) - 1] = 0;
        HINTERNET h = open_url_raw(su);
        if (h) return h;
        g_https_bad = TRUE;
    }
    return open_url_raw(url);
}

/* kichik javob (API, manifest) -> malloc'langan satr */
static char *http_get(const char *url, DWORD *outLen)
{
    HINTERNET h = open_url(url);
    if (!h) return NULL;
    size_t cap = 65536, n = 0;
    char *buf = (char *)malloc(cap + 1);
    DWORD got;
    while (buf && InternetReadFile(h, buf + n, (DWORD)(cap - n), &got) && got) {
        n += got;
        if (n == cap) {
            if (cap > 32u * 1024 * 1024) break;
            char *nb = (char *)realloc(buf, cap * 2 + 1);
            if (!nb) { free(buf); buf = NULL; break; }
            buf = nb; cap *= 2;
        }
    }
    InternetCloseHandle(h);
    if (!buf) return NULL;
    buf[n] = 0;
    if (outLen) *outLen = (DWORD)n;
    return buf;
}

/* katta faylni diskka yuklash */
static BOOL http_download(const char *url, const wchar_t *dst)
{
    HINTERNET h = open_url(url);
    if (!h) return FALSE;
    HANDLE f = CreateFileW(dst, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { InternetCloseHandle(h); return FALSE; }
    static char buf[65536];
    DWORD got, wr;
    BOOL ok = TRUE;
    for (;;) {
        if (!InternetReadFile(h, buf, sizeof(buf), &got)) { ok = FALSE; break; }   /* uzilish - fayl chala, muvaffaqiyat emas */
        if (!got) break;
        if (!WriteFile(f, buf, got, &wr, NULL) || wr != got) { ok = FALSE; break; }
    }
    CloseHandle(f);
    InternetCloseHandle(h);
    if (!ok) DeleteFileW(dst);
    return ok;
}

/* katta faylni foiz bilan yuklash (o'yin o'rnatuvchisi) */
/* Katta faylni (CS 1.6 o'rnatuvchisi) yuklash: internet uzilsa - keyingi urinishda (yoki launcher keyingi ochilganda)
 * qolgan joyidan davom etadi (HTTP Range). Xato sababi g_dl_err da: 1 internet, 2 diskda joy yo'q, 3 papkaga yozib bo'lmadi */
static int g_dl_err = 0;
static BOOL http_download_pct(const char *url, const wchar_t *dst, const wchar_t *label)
{
    g_dl_err = 1;
    ULONGLONG have = 0;
    WIN32_FILE_ATTRIBUTE_DATA fa;
    if (GetFileAttributesExW(dst, GetFileExInfoStandard, &fa)) have = ((ULONGLONG)fa.nFileSizeHigh << 32) | fa.nFileSizeLow;
    HINTERNET h = NULL;
    DWORD code = 0, len;
    if (have > 0) {                                  /* oldingi yuklashdan qolgan qism - davomini so'raymiz */
        char hdr[64]; _snprintf(hdr, sizeof(hdr), "Range: bytes=%I64u-\r\n", have); hdr[sizeof(hdr) - 1] = 0;
        DWORD fl = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_UI | INTERNET_FLAG_KEEP_CONNECTION;
        if (!_strnicmp(url, "https://", 8)) fl |= INTERNET_FLAG_SECURE;
        if (!(g_net_dl && (LONG)(GetTickCount() - g_net_dl) > 0)) h = InternetOpenUrlA(g_net, url, hdr, (DWORD)-1L, fl, 0);
        if (!h) return FALSE;
        len = sizeof(code); HttpQueryInfoA(h, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &code, &len, NULL);
        if (code != 206 && code != 200) { InternetCloseHandle(h); h = NULL; DeleteFileW(dst); have = 0; }   /* 416 va h.k. - boshidan */
        else if (code == 200) have = 0;            /* server davom ettirishni bilmaydi - boshidan */
    }
    if (!h) { h = open_url(url); if (!h) return FALSE; }
    DWORD part = 0; len = sizeof(part);
    HttpQueryInfoA(h, HTTP_QUERY_CONTENT_LENGTH | HTTP_QUERY_FLAG_NUMBER, &part, &len, NULL);
    ULONGLONG total = part ? have + part : 0;
    /* diskda joy: fayl + o'rnatish uchun zaxira (o'yin ~1 GB) */
    ULARGE_INTEGER fr; wchar_t dir[MAX_PATH]; lstrcpynW(dir, dst, MAX_PATH); { wchar_t *bs = wcsrchr(dir, L'\\'); if (bs) bs[1] = 0; }
    if (total && GetDiskFreeSpaceExW(dir, &fr, NULL, NULL) && fr.QuadPart < (total - have) + (64ULL << 20)) { InternetCloseHandle(h); g_dl_err = 2; return FALSE; }
    HANDLE f = CreateFileW(dst, GENERIC_WRITE, 0, NULL, have ? OPEN_ALWAYS : CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { InternetCloseHandle(h); g_dl_err = 3; return FALSE; }
    if (have) { LARGE_INTEGER z; z.QuadPart = 0; SetFilePointerEx(f, z, NULL, FILE_END); }
    static char buf[65536];
    DWORD got, wr;
    ULONGLONG n = have;
    int lastPct = -1;
    BOOL ok = TRUE;
    while ((ok = InternetReadFile(h, buf, sizeof(buf), &got)) != FALSE) {
        if (!got) break;
        if (!WriteFile(f, buf, got, &wr, NULL) || wr != got) { ok = FALSE; g_dl_err = GetLastError() == ERROR_DISK_FULL ? 2 : 3; break; }
        n += got;
        int pct = total ? (int)(n * 100 / total) : 0;
        if (pct != lastPct) {
            wchar_t msg[256];
            if (total) _snwprintf(msg, 256, L"%s %d%%  (%u / %u MB)", label, pct, (unsigned)(n >> 20), (unsigned)(total >> 20));
            else _snwprintf(msg, 256, L"%s %u MB", label, (unsigned)(n >> 20));
            status(msg, pct);
            lastPct = pct;
        }
    }
    CloseHandle(f);
    InternetCloseHandle(h);
    if (ok && total && n != total) ok = FALSE;
    if (ok) g_dl_err = 0;
    return ok;
}

/* ---------------------------------------------------------------- SHA-256 */
/* limit > 0 bo'lsa faqat birinchi limit baytni hisoblaydi (o'z exe'miz oxirida kalit bor) */
static BOOL sha256_part(const wchar_t *path, char hex[65], ULONGLONG *size, ULONGLONG limit)
{
    HANDLE f = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, NULL);
    if (f == INVALID_HANDLE_VALUE) return FALSE;
    HCRYPTPROV prov = 0; HCRYPTHASH hh = 0;
    BOOL ok = CryptAcquireContextW(&prov, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)
           && CryptCreateHash(prov, CALG_SHA_256, 0, 0, &hh);
    static BYTE buf[1 << 16];
    DWORD got;
    ULONGLONG total = 0;
    while (ok && ReadFile(f, buf, sizeof(buf), &got, NULL) && got) {
        if (limit && total + got > limit) got = (DWORD)(limit - total);
        if (got) ok = CryptHashData(hh, buf, got, 0);
        total += got;
        if (limit && total >= limit) break;
    }
    BYTE dig[32]; DWORD dl = 32;
    if (ok) ok = CryptGetHashParam(hh, HP_HASHVAL, dig, &dl, 0);
    if (ok) for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", dig[i]);
    if (hh) CryptDestroyHash(hh);
    if (prov) CryptReleaseContext(prov, 0);
    CloseHandle(f);
    if (size) *size = total;
    return ok;
}
static BOOL sha256_file(const wchar_t *path, char hex[65], ULONGLONG *size) { return sha256_part(path, hex, size, 0); }

/* ---------------------------------------------------------------- sozlamalar */
static char g_lang[8] = "";
static void ini_path(wchar_t *out) { path_join(out, g_dir, L"xclient.ini"); }

static void ini_load(void)
{
    wchar_t ini[MAX_PATH], w[64];
    ini_path(ini);
    GetPrivateProfileStringW(L"x", L"key", L"", w, 64, ini);
    if (w[0]) WideCharToMultiByte(CP_UTF8, 0, w, -1, g_key, sizeof(g_key), NULL, NULL);
    GetPrivateProfileStringW(L"x", L"channel", L"", w, 64, ini);
    if (w[0]) WideCharToMultiByte(CP_UTF8, 0, w, -1, g_chan, sizeof(g_chan), NULL, NULL);
    GetPrivateProfileStringW(L"x", L"id", L"", w, 64, ini);
    if (w[0]) WideCharToMultiByte(CP_UTF8, 0, w, -1, g_id, sizeof(g_id), NULL, NULL);
    GetPrivateProfileStringW(L"x", L"version", L"", w, 64, ini);
    if (w[0]) WideCharToMultiByte(CP_UTF8, 0, w, -1, g_version, sizeof(g_version), NULL, NULL);
    g_build = GetPrivateProfileIntW(L"x", L"build", 0, ini);
    GetPrivateProfileStringW(L"x", L"lang", L"", w, 64, ini);              /* o'rnatuvchida tanlangan til (ru/uz/en) */
    if (w[0]) WideCharToMultiByte(CP_UTF8, 0, w, -1, g_lang, sizeof(g_lang), NULL, NULL);
}

static void ini_save(void)
{
    wchar_t ini[MAX_PATH], w[64];
    ini_path(ini);
    MultiByteToWideChar(CP_UTF8, 0, g_key, -1, w, 64);     WritePrivateProfileStringW(L"x", L"key", w, ini);
    MultiByteToWideChar(CP_UTF8, 0, g_chan, -1, w, 64);    WritePrivateProfileStringW(L"x", L"channel", w, ini);
    MultiByteToWideChar(CP_UTF8, 0, g_id, -1, w, 64);      WritePrivateProfileStringW(L"x", L"id", w, ini);
    MultiByteToWideChar(CP_UTF8, 0, g_version, -1, w, 64); WritePrivateProfileStringW(L"x", L"version", w, ini);
    _snwprintf(w, 64, L"%d", g_build);                     WritePrivateProfileStringW(L"x", L"build", w, ini);
}

/* .exe oxiridagi "\0XCKEY:kalit|vetka\0" */
static void read_trailer(void)
{
    HANDLE f = CreateFileW(g_self, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (f == INVALID_HANDLE_VALUE) return;
    char buf[257] = {0};
    LARGE_INTEGER sz, pos;
    GetFileSizeEx(f, &sz);
    pos.QuadPart = sz.QuadPart > 256 ? sz.QuadPart - 256 : 0;
    SetFilePointerEx(f, pos, NULL, FILE_BEGIN);
    DWORD got = 0;
    ReadFile(f, buf, 256, &got, NULL);
    CloseHandle(f);
    for (int i = (int)got - 8; i >= 0; i--) {
        if (!memcmp(buf + i, "XCKEY:", 6)) {
            char *k = buf + i + 6, *bar = strchr(k, '|');
            if (!bar) return;
            *bar = 0;
            if (strlen(k) < sizeof(g_key)) strcpy(g_key, k);
            if (!strncmp(bar + 1, "beta", 4)) strcpy(g_chan, "beta");
            return;
        }
    }
}

static void make_id(void)
{
    if (g_id[0]) return;
    HCRYPTPROV p;
    BYTE r[16];
    if (CryptAcquireContextW(&p, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT)) {
        CryptGenRandom(p, 16, r);
        CryptReleaseContext(p, 0);
    } else {
        srand(GetTickCount());
        for (int i = 0; i < 16; i++) r[i] = (BYTE)rand();
    }
    for (int i = 0; i < 16; i++) sprintf(g_id + i * 2, "%02x", r[i]);
}

static void detect_os(void)
{
    typedef LONG (WINAPI *RGV)(PRTL_OSVERSIONINFOW);
    RTL_OSVERSIONINFOW v = { sizeof(v) };
    RGV f = (RGV)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
    if (f && f(&v) == 0) {
        const char *n = "Windows";
        if (v.dwMajorVersion == 10 && v.dwBuildNumber >= 22000) n = "Win11";
        else if (v.dwMajorVersion == 10) n = "Win10";
        else if (v.dwMajorVersion == 6 && v.dwMinorVersion == 3) n = "Win8.1";
        else if (v.dwMajorVersion == 6 && v.dwMinorVersion == 2) n = "Win8";
        else if (v.dwMajorVersion == 6 && v.dwMinorVersion == 1) n = "Win7";
        else if (v.dwMajorVersion == 5) n = "WinXP";
        BOOL wow = FALSE;
        IsWow64Process(GetCurrentProcess(), &wow);
        _snprintf(g_os, sizeof(g_os), "%s-%s-%lu", n, wow ? "x64" : "x86", v.dwBuildNumber);
    }
}

/* ---------------------------------------------------------------- API */
typedef struct { char status[16], version[32], base[512], manifest[512], master[512], msg[256], game[512]; int build, min; } UpdInfo;

static void kv(const char *body, const char *key, char *out, size_t cap)
{
    size_t kl = strlen(key);
    out[0] = 0;
    for (const char *p = body; p && *p;) {
        if (!strncmp(p, key, kl) && p[kl] == '=') {
            const char *s = p + kl + 1, *e = strchr(s, '\n');
            size_t n = e ? (size_t)(e - s) : strlen(s);
            if (n >= cap) n = cap - 1;
            memcpy(out, s, n); out[n] = 0;
            if (n && out[n - 1] == '\r') out[n - 1] = 0;
            return;
        }
        p = strchr(p, '\n');
        if (p) p++;
    }
}

static void api_call(const char *action, char **resp)
{
    char url[1024];
    _snprintf(url, sizeof(url), "%s?a=%s&k=%s&id=%s&v=%s&os=%s&ch=%s",
              XC_API, action, g_key, g_id, g_version[0] ? g_version : "0", g_os, g_chan);
    url[sizeof(url) - 1] = 0;
    char *r = http_get(url, NULL);
    if (resp) *resp = r; else free(r);
}

static BOOL get_update(UpdInfo *u)
{
    char *r = NULL, tmp[32];
    memset(u, 0, sizeof(*u));
    api_call("update", &r);
    if (!r) return FALSE;
    kv(r, "status", u->status, sizeof(u->status));
    kv(r, "version", u->version, sizeof(u->version));
    kv(r, "base", u->base, sizeof(u->base));
    kv(r, "manifest", u->manifest, sizeof(u->manifest));
    kv(r, "master", u->master, sizeof(u->master));
    kv(r, "msg", u->msg, sizeof(u->msg));
    kv(r, "game", u->game, sizeof(u->game));
    kv(r, "build", tmp, sizeof(tmp)); u->build = atoi(tmp);
    kv(r, "min", tmp, sizeof(tmp));   u->min = atoi(tmp);
    free(r);
    /* yangilanish faqat shu repo'dan (https): sayt javobi http orqali keladi - yo'lda almashtirilsa ham boshqa joydan exe olinmaydi */
    static const char REPO[] = "https://raw.githubusercontent.com/jamic2922220-alt/xclient-pc/";
    if (u->base[0] && (_strnicmp(u->base, REPO, sizeof(REPO) - 1) || strstr(u->base, "..")
        || _strnicmp(u->manifest, u->base, strlen(u->base)))) { u->base[0] = 0; u->manifest[0] = 0; }
    if (u->game[0] && _stricmp(u->game, XC_GAME_URL) && _strnicmp(u->game, "https://cssborka.uz/", 20)) u->game[0] = 0;
    return u->status[0] != 0;
}

/* ---------------------------------------------------------------- yangilash */
/* manifest qatori: "<sha256> <hajm> <yo'l/fayl>"
 * Qator "?" bilan boshlansa - fayl faqat YO'Q bo'lsa yuklanadi (o'yinchi sozlamalari: config.cfg va h.k.
 * yangilanishda o'chib ketmasligi uchun). */
static int sync_files(const UpdInfo *u, BOOL *selfUpdated)
{
    status(L"Fayllar ro‘yxati olinmoqda...", 2);
    char *man = http_get(u->manifest, NULL);
    if (!man) return -1;

    int total = 0, done = 0, fails = 0;
    for (char *p = man; *p; p++) if (*p == '\n') total++;
    if (!total) { free(man); return -1; }

    char *line = man, *next;
    for (; line && *line; line = next) {
        next = strchr(line, '\n');
        if (next) *next++ = 0;
        size_t L = strlen(line);
        if (L && line[L - 1] == '\r') line[--L] = 0;
        BOOL onlyMissing = FALSE;
        if (*line == '?') { onlyMissing = TRUE; line++; }
        char sha[65] = {0}; int off = 0;
        if (sscanf(line, "%64s%n", sha, &off) < 1 || strlen(sha) != 64) continue;
        char *endp = NULL;
        unsigned long long size = _strtoui64(line + off, &endp, 10);
        if (!endp || *endp != ' ') continue;
        const char *rel = endp + 1;
        if (!*rel || strstr(rel, "..") || rel[0] == '/' || strchr(rel, ':')) continue; /* xavfsizlik */
        done++;

        wchar_t wrel[MAX_PATH], dst[MAX_PATH], tmp[MAX_PATH];
        if (!MultiByteToWideChar(CP_UTF8, 0, rel, -1, wrel, MAX_PATH)) continue;   /* juda uzun yo'l */
        path_join(dst, g_dir, wrel);

        if (onlyMissing && GetFileAttributesW(dst) != INVALID_FILE_ATTRIBUTES) continue;
        if (!_wcsicmp(wrel, XC_EXE_LEGACY)) continue;   /* faqat eski launcherlar o'zini yangilashi uchun */
        BOOL isSelf = !_wcsicmp(wrel, XC_EXE);
        char have[65] = {0}; ULONGLONG hs = 0;
        /* o'z exe'mizda oxirida kalit bo'lishi mumkin - faqat asosiy qismini solishtiramiz */
        if (sha256_part(isSelf ? g_self : dst, have, &hs, isSelf ? size : 0) && hs == size && !_stricmp(have, sha)) continue;

        wchar_t msg[256];
        _snwprintf(msg, 256, L"Yuklanmoqda: %s", wrel);
        status(msg, 2 + 96 * done / total);

        char enc[1024], url[1600];
        url_escape(enc, sizeof(enc), rel);
        _snprintf(url, sizeof(url), "%s/%s", u->base, enc);
        url[sizeof(url) - 1] = 0;
        mkdirs_for(dst);
        _snwprintf(tmp, MAX_PATH, L"%s.xcdl", dst); tmp[MAX_PATH - 1] = 0;

        BOOL ok = FALSE;
        for (int attempt = 0; attempt < 3 && !ok; attempt++) {
            if (http_download(url, tmp) && sha256_file(tmp, have, &hs) && hs == size && !_stricmp(have, sha)) ok = TRUE;
            else Sleep(800);
        }
        if (!ok) { DeleteFileW(tmp); fails++; continue; }

        if (isSelf) {
            wchar_t old[MAX_PATH];
            _snwprintf(old, MAX_PATH, L"%s.old", g_self); old[MAX_PATH - 1] = 0;
            DeleteFileW(old);
            if (MoveFileExW(g_self, old, MOVEFILE_REPLACE_EXISTING)) {
                /* antivirus yangi exe'ni tekshirayotgan bo'lsa ko'chirish bir zum rad etiladi - bir necha marta urinamiz,
                 * bo'lmasa eski launcherni joyiga qaytaramiz (aks holda yorliq hech narsaga qaramay qolardi) */
                BOOL moved = FALSE;
                for (int i = 0; i < 10 && !(moved = MoveFileExW(tmp, g_self, MOVEFILE_REPLACE_EXISTING)); i++) Sleep(500);
                if (moved) *selfUpdated = TRUE;
                else { MoveFileExW(old, g_self, MOVEFILE_REPLACE_EXISTING); DeleteFileW(tmp); fails++; }   /* keyingi safar qayta urinamiz */
            } else { DeleteFileW(tmp); fails++; }
        } else {
            if (!MoveFileExW(tmp, dst, MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED)) { DeleteFileW(tmp); fails++; }
        }
    }
    free(man);
    return fails;
}

/* ---------------------------------------------------------------- o'rnatish */
static void make_shortcut(const wchar_t *target)
{
    wchar_t desk[MAX_PATH], lnk[MAX_PATH];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, desk))) return;
    _snwprintf(lnk, MAX_PATH, L"%s\\X CLIENT.lnk", desk); lnk[MAX_PATH - 1] = 0;
    IShellLinkW *sl = NULL;
    if (SUCCEEDED(CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void **)&sl))) {
        IPersistFile *pf = NULL;
        sl->lpVtbl->SetPath(sl, target);
        sl->lpVtbl->SetWorkingDirectory(sl, g_dir);
        sl->lpVtbl->SetDescription(sl, L"X CLIENT — Counter-Strike 1.6");
        if (SUCCEEDED(sl->lpVtbl->QueryInterface(sl, &IID_IPersistFile, (void **)&pf))) {
            pf->lpVtbl->Save(pf, lnk, TRUE);
            pf->lpVtbl->Release(pf);
        }
        sl->lpVtbl->Release(sl);
    }
}

/* O'yin papkasida yorliq: ko'pchilik papkani ochib adashib cstrike.exe ni bosadi - launchersiz yangilanish, video, tezlashtirish
 * ishlamaydi. Papkaning eng tepasida turadigan yorliq to'g'ri yo'lni ko'rsatadi. Bor bo'lsa - tegmaymiz (har ochilishda arzon tekshiruv) */
static void game_dir_link(void)
{
    wchar_t lnk[MAX_PATH], tgt[MAX_PATH];
    if (!g_dir[0]) return;
    path_join(lnk, g_dir, L"\u25B6 X CLIENT - O\u2018YINNI SHU YERDAN OCHING.lnk");
    if (GetFileAttributesW(lnk) != INVALID_FILE_ATTRIBUTES) return;
    path_join(tgt, g_dir, L"XCLauncher.exe");
    if (GetFileAttributesW(tgt) == INVALID_FILE_ATTRIBUTES) lstrcpynW(tgt, g_self, MAX_PATH);
    HRESULT ci = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);    /* worker oqimida COM hali ishga tushmagan bo'lishi mumkin */
    IShellLinkW *sl = NULL;
    if (FAILED(CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void **)&sl))) { if (SUCCEEDED(ci)) CoUninitialize(); return; }
    IPersistFile *pf = NULL;
    sl->lpVtbl->SetPath(sl, tgt);
    sl->lpVtbl->SetWorkingDirectory(sl, g_dir);
    sl->lpVtbl->SetIconLocation(sl, tgt, 0);
    sl->lpVtbl->SetDescription(sl, L"X CLIENT \u2014 Counter-Strike 1.6 (yangilanish, video, tezlashtirish)");
    if (SUCCEEDED(sl->lpVtbl->QueryInterface(sl, &IID_IPersistFile, (void **)&pf))) { pf->lpVtbl->Save(pf, lnk, TRUE); pf->lpVtbl->Release(pf); }
    sl->lpVtbl->Release(sl);
    if (SUCCEEDED(ci)) CoUninitialize();
}

/* CS 1.6 (boost-top PRO) o'rnatuvchisi ish stoli va Pusk menyusiga o'z yorliqlarini qo'yadi - o'yinchi "ikkita client
 * o'rnatildi" deb o'ylaydi. O'yin papkamizdagi fayllarga olib boradigan, X CLIENT ga tegishli bo'lmagan yorliqlarni o'chiramiz
 * (o'yin fayllari qoladi - X CLIENT ularni ishlatadi). Boshqa sborkalar yorliqlariga tegmaymiz: faqat nishoni g_dir ichida bo'lsa. */
static BOOL lnk_is_game(const wchar_t *lnk)
{
    BOOL r = FALSE;
    IShellLinkW *sl = NULL;
    if (FAILED(CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (void **)&sl))) return FALSE;
    IPersistFile *pf = NULL;
    if (SUCCEEDED(sl->lpVtbl->QueryInterface(sl, &IID_IPersistFile, (void **)&pf))) {
        wchar_t t[MAX_PATH] = L"";
        if (SUCCEEDED(pf->lpVtbl->Load(pf, lnk, STGM_READ)) && SUCCEEDED(sl->lpVtbl->GetPath(sl, t, MAX_PATH, NULL, SLGP_RAWPATH)) && t[0]) {
            size_t n = wcslen(g_dir);
            const wchar_t *b = wcsrchr(t, L'\\');
            b = b ? b + 1 : t;
            r = n > 3 && !_wcsnicmp(t, g_dir, n) && (t[n] == L'\\' || !t[n])
                && _wcsicmp(b, L"XCLauncher.exe") && _wcsicmp(b, XC_EXE_LEGACY) && _wcsicmp(b, L"XClient-Uninstall.exe");
        }
        pf->lpVtbl->Release(pf);
    }
    sl->lpVtbl->Release(sl);
    return r;
}
static void clean_links_in(const wchar_t *dir, int depth)
{
    wchar_t mask[MAX_PATH], p[MAX_PATH];
    path_join(mask, dir, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue;
        path_join(p, dir, fd.cFileName);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (depth > 0 && _wcsicmp(fd.cFileName, L"X CLIENT")) { clean_links_in(p, depth - 1); RemoveDirectoryW(p); }   /* bo'shab qolsa o'chadi */
            continue;
        }
        size_t l = wcslen(fd.cFileName);
        if (l > 4 && !_wcsicmp(fd.cFileName + l - 4, L".lnk") && lnk_is_game(p)) DeleteFileW(p);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
static void remove_game_links(void)
{
    static const int ids[] = { CSIDL_DESKTOPDIRECTORY, CSIDL_COMMON_DESKTOPDIRECTORY, CSIDL_PROGRAMS, CSIDL_COMMON_PROGRAMS };
    for (int i = 0; i < 4; i++) {
        wchar_t d[MAX_PATH];
        if (SUCCEEDED(SHGetFolderPathW(NULL, ids[i], NULL, 0, d))) clean_links_in(d, i >= 2 ? 1 : 0);
    }
}

/* Setup.exe boshqa joydan ishga tushgan bo'lsa -> C:\Games\XClient ga ko'chib o'tamiz */
static BOOL ensure_installed(BOOL *fresh)
{
    wchar_t selfDir[MAX_PATH], ini[MAX_PATH];
    lstrcpynW(selfDir, g_self, MAX_PATH);
    wchar_t *bs = wcsrchr(selfDir, L'\\');
    if (bs) *bs = 0;
    path_join(ini, selfDir, L"xclient.ini");
    if (GetFileAttributesW(ini) != INVALID_FILE_ATTRIBUTES) { lstrcpyW(g_dir, selfDir); return TRUE; }
    /* exe o'yin papkasining o'zida turgan bo'lsa (cstrike.exe / hl.exe yonida) - shu papkani ishlatamiz */
    {
        wchar_t g1[MAX_PATH], g2[MAX_PATH];
        path_join(g1, selfDir, L"cstrike.exe");
        path_join(g2, selfDir, L"hl.exe");
        if (GetFileAttributesW(g1) != INVALID_FILE_ATTRIBUTES || GetFileAttributesW(g2) != INVALID_FILE_ATTRIBUTES) {
            lstrcpyW(g_dir, selfDir);
            WritePrivateProfileStringW(L"x", L"installed", L"1", ini);
            make_shortcut(g_self);
            *fresh = TRUE;
            return TRUE;
        }
    }

    /* o'rnatish papkasi */
    const wchar_t *cands[2] = { L"C:\\Games\\XClient", NULL };
    wchar_t la[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, la))) { wcscat(la, L"\\XClient"); cands[1] = la; }
    for (int i = 0; i < 2 && cands[i]; i++) {
        CreateDirectoryW(L"C:\\Games", NULL);
        CreateDirectoryW(cands[i], NULL);
        wchar_t probe[MAX_PATH];
        path_join(probe, cands[i], L"xclient.ini");
        if (WritePrivateProfileStringW(L"x", L"installed", L"1", probe)) { lstrcpyW(g_dir, cands[i]); break; }
    }
    if (!g_dir[0]) return FALSE;

    wchar_t dst[MAX_PATH];
    path_join(dst, g_dir, XC_EXE);
    if (_wcsicmp(dst, g_self)) {
        CopyFileW(g_self, dst, FALSE);
        /* paket ichida kelgan X CLIENT dizaynini ham ko'chiramiz */
        const wchar_t *items[] = { L"xc_theme", L"xclient_version.txt" };
        for (int i = 0; i < 2; i++) {
            wchar_t from[MAX_PATH + 2] = {0}, to[MAX_PATH + 2] = {0};
            path_join(from, selfDir, items[i]);
            if (GetFileAttributesW(from) == INVALID_FILE_ATTRIBUTES) continue;
            lstrcpyW(to, g_dir);
            SHFILEOPSTRUCTW op = {0};
            op.wFunc = FO_COPY; op.pFrom = from; op.pTo = to;
            op.fFlags = FOF_NOCONFIRMATION | FOF_NOCONFIRMMKDIR | FOF_NOERRORUI | FOF_SILENT;
            SHFileOperationW(&op);
        }
    }
    make_shortcut(dst);
    *fresh = TRUE;
    lstrcpyW(g_self, dst);
    return TRUE;
}

/* ---------------------------------------------------------------- o'yin */
static BOOL has_game(void)
{
    wchar_t p[MAX_PATH];
    path_join(p, g_dir, L"cstrike.exe");
    if (GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES) return TRUE;
    path_join(p, g_dir, L"hl.exe");
    return GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES;
}

static DWORD g_setup_err = 0;
/* Inno Setup chiqish kodi: 0 ok, 1-3 ishga tushmadi, 2/5 bekor qilindi, 4 o'rnatish paytida xato, 6 to'xtatildi, 7 tayyorlashda xato */
static DWORD g_setup_exit = 0;
static BOOL run_setup(const wchar_t *exe, const wchar_t *params)
{
    g_setup_err = 0;
    SHELLEXECUTEINFOW sei = { sizeof(sei) };
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.lpVerb = L"runas";               /* o'rnatuvchi administrator huquqini so'raydi */
    sei.lpFile = exe;
    sei.lpParameters = params;
    sei.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&sei) || !sei.hProcess) { g_setup_err = GetLastError(); if (!g_setup_err) g_setup_err = 1; return FALSE; }
    WaitForSingleObject(sei.hProcess, INFINITE);
    if (!GetExitCodeProcess(sei.hProcess, &g_setup_exit)) g_setup_exit = 999;
    CloseHandle(sei.hProcess);
    return TRUE;
}

/* Oflayn paket: CS 1.6 o'rnatuvchisi (CS_1_6_boost-top_PRO*.exe) launcher yonida, Yuklamalar yoki Ish stolida bo'lsa -
 * internetdan yuklamasdan shuni ishlatamiz (internet-kafe, sekin internet). 100 MB dan kichigi - chala fayl, hisobga olinmaydi */
static BOOL setup_in_dir(const wchar_t *dir, wchar_t *out)
{
    wchar_t pat[MAX_PATH];
    _snwprintf(pat, MAX_PATH, L"%s\\CS_1_6_boost-top_PRO*.exe", dir); pat[MAX_PATH - 1] = 0;
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    do {
        ULONGLONG sz = ((ULONGLONG)fd.nFileSizeHigh << 32) | fd.nFileSizeLow;
        if (!_wcsicmp(fd.cFileName, L"CS_1_6_boost-top_PRO_2_5_3.exe") && sz != XC_GAME_SIZE) continue;   /* brauzerda chala yuklangan nusxa - ishlatmaymiz */
        if (sz > (100ULL << 20)) { _snwprintf(out, MAX_PATH, L"%s\\%s", dir, fd.cFileName); out[MAX_PATH - 1] = 0; FindClose(h); return TRUE; }
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    return FALSE;
}
static BOOL find_local_setup(wchar_t *out)
{
    wchar_t dirs[4][MAX_PATH], prof[MAX_PATH] = L"";
    int nd = 0, deep = 0;
    lstrcpynW(dirs[nd], g_self, MAX_PATH); { wchar_t *bs = wcsrchr(dirs[nd], L'\\'); if (bs) { *bs = 0; nd++; } }
    lstrcpynW(dirs[nd++], g_dir, MAX_PATH);
    if (GetEnvironmentVariableW(L"USERPROFILE", prof, MAX_PATH)) {
        deep = nd;
        _snwprintf(dirs[nd++], MAX_PATH, L"%s\\Downloads", prof);
        _snwprintf(dirs[nd++], MAX_PATH, L"%s\\Desktop", prof);
    }
    for (int i = 0; i < nd; i++) if (setup_in_dir(dirs[i], out)) return TRUE;
    /* oflayn paket (zip) ochilganda o'rnatuvchi ichki papkada qoladi: Yuklamalar\X-CLIENT-oflayn\CS_1_6_...exe - bir pog'ona ichkarini ham qaraymiz */
    for (int i = deep; deep && i < nd; i++) {
        wchar_t pat[MAX_PATH], sub[MAX_PATH]; _snwprintf(pat, MAX_PATH, L"%s\\*", dirs[i]); pat[MAX_PATH - 1] = 0;
        WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd); int n = 0;
        if (h == INVALID_HANDLE_VALUE) continue;
        do {
            if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || fd.cFileName[0] == L'.') continue;
            _snwprintf(sub, MAX_PATH, L"%s\\%s", dirs[i], fd.cFileName); sub[MAX_PATH - 1] = 0;
            if (setup_in_dir(sub, out)) { FindClose(h); return TRUE; }
        } while (++n < 300 && FindNextFileW(h, &fd));
        FindClose(h);
    }
    return FALSE;
}

/* O'yin yo'q bo'lsa - asl boost-top PRO o'rnatuvchisini yuklab, shu papkaga o'rnatamiz.
 * Avval tekshiruv (diskda joy, papkaga yozish), keyin oflayn fayl, keyin cssborka.uz, ishlamasa - GitHub'dagi zaxira nusxa */
static BOOL ensure_game(const char *url)
{
    if (has_game()) return TRUE;
    if (!url || !*url) url = XC_GAME_URL;
    /* 4. o'rnatishdan oldin tekshiruv */
    ULARGE_INTEGER fr; wchar_t root[8] = L"C:\\";
    if (g_dir[0] && g_dir[1] == L':') root[0] = g_dir[0];
    if (GetDiskFreeSpaceExW(root, &fr, NULL, NULL) && fr.QuadPart < (2048ULL << 20)) {
        prob_send("dl_disk", 4000);
        _snwprintf(g_err, 256, L"%c: diskda joy yetmayapti (%u MB bo‘sh). CS 1.6 uchun kamida 2 GB kerak - keraksiz fayllarni o‘chirib, X CLIENT ni qayta oching.", root[0], (unsigned)(fr.QuadPart >> 20));
        return FALSE;
    }
    {
        wchar_t t[MAX_PATH]; path_join(t, g_dir, L"xc_write_test.tmp");
        HANDLE f = CreateFileW(t, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY | FILE_FLAG_DELETE_ON_CLOSE, NULL);
        if (f == INVALID_HANDLE_VALUE) {
            prob_send("dl_perm", 4000);
            lstrcpyW(g_err, L"O‘yin papkasiga yozib bo‘lmadi. X CLIENT ni o‘ng tugma > «Запуск от имени администратора» bilan oching yoki antivirusni vaqtincha o‘chiring.");
            return FALSE;
        }
        CloseHandle(f);
    }
    wchar_t tmp[MAX_PATH], params[1024];
    BOOL local = find_local_setup(tmp), ok = local;
    if (local) { status(L"CS 1.6 kompyuterdagi fayldan o‘rnatiladi (internetsiz)...", 100); prob_send("offline", 0); }
    else {
        GetTempPathW(MAX_PATH, tmp);
        wcscat(tmp, L"xc_cs16_setup.exe");
        const char *src[2] = { url, XC_GAME_MIRROR };
        for (int s2 = 0; s2 < 2 && !ok; s2++) {
            for (int i = 0; i < (s2 ? 6 : 4) && !ok; i++) {   /* uzilsa - qolgan joyidan davom etadi */
                ok = http_download_pct(src[s2], tmp, s2 ? L"CS 1.6 yuklanmoqda (zaxira):" : L"CS 1.6 yuklanmoqda:");
                if (ok && (!strcmp(src[s2], XC_GAME_URL) || !strcmp(src[s2], XC_GAME_MIRROR))) {   /* hajm tekshiruvi: sayt hajmni aytmasa ham chala fayl o'tib ketmasin */
                    WIN32_FILE_ATTRIBUTE_DATA da; ULONGLONG got = 0;
                    if (GetFileAttributesExW(tmp, GetFileExInfoStandard, &da)) got = ((ULONGLONG)da.nFileSizeHigh << 32) | da.nFileSizeLow;
                    if (got != XC_GAME_SIZE) {
                        char raw[80]; _snprintf(raw, sizeof(raw), "got=%lluMB src=%d", got >> 20, s2); raw[79] = 0; url_escape(g_probx, sizeof(g_probx), raw); prob_send("dl_short", 0); g_probx[0] = 0;
                        ok = FALSE; g_dl_err = 1;
                        if (got > XC_GAME_SIZE || i >= 1) { DeleteFileW(tmp); break; }   /* ortiqcha yoki ikkinchi marta ham chala - boshqa manzilga */
                        continue;                                                         /* birinchi marta chala - qolgan joyidan davom ettirib ko'ramiz */
                    }
                }
                if (!ok && g_dl_err != 1) break;          /* disk/papka xatosi - qayta urinish foyda bermaydi */
                if (!ok) { status(L"Internet uzildi, davom ettirilmoqda...", 0); Sleep(3000 + i * 2000); }
            }
            if (!ok && g_dl_err != 1) break;
            if (!ok && !s2) { DeleteFileW(tmp); prob_send("dl_mirror", 0); }   /* boshqa manzil - qismni boshidan (fayl bir xil bo'lishiga ishonmaymiz) */
        }
    }
    if (!ok) {                                    /* yuklangan qism o'chirilmaydi: keyingi ochilishda davomidan */
        prob_send(g_dl_err == 2 ? "dl_disk" : g_dl_err == 3 ? "dl_perm" : "dl_net", 4000);
        if (g_dl_err == 2) lstrcpyW(g_err, L"Diskda joy yetmayapti. CS 1.6 uchun kamida 2 GB bo‘sh joy kerak - keraksiz fayllarni o‘chirib, X CLIENT ni qayta oching.");
        else if (g_dl_err == 3) lstrcpyW(g_err, L"Papkaga yozib bo‘lmadi. X CLIENT ni o‘ng tugma > «Запуск от имени администратора» bilan oching yoki antivirusni vaqtincha o‘chiring.");
        else lstrcpyW(g_err, L"CS 1.6 yuklanmadi: internet juda sekin yoki uzilib qolyapti. X CLIENT ni qayta oching - yuklash qolgan joyidan davom etadi. Internet yomon bo‘lsa - cssborka.uz dagi «Oflayn paket» ni oling.");
        return FALSE;
    }
    if (GetFileAttributesW(tmp) == INVALID_FILE_ATTRIBUTES) {   /* yuklandi, lekin fayl yo'qoldi - antivirus o'chirdi */
        prob_send("av_del", 4000);
        lstrcpyW(g_err, L"Antivirus yuklangan o‘yin faylini o‘chirib yubordi. Antivirusda X CLIENT papkasini istisnoga qo‘shing (yoki vaqtincha o‘chiring) va qayta oching.");
        return FALSE;
    }
    status(L"CS 1.6 o‘rnatilmoqda... (ruxsat so‘ralsa \"Ha\" ni bosing)", 100);
    SetWindowPos(g_wnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    _snwprintf(params, 1024, L"/VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS=\"\" /LANG=uzbek /DIR=\"%s\"", g_dir);
    run_setup(tmp, params);
    DWORD ex1 = g_setup_exit, ex2 = 0;
    if (!has_game()) {
        /* jim rejim ishlamasa - oddiy oynali o'rnatish (papka oldindan tanlangan) */
        _snwprintf(params, 1024, L"/SP- /NOICONS /LANG=uzbek /DIR=\"%s\"", g_dir);
        run_setup(tmp, params);
        ex2 = g_setup_exit;
    }
    if (!has_game() && !g_setup_err) {            /* o'rnatuvchi ishladi, lekin o'yin paydo bo'lmadi - sababi admin panelga */
        ULARGE_INTEGER fr; fr.QuadPart = 0; GetDiskFreeSpaceExW(g_dir, &fr, NULL, NULL);
        WIN32_FILE_ATTRIBUTE_DATA fa; ULONGLONG sz = 0;
        if (GetFileAttributesExW(tmp, GetFileExInfoStandard, &fa)) sz = ((ULONGLONG)fa.nFileSizeHigh << 32) | fa.nFileSizeLow;
        char raw[200]; _snprintf(raw, sizeof(raw), "inno=%lu/%lu local=%d size=%lluMB free=%lluMB", (unsigned long)ex1, (unsigned long)ex2, local ? 1 : 0, sz >> 20, (unsigned long long)(fr.QuadPart >> 20)); raw[199] = 0;
        url_escape(g_probx, sizeof(g_probx), raw); prob_send("setup_fail", 4000); g_probx[0] = 0;
        if (ex2 == 2 || ex2 == 5) lstrcpyW(g_err, L"O‘rnatish oynasi yopib yuborildi. X CLIENT ni qayta oching va o‘rnatish oxirigacha kuting.");
        else if (ex1 == 4 || ex2 == 4 || ex1 == 7 || ex2 == 7) lstrcpyW(g_err, L"CS 1.6 o‘rnatishda xato bo‘ldi (diskda joy yoki antivirus). Kamida 2 GB joy bo‘shating, antivirusni vaqtincha o‘chirib X CLIENT ni qayta oching.");
    }
    if (!local) DeleteFileW(tmp);                 /* o'yinchining o'z (oflayn) faylini o'chirmaymiz */
    if (!has_game()) {
        if (g_setup_err) prob_send(g_setup_err == ERROR_CANCELLED ? "setup_no" : "setup_fail", 4000);
        if (g_setup_err == ERROR_CANCELLED) lstrcpyW(g_err, L"O‘rnatish uchun ruxsat berilmadi. X CLIENT ni qayta ochib, Windows so‘raganda «Да / Ha» ni bosing.");
        else if (g_setup_err) lstrcpyW(g_err, L"O‘rnatuvchi ishga tushmadi - ko‘pincha antivirus to‘sadi. Antivirusda X CLIENT ni istisnoga qo‘shib, qayta oching.");
    }
    return has_game();
}

static void write_master_cfg(const char *master)
{
    wchar_t p[MAX_PATH];
    path_join(p, g_dir, L"cstrike\\xclient_master.cfg");
    mkdirs_for(p);
    FILE *f = _wfopen(p, L"wb");
    if (!f) return;
    fprintf(f, "// X CLIENT tomonidan avtomatik yoziladi\n");
    if (master && *master && !strchr(master, '"')) fprintf(f, "addmasterstatic \"%s\"\n", master);
    fclose(f);
}

/* ---------------------------------------------------------------- X CLIENT dizayni */
/* xc_theme/<yo'l> -> o'yin papkasi/<yo'l>. Asl fayl bir marta xclient_backup ga saqlanadi.
 * Har ochilishda tekshiriladi: boost-top o'rnatuvchisi yoki o'yinchi fayllarni almashtirsa ham tiklanadi. */
static BOOL same_file_hash(const wchar_t *a, const wchar_t *b)
{
    char ha[65], hb[65];
    ULONGLONG sa = 0, sb = 0;
    return sha256_file(a, ha, &sa) && sha256_file(b, hb, &sb) && sa == sb && !strcmp(ha, hb);
}
/* Tez solishtirish: har ochilishda ~90 MB fayl (dizayn, 40 ta fon bo'lagi x 3 papka) qayta o'qilib sha256 hisoblanardi -
 * oddiy kompyuterda (HDD) launcher bir necha soniya qotib turardi. Endi: bir marta tekshirilgan juftlik hajmi va
 * o'zgarish vaqti bilan eslab qolinadi (xc_meta.txt); ikkalasi o'zgarmagan bo'lsa - qayta o'qilmaydi. */
typedef struct { wchar_t to[MAX_PATH]; ULONGLONG fs, fm, ts, tm; } MetaEnt;
static MetaEnt *g_meta = NULL; static int g_meta_n = 0, g_meta_cap = 0; static BOOL g_meta_loaded = FALSE, g_meta_dirty = FALSE;
static BOOL file_meta(const wchar_t *p, ULONGLONG *sz, ULONGLONG *mt)
{
    WIN32_FILE_ATTRIBUTE_DATA a;
    if (!GetFileAttributesExW(p, GetFileExInfoStandard, &a)) return FALSE;
    *sz = ((ULONGLONG)a.nFileSizeHigh << 32) | a.nFileSizeLow;
    *mt = ((ULONGLONG)a.ftLastWriteTime.dwHighDateTime << 32) | a.ftLastWriteTime.dwLowDateTime;
    return TRUE;
}
static void meta_load(void)
{
    g_meta_loaded = TRUE;
    wchar_t f[MAX_PATH]; path_join(f, g_dir, L"xc_meta.txt");
    FILE *fp = _wfopen(f, L"rb");
    if (!fp) return;
    char line[MAX_PATH * 3 + 100];
    while (fgets(line, sizeof(line), fp)) {
        MetaEnt e; int off = 0;
        if (sscanf(line, "%llx %llx %llx %llx %n", &e.fs, &e.fm, &e.ts, &e.tm, &off) < 4 || !off) continue;
        line[strcspn(line, "\r\n")] = 0;
        if (!MultiByteToWideChar(CP_UTF8, 0, line + off, -1, e.to, MAX_PATH)) continue;
        if (g_meta_n == g_meta_cap) { int nc = g_meta_cap ? g_meta_cap * 2 : 256; MetaEnt *nm = (MetaEnt *)realloc(g_meta, nc * sizeof(MetaEnt)); if (!nm) break; g_meta = nm; g_meta_cap = nc; }
        g_meta[g_meta_n++] = e;
        if (g_meta_n >= 4096) break;
    }
    fclose(fp);
}
static void meta_save(void)
{
    if (!g_meta_dirty) return;
    wchar_t f[MAX_PATH]; path_join(f, g_dir, L"xc_meta.txt");
    FILE *fp = _wfopen(f, L"wb");
    if (!fp) return;
    for (int i = 0; i < g_meta_n; i++) {
        char u[MAX_PATH * 3];
        if (!WideCharToMultiByte(CP_UTF8, 0, g_meta[i].to, -1, u, sizeof(u), NULL, NULL)) continue;
        fprintf(fp, "%llx %llx %llx %llx %s\n", g_meta[i].fs, g_meta[i].fm, g_meta[i].ts, g_meta[i].tm, u);
    }
    fclose(fp);
    g_meta_dirty = FALSE;
}
static void meta_put(const wchar_t *from, const wchar_t *to)    /* "from va to bir xil" - hozirgi holatini eslab qolamiz */
{
    MetaEnt e; if (!file_meta(from, &e.fs, &e.fm) || !file_meta(to, &e.ts, &e.tm)) return;
    lstrcpynW(e.to, to, MAX_PATH);
    for (int i = 0; i < g_meta_n; i++) if (!_wcsicmp(g_meta[i].to, to)) { g_meta[i] = e; g_meta_dirty = TRUE; return; }
    if (g_meta_n == g_meta_cap) { int nc = g_meta_cap ? g_meta_cap * 2 : 256; MetaEnt *nm = (MetaEnt *)realloc(g_meta, nc * sizeof(MetaEnt)); if (!nm) return; g_meta = nm; g_meta_cap = nc; }
    g_meta[g_meta_n++] = e; g_meta_dirty = TRUE;
}
static BOOL same_file(const wchar_t *from, const wchar_t *to)
{
    if (!g_meta_loaded) meta_load();
    ULONGLONG fs, fm, ts, tm;
    if (!file_meta(from, &fs, &fm) || !file_meta(to, &ts, &tm) || fs != ts) return FALSE;   /* hajmi boshqa - albatta farq qiladi */
    for (int i = 0; i < g_meta_n; i++)
        if (!_wcsicmp(g_meta[i].to, to)) { if (g_meta[i].fs == fs && g_meta[i].fm == fm && g_meta[i].ts == ts && g_meta[i].tm == tm) return TRUE; break; }
    if (!same_file_hash(from, to)) return FALSE;
    meta_put(from, to);
    return TRUE;
}
/* nusxalash + eslab qolish: keyingi ochilishda shu fayl qayta tekshirilmaydi */
static void copy_known(const wchar_t *from, const wchar_t *to)
{
    mkdirs_for(to); SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL);
    if (CopyFileW(from, to, FALSE)) { if (!g_meta_loaded) meta_load(); meta_put(from, to); }
}

/* nDirect (NextClient yangilovchisi) shu fayllarni har ochilishda serverdagi bilan solishtiradi: biz almashtirsak,
 * o'yin har safar "Downloading updates" bilan ularni qayta yuklaydi. Ularga tegmaymiz - X CLIENT foni
 * cstrike_<til> papkasidan (lang_bg, fix_override_bg) ko'rinadi, bosh menyu esa saytdan ochiladi. */
static BOOL ndirect_managed(const wchar_t *r)
{
    return !_wcsnicmp(r, L"cstrike\\resource\\background\\", 28) || !_wcsicmp(r, L"cstrike\\resource\\BackgroundLayout.txt")
        || !_wcsicmp(r, L"cstrike\\resource\\BackgroundLoadingLayout.txt") || !_wcsnicmp(r, L"platform\\mmb\\", 13)
        || !_wcsicmp(r, L"platform\\mmb_error_page.html");
}

static void apply_theme_dir(const wchar_t *rel)
{
    wchar_t src[MAX_PATH], mask[MAX_PATH];
    path_join(src, g_dir, L"xc_theme");
    if (rel[0]) { wchar_t t[MAX_PATH]; path_join(t, src, rel); lstrcpyW(src, t); }
    path_join(mask, src, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue;
        wchar_t r[MAX_PATH], from[MAX_PATH], to[MAX_PATH], bak[MAX_PATH];
        if (rel[0]) path_join(r, rel, fd.cFileName); else lstrcpynW(r, fd.cFileName, MAX_PATH);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) { apply_theme_dir(r); continue; }
        if (ndirect_managed(r)) continue;
        path_join(from, src, fd.cFileName);
        path_join(to, g_dir, r);
        if (GetFileAttributesW(to) != INVALID_FILE_ATTRIBUTES) {
            if (same_file(from, to)) continue;
            _snwprintf(bak, MAX_PATH, L"%s\\xclient_backup\\%s", g_dir, r);
            bak[MAX_PATH - 1] = 0;
            if (GetFileAttributesW(bak) == INVALID_FILE_ATTRIBUTES) { mkdirs_for(bak); CopyFileW(to, bak, TRUE); }
        }
        copy_known(from, to);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

/* O'yin tilga qarab avval cstrike_russian, cstrike_addon, cstrike_hd ... papkalaridan o'qiydi. Sborka o'z fonini
 * (bt_*.tga, Background*Layout.txt) o'sha yerga ham qo'ygan bo'lsa, bizning fon ko'rinmaydi - u yerdagini ham almashtiramiz. */
static BOOL file_exists(const wchar_t *p);
static void copy_bg_to(const wchar_t *modDir)
{
    wchar_t src[MAX_PATH], dst[MAX_PATH], mask[MAX_PATH], from[MAX_PATH], to[MAX_PATH], bg[MAX_PATH];
    path_join(src, g_dir, L"xc_theme\\cstrike\\resource");
    path_join(dst, modDir, L"resource");
    const wchar_t *lay[2] = { L"BackgroundLayout.txt", L"BackgroundLoadingLayout.txt" };
    for (int i = 0; i < 2; i++) {
        path_join(from, src, lay[i]); path_join(to, dst, lay[i]);
        if (!file_exists(from) || (file_exists(to) && same_file(from, to))) continue;
        copy_known(from, to);
    }
    path_join(bg, src, L"background");
    path_join(mask, bg, L"*.tga");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        wchar_t sub[MAX_PATH];
        path_join(from, bg, fd.cFileName);
        _snwprintf(sub, MAX_PATH, L"background\\%s", fd.cFileName); sub[MAX_PATH - 1] = 0;
        path_join(to, dst, sub);
        if (file_exists(to) && same_file(from, to)) continue;          /* har ochilishda 40 ta faylni qayta yozmaymiz */
        copy_known(from, to);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
static void fix_override_bg(void)
{
    wchar_t mask[MAX_PATH], dir[MAX_PATH], chk[MAX_PATH];
    path_join(mask, g_dir, L"cstrike_*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || !_wcsicmp(fd.cFileName, L"cstrike_downloads")) continue;
        path_join(dir, g_dir, fd.cFileName);
        path_join(chk, dir, L"resource\\background");
        BOOL has = file_exists(chk);
        path_join(chk, dir, L"resource\\BackgroundLayout.txt"); has = has || file_exists(chk);
        path_join(chk, dir, L"resource\\BackgroundLoadingLayout.txt"); has = has || file_exists(chk);
        if (has) copy_bg_to(dir);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

/* nDirect (NextClient yangilovchisi) o'yin ochilganda sborka fonini (bt_*.tga, platform/mmb...) qaytarib qo'yadi.
 * 1) O'yin tilining papkasi (cstrike_russian ...) cstrike dan oldin o'qiladi va nDirect uni kuzatmaydi:
 *    fonni shu yerga o'z nomlari (xcl_*.tga) bilan yozamiz.
 * cstrike/ va platform/ dagi nDirect fayllariga tegilmaydi (ndirect_managed). */
static void lang_bg_dir(const wchar_t *lang)
{
    wchar_t dir[MAX_PATH], src[MAX_PATH], from[MAX_PATH], to[MAX_PATH], sub[MAX_PATH];
    _snwprintf(sub, MAX_PATH, L"cstrike_%s\\resource", lang); sub[MAX_PATH - 1] = 0;
    path_join(dir, g_dir, sub);
    path_join(src, g_dir, L"xc_theme\\cstrike\\resource\\background");
    int n = 0;
    for (int r = 1; r <= 5; r++) for (int c = 1; c <= 8; c++) {
        wchar_t f[32], t[48];
        _snwprintf(f, 32, L"xc_%d_%d.tga", r, c);
        _snwprintf(t, 48, L"background\\xcl_%d_%d.tga", r, c);
        path_join(from, src, f); path_join(to, dir, t);
        if (!file_exists(from)) continue;
        if (!file_exists(to) || !same_file(from, to)) copy_known(from, to);
        n++;
    }
    if (n < 40) return;                              /* fon to'liq bo'lmasa layout yozmaymiz */
    char lay[4096]; size_t len = 0;
    len += _snprintf(lay + len, sizeof(lay) - len, "resolution\t1920\t1080\r\n\r\n");
    for (int r = 1; r <= 5; r++) {
        for (int c = 1; c <= 8; c++)
            len += _snprintf(lay + len, sizeof(lay) - len, "resource/background/xcl_%d_%d.tga\t\tscaled\t\t%d\t%d\r\n", r, c, (c - 1) * 256, (r - 1) * 256);
        len += _snprintf(lay + len, sizeof(lay) - len, "\r\n");
    }
    const wchar_t *names[2] = { L"BackgroundLayout.txt", L"BackgroundLoadingLayout.txt" };
    for (int i = 0; i < 2; i++) {
        path_join(to, dir, names[i]);
        mkdirs_for(to); SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL);
        FILE *f = _wfopen(to, L"wb");
        if (f) { fwrite(lay, 1, len, f); fclose(f); }
    }
}
static void lang_bg(void)
{
    wchar_t lang[32] = L"russian", w[64];
    HKEY k; DWORD sz = sizeof(w), type = 0;
    lang_bg_dir(L"russian");
    lang_bg_dir(L"hd");          /* cstrike_hd ham cstrike dan oldin o'qiladi (HD kontent yoqilgan bo'lsa) - nDirect uni ham kuzatmaydi */
    /* boshqa til tanlangan bo'lsa (Steam/NextClient sozlamasi) - o'sha papkaga ham */
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", 0, KEY_QUERY_VALUE, &k) == ERROR_SUCCESS) {
        if (RegQueryValueExW(k, L"Language", NULL, &type, (BYTE *)w, &sz) == ERROR_SUCCESS && type == REG_SZ) lstrcpynW(lang, w, 32);
        RegCloseKey(k);
    }
    /* O'yin tili inglizcha (yoki yozilmagan) bo'lsa cstrike_<til> papkasi o'qilmaydi va X CLIENT foni ko'rinmaydi.
     * Steam o'rnatilmagan bo'lsa (bu kalit faqat o'yin tilini bildiradi) - ruscha qilib qo'yamiz: o'yin cstrike_russian ni o'qiydi. */
    if (!_wcsicmp(lang, L"russian") || !_wcsicmp(lang, L"english")) {
        BOOL steam = FALSE; wchar_t sp[MAX_PATH]; DWORD spsz = sizeof(sp);
        if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", 0, KEY_QUERY_VALUE, &k) == ERROR_SUCCESS) {
            steam = RegQueryValueExW(k, L"SteamExe", NULL, NULL, (BYTE *)sp, &spsz) == ERROR_SUCCESS;
            RegCloseKey(k);
        }
        if (!steam && RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", 0, NULL, 0, KEY_SET_VALUE, NULL, &k, NULL) == ERROR_SUCCESS) {
            RegSetValueExW(k, L"Language", 0, REG_SZ, (const BYTE *)L"russian", (DWORD)sizeof(L"russian"));
            RegCloseKey(k);
            lstrcpynW(lang, L"russian", 32);
        }
    }
    for (wchar_t *c = lang; *c; c++) if (!((*c >= L'a' && *c <= L'z') || (*c >= L'A' && *c <= L'Z'))) { lang[0] = 0; break; }
    if (lang[0] && _wcsicmp(lang, L"russian") && _wcsicmp(lang, L"english")) lang_bg_dir(lang);
}
/* eski versiyadagi alohida oyna (x-ui, Electron) va .bat endi kerak emas */
static void remove_old_ui(void)
{
    wchar_t p[MAX_PATH + 2] = {0};
    path_join(p, g_dir, L"X CLIENT.bat");
    DeleteFileW(p);
    memset(p, 0, sizeof(p));
    path_join(p, g_dir, L"x-ui");
    if (GetFileAttributesW(p) == INVALID_FILE_ATTRIBUTES) return;
    SHFILEOPSTRUCTW op = {0};
    op.wFunc = FO_DELETE; op.pFrom = p;   /* pFrom ikki marta 0 bilan tugashi kerak */
    op.fFlags = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;
    SHFileOperationW(&op);
}

/* xclient_launcher.cfg har safar qayta yoziladi: eski versiya (Electron oynasi) unga sensitivity, fps_max, pritsel yozgan edi -
 * u o'yin ochilganda eng oxirida bajarilib, menyudagi sozlamalarni bosib ketardi. Sozlamalar config.cfg da qoladi. */
static void ensure_launcher_cfg(void)
{
    wchar_t p[MAX_PATH];
    path_join(p, g_dir, L"cstrike\\xclient_launcher.cfg");
    mkdirs_for(p);
    FILE *f = _wfopen(p, L"wb");
    if (!f) return;
    /* spray: o'zimiznikini serverga yuborish va boshqalarnikini olish - menyuda o'chirib qo'yilgan yoki sborka o'zgartirgan bo'lsa ham */
    fprintf(f, "// X CLIENT\nscr_drawversion \"0\"\ncl_allowupload \"1\"\ncl_allowdownload \"1\"\nhost_framerate \"0\"\ncl_filterstuffcmd \"0\"\n");   /* filterstuffcmd: menyudagi demo yoqib qoldirsa - server menyulari ishlamaydi */   /* host_framerate: menyudagi demo tezligi qolib ketmasin */
    fclose(f);
}

/* NextClient Serverlar/Sozlamalar oynalari rangini resource/schemes/ dagi tanlangan sxemadan oladi;
 * tanlov cstrike/MiscellaneousSettings.vdf dagi "Scheme" kalitida. Birinchi marta X CLIENT sxemasini
 * tanlab qo'yamiz - keyin o'yinchi Sozlamalar > Misc > Color scheme da o'zgartirishi mumkin. */
#define XC_SCHEME "TrackerScheme_XClient.res"
/* cstrike/MiscellaneousSettings.vdf (NextClient KeyValues) dagi bitta kalitni o'rnatadi; boshqa kalitlar saqlanadi */
static BOOL vdf_set(const char *key, const char *val)
{
    wchar_t vdf[MAX_PATH];
    path_join(vdf, g_dir, L"cstrike\\MiscellaneousSettings.vdf");
    char *buf = NULL, *out = NULL, qk[64];
    long n = 0;
    FILE *f = _wfopen(vdf, L"rb");
    if (f) {
        fseek(f, 0, SEEK_END); n = ftell(f); fseek(f, 0, SEEK_SET);
        if (n > 0 && n < 65536 && (buf = (char *)calloc(1, n + 1)) != NULL) fread(buf, 1, n, f);
        fclose(f);
    }
    _snprintf(qk, sizeof(qk), "\"%s\"", key); qk[sizeof(qk) - 1] = 0;
    out = (char *)malloc(n + 512);
    if (!out) { free(buf); return FALSE; }
    char *k = buf ? strstr(buf, qk) : NULL;
    char *close = buf ? strrchr(buf, '}') : NULL;
    if (k) {
        char *eol = strchr(k, '\n');
        size_t pre = (size_t)(k - buf);
        memcpy(out, buf, pre);
        sprintf(out + pre, "%s\t\t\"%s\"\r\n%s", qk, val, eol ? eol + 1 : "");
    } else if (close) {
        size_t pre = (size_t)(close - buf);
        memcpy(out, buf, pre);
        sprintf(out + pre, "\t%s\t\t\"%s\"\r\n%s", qk, val, close);
    } else {
        sprintf(out, "\"MiscellaneousSettings\"\r\n{\r\n\t%s\t\t\"%s\"\r\n}\r\n", qk, val);
    }
    BOOL ok = FALSE;
    if (!buf || strcmp(buf, out)) {
        mkdirs_for(vdf);
        f = _wfopen(vdf, L"wb");
        if (f) { fwrite(out, 1, strlen(out), f); fclose(f); ok = TRUE; }
    } else ok = TRUE;
    free(buf); free(out);
    return ok;
}
static void ensure_scheme(void)
{
    wchar_t ini[MAX_PATH];
    ini_path(ini);
    /* o'yin ochilganda eski Serverlar oynasi o'zi chiqmasin - serverlar X CLIENT menyusida */
    vdf_set("DisableAutoOpenServerBrowser", "1");
    /* X CLIENT rang sxemasi - faqat birinchi marta (keyin o'yinchi o'zgartirishi mumkin) */
    if (!GetPrivateProfileIntW(L"x", L"scheme", 0, ini) && vdf_set("Scheme", XC_SCHEME))
        WritePrivateProfileStringW(L"x", L"scheme", L"1", ini);
}

/* ---------------------------------------------------------------- X CLIENT bosh menyusi (HTML) */
/* NextClient bosh menyuda platform/mmb_home_page.html dagi manzilni (mmb.boost-top.com) butun ekranga ochadi.
 * X CLIENT menyusi (theme/platform/xclient) o'sha saytga yuklanadi; launcher faqat serverlar ro'yxatini beradi. */
#ifndef XC_MASTER_URL
#define XC_MASTER_URL "http://mmb.boost-top.com/ms.php?q=/v1/servers/cstrike"
#endif

static char *read_all(const wchar_t *path, long *len)
{
    FILE *f = _wfopen(path, L"rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    char *b = (n >= 0 && n < (1 << 20)) ? (char *)calloc(1, n + 1) : NULL;
    if (b) fread(b, 1, n, f);
    fclose(f);
    if (len) *len = b ? n : 0;
    return b;
}

/* Sinovda o'yin brauzeri (CEF1) file:/// sahifani ochmadi - xato sahifasi chiqdi. Shuning uchun X CLIENT menyusi
 * saytda (mmb.boost-top.com) turadi va bosh menyu manzili asl holida qoladi. Oldingi versiya yozgan
 * file:/// manzilni shu yerda qaytaramiz. */
#define XC_SITE "http://mmb.boost-top.com/"

/* ---------------------------------------------------------------- Tizim sozlamalari (menyudan) */
/* O'yin ichidagi X CLIENT menyusi (Sozlamalar > Tizim) ularni xc_api.php ga shu kompyuter id'si (g_id)
 * bilan yozadi; XClient.exe har ishga tushganda o'qiydi va bajaradi. */
static int  o_beta = -1, o_auto = 1, o_start = -1, o_win = 0, o_clean = 0, o_verify = 0, o_stretch = 0;   /* o_win: 0 to'liq ekran, 1 oyna, 2 chegarasiz oyna */
static int  o_rsk = 3;                          /* klassik radar foni: 0 asl, 1 qora kontrast, 2 qora + halqalar, 3 taktik to'r (standart), 4 neon, 5 minimal, 6 kontrast kvadrat */
static void radar_skin(int style);              /* xc_radar.c */
static int  o_tune = 1, o_macc = 1, o_bgp = 1, o_dvroff = 0;   /* xc_tune.c: o'yin paytida Windows'ni moslash (menyu > Tizim) */
static int  dvr_state(void);
static void ini_get(const wchar_t *k, wchar_t *out, DWORD cap);
static void ini_str(const wchar_t *k, const wchar_t *v);
static int ini_int(const wchar_t *k);
static void ini_set_int(const wchar_t *k, int v);
/* oddiy kompyuter: 4 tadan kam yadro yoki 6 GB dan kam xotira - F9 buferi (butun o'yin davomida orqada yozish) o'zi yoqilmaydi */
static BOOL pc_weak(void)
{
    MEMORYSTATUSEX ms; ms.dwLength = sizeof(ms); SYSTEM_INFO si; GetSystemInfo(&si);
    return si.dwNumberOfProcessors < 4 || (GlobalMemoryStatusEx(&ms) && (ms.ullTotalPhys >> 20) < 6144);
}
static int  o_prio = 0, o_shots = 0, o_spray = 0, o_sprays = 0, o_ok = 0, o_hud = 100;   /* o_hud: HUD kattaligi, % */   /* o_ok: sozlamalar saytdan olindi */
static char o_res[16] = "", o_packs[256] = "", o_sprayh[72] = "";   /* o_sprayh: spray faylining sha256 (sayt beradi) */

static int jint(const char *b, const char *k, int def)
{
    char key[32];
    _snprintf(key, sizeof(key), "\"%s\":", k); key[sizeof(key) - 1] = 0;
    const char *p = b ? strstr(b, key) : NULL;
    if (!p) return def;
    p += strlen(key);
    if (*p == '"') p++;
    return atoi(p);
}
/* JSON dagi "k":"qiymat" satrini olish (faqat oddiy belgilar) */
static void jstr(const char *b, const char *k, char *out, size_t cap)
{
    char key[40];
    _snprintf(key, sizeof(key), "\"%s\":\"", k); key[sizeof(key) - 1] = 0;
    const char *p = b ? strstr(b, key) : NULL;
    size_t n = 0;
    out[0] = 0;
    if (!p) return;
    for (p += strlen(key); *p && *p != '"' && n + 1 < cap; p++) out[n++] = *p;
    out[n] = 0;
}
/* kompyuter quvvati: menyu shunga qarab grafika sozlamalarini tavsiya qiladi */
static void hw_query(char *out, size_t cap)
{
    MEMORYSTATUSEX ms; ms.dwLength = sizeof(ms);
    SYSTEM_INFO si;
    DISPLAY_DEVICEA dd;
    char gpu[128] = "", eg[256];
    unsigned ram = GlobalMemoryStatusEx(&ms) ? (unsigned)(ms.ullTotalPhys >> 20) : 0;
    GetSystemInfo(&si);
    for (DWORD i = 0; ; i++) {
        ZeroMemory(&dd, sizeof(dd)); dd.cb = sizeof(dd);
        if (!EnumDisplayDevicesA(NULL, i, &dd, 0)) break;
        if (!gpu[0] || (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE)) lstrcpynA(gpu, dd.DeviceString, sizeof(gpu));
        if (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) break;
    }
    url_escape(eg, sizeof(eg), gpu);
    /* Windows nomi va ekran o'lchami (admin paneldagi o'yinchi sahifasi uchun) */
    char win[160] = "Windows", ew[256], ek[96];
    HKEY k;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", 0, KEY_QUERY_VALUE | KEY_WOW64_64KEY, &k) == ERROR_SUCCESS) {
        char pn[96] = "", dv[32] = "", cb[16] = ""; DWORD sz;
        sz = sizeof(pn); RegQueryValueExA(k, "ProductName", NULL, NULL, (BYTE *)pn, &sz);
        sz = sizeof(dv); RegQueryValueExA(k, "DisplayVersion", NULL, NULL, (BYTE *)dv, &sz);
        sz = sizeof(cb); RegQueryValueExA(k, "CurrentBuildNumber", NULL, NULL, (BYTE *)cb, &sz);
        RegCloseKey(k);
        /* Windows 11 ham "Windows 10" deb yoziladi - build 22000+ bo'lsa tuzatamiz */
        if (atoi(cb) >= 22000 && !strncmp(pn, "Windows 10", 10)) pn[9] = '1';
        if (pn[0]) _snprintf(win, sizeof(win), "%s%s%s", pn, dv[0] ? " " : "", dv);
        win[sizeof(win) - 1] = 0;
    }
    url_escape(ew, sizeof(ew), win);
    url_escape(ek, sizeof(ek), g_key[0] ? g_key : "boost-top.com");
    _snprintf(out, cap, "&ram=%u&cpu=%u&gpu=%s&res=%dx%d&os=%s&ch=%s&pt=%s&lang=%s", ram, (unsigned)si.dwNumberOfProcessors, eg,
        GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN), ew, g_chan, ek, (g_lang[0] >= 'a' && g_lang[0] <= 'z') ? g_lang : ""); out[cap - 1] = 0;
}
static unsigned cache_mb(void);
static void vid_list(char *out, size_t cap);   /* xc_rec.c */
static void shot_list(char *out, size_t cap);
static void fetch_opts(void)
{
    char url[6200], hw[800], dm[3200], sl[1800];
    char v[48];
    url_escape(v, sizeof(v), g_version[0] ? g_version : XC_VERSTR);   /* birinchi ochilish - exe versiyasi */
    hw_query(hw, sizeof(hw));
    vid_list(dm, sizeof(dm));                     /* menyudagi "Videolarim" - papkadagi haqiqiy MP4 lar */
    shot_list(sl, sizeof(sl));                    /* va F11 skrinshotlar */
    wchar_t ini[MAX_PATH]; ini_path(ini);
    unsigned cmb = (unsigned)GetPrivateProfileIntW(L"x", L"cachemb", 0, ini);   /* o'yin paytida fonda hisoblangan (cache_maint) */
    wchar_t wcr[24]; char cr[24] = ""; ini_get(L"t_cr", wcr, 24);         /* oxirgi yiqilish: "kod~fayllar" - bir marta yuboriladi */
    WideCharToMultiByte(CP_UTF8, 0, wcr, -1, cr, sizeof(cr), NULL, NULL);
    if (strspn(cr, "0123456789abcdef~") != strlen(cr)) cr[0] = 0;
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=hello&d=%s&v=%s&cache=%u&dvr=%d&safe=%d%s%s%s%s%s", g_id, v, cmb, dvr_state(), ini_int(L"crs") >= 3 ? 1 : 0, cr[0] ? "&cr=" : "", cr, hw, dm, sl); url[sizeof(url) - 1] = 0;
    char *r = http_get(url, NULL);
    if (!r || !strstr(r, "\"ok\":true")) { free(r); return; }
    o_beta = jint(r, "beta", -1); o_auto = jint(r, "auto", 1); o_start = jint(r, "start", -1);
    o_win = jint(r, "win", 0); o_stretch = jint(r, "stretch", 0); o_clean = jint(r, "clean", 0); o_verify = jint(r, "verify", 0);
    o_rsk = jint(r, "rsk", 3); ini_set_int(L"rsk", o_rsk + 1);   /* +1: 0 - "hali yo'q" */
    o_tune = jint(r, "tune", 1); o_macc = jint(r, "macc", 1); o_bgp = jint(r, "bgp", 1); o_dvroff = jint(r, "dvroff", 0);
    if (cr[0]) ini_str(L"t_cr", NULL);
    o_prio = jint(r, "prio", 0); o_hud = jint(r, "hud", 100); o_shots = jint(r, "shots", 0); o_spray = jint(r, "spray", 0); o_sprays = jint(r, "sprays", 0);
    jstr(r, "packs", o_packs, sizeof(o_packs));
    jstr(r, "sprayh", o_sprayh, sizeof(o_sprayh));
    if (strlen(o_sprayh) != 64) o_sprayh[0] = 0;
    o_ok = 1;
    const char *p = strstr(r, "\"res\":\"");
    unsigned w = 0, h = 0;
    if (p && sscanf(p + 7, "%ux%u", &w, &h) == 2 && w >= 640 && w <= 7680 && h >= 480 && h <= 4320) _snprintf(o_res, sizeof(o_res), "%ux%u", w, h);
    free(r);
}
static void opts_done(unsigned cacheMb)
{
    char url[320], v[48];
    url_escape(v, sizeof(v), g_version[0] ? g_version : XC_VERSTR);   /* birinchi ochilish - exe versiyasi */
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=opts_done&d=%s&cache=%u&v=%s", g_id, cacheMb, v); url[sizeof(url) - 1] = 0;
    free(http_get(url, NULL));
}
/* Windows bilan birga ishga tushirish (HKCU\...\Run) */
static void set_autostart(int on)
{
    HKEY k;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_SET_VALUE, &k) != ERROR_SUCCESS) return;
    if (on) {
        wchar_t v[MAX_PATH + 4];
        _snwprintf(v, MAX_PATH + 4, L"\"%s\"", g_self); v[MAX_PATH + 3] = 0;
        RegSetValueExW(k, L"X CLIENT", 0, REG_SZ, (const BYTE *)v, (DWORD)((wcslen(v) + 1) * sizeof(wchar_t)));
    } else RegDeleteValueW(k, L"X CLIENT");
    RegCloseKey(k);
}
static ULONGLONG dir_size(const wchar_t *dir)
{
    wchar_t mask[MAX_PATH], sub[MAX_PATH];
    ULONGLONG n = 0;
    path_join(mask, dir, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return 0;
    do {
        if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue;
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) continue;   /* junction/havola - boshqa papkaga olib chiqadi */
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) { path_join(sub, dir, fd.cFileName); n += dir_size(sub); }
        else n += ((ULONGLONG)fd.nFileSizeHigh << 32) | fd.nFileSizeLow;
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    return n;
}
static unsigned cache_mb(void)
{
    wchar_t d[MAX_PATH];
    path_join(d, g_dir, L"cstrike_downloads");
    return (unsigned)(dir_size(d) >> 20);
}
/* Keshni tozalash: serverlardan yuklangan xarita va fayllar (cstrike_downloads) */
static void clean_cache(void)
{
    wchar_t p[MAX_PATH + 2] = {0};
    path_join(p, g_dir, L"cstrike_downloads");
    if (GetFileAttributesW(p) == INVALID_FILE_ATTRIBUTES) return;
    SHFILEOPSTRUCTW op = {0};
    op.wFunc = FO_DELETE; op.pFrom = p;
    op.fFlags = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;
    SHFileOperationW(&op);
}

/* Avtomatik tozalash (har ishga tushishda): 30 kundan beri yangilanmagan yuklangan fayllar o'chiriladi -
 * kerak bo'lsa server ularni yana beradi. Kesh baribir 3 GB dan oshsa - hammasi tozalanadi. Band fayllar o'tkazib yuboriladi. */
#define AUTOCLEAN_DAYS 30
#define AUTOCLEAN_MAX_MB 3072
static void prune_old(const wchar_t *dir, ULONGLONG cutoff)
{
    wchar_t mask[MAX_PATH], sub[MAX_PATH];
    path_join(mask, dir, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue;
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) continue;   /* junction/havola - tashqaridagi fayllarga tegmaymiz */
        path_join(sub, dir, fd.cFileName);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) { prune_old(sub, cutoff); RemoveDirectoryW(sub); continue; }   /* bo'sh qolsa - papka ham */
        ULONGLONG w = ((ULONGLONG)fd.ftLastWriteTime.dwHighDateTime << 32) | fd.ftLastWriteTime.dwLowDateTime;
        ULONGLONG c = ((ULONGLONG)fd.ftCreationTime.dwHighDateTime << 32) | fd.ftCreationTime.dwLowDateTime;
        if ((w > c ? w : c) < cutoff) DeleteFileW(sub);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
static void auto_clean_cache(void)
{
    wchar_t d[MAX_PATH];
    path_join(d, g_dir, L"cstrike_downloads");
    if (GetFileAttributesW(d) == INVALID_FILE_ATTRIBUTES) return;
    FILETIME now; GetSystemTimeAsFileTime(&now);
    ULONGLONG t = ((ULONGLONG)now.dwHighDateTime << 32) | now.dwLowDateTime;
    /* kuchsiz kompyuter (odatda kichik/sekin disk): 14 kun va 1 GB - xarita yuklanishi tezroq, disk to'lmaydi */
    BOOL weak = pc_weak();
    prune_old(d, t - (ULONGLONG)(weak ? 14 : AUTOCLEAN_DAYS) * 24 * 3600 * 10000000ULL);
    if (cache_mb() > (weak ? 1024 : AUTOCLEAN_MAX_MB)) clean_cache();
}

/* ---------------------------------------------------------------- Kontent (menyudan tanlanadi) */
static BOOL file_exists(const wchar_t *p) { return GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES; }
static int ini_int(const wchar_t *k) { wchar_t ini[MAX_PATH]; ini_path(ini); return GetPrivateProfileIntW(L"x", k, 0, ini); }
static void ini_set_int(const wchar_t *k, int v) { wchar_t ini[MAX_PATH], w[24]; ini_path(ini); _snwprintf(w, 24, L"%d", v); WritePrivateProfileStringW(L"x", k, w, ini); }

/* Spray: menyu tayyorlagan tempdecal.wad ni o'rnatish */
/* O'yin tempdecal.wad ni avval til/qo'shimcha papkalardan (cstrike_russian, cstrike_addon, cstrike_hd ...) qidiradi,
 * shuning uchun spray cstrike\ dagina emas, o'sha papkalarda turgan tempdecal.wad o'rniga ham yoziladi. */
static int spray_targets(wchar_t out[][MAX_PATH], int cap)
{
    int n = 0;
    path_join(out[n++], g_dir, L"cstrike\\tempdecal.wad");
    wchar_t pat[MAX_PATH];
    path_join(pat, g_dir, L"cstrike_*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return n;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || n >= cap) continue;
        wchar_t sub[MAX_PATH];
        _snwprintf(sub, MAX_PATH, L"%s\\tempdecal.wad", fd.cFileName); sub[MAX_PATH - 1] = 0;
        path_join(out[n], g_dir, sub);
        if (file_exists(out[n])) n++;
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    return n;
}
/* o'rnatilgan spray saytdagisi bilan bir xilmi: sha256 bo'yicha (64x64 spraylarning hajmi hammasida bir xil - 6296 bayt,
 * shuning uchun faqat hajm bo'yicha tekshirilsa o'yin/Setup qo'ygan boshqa 64x64 rasm "to'g'ri" bo'lib qolardi) */
static BOOL spray_same(const wchar_t *p)
{
    if (o_sprayh[0]) {
        char h[65]; ULONGLONG sz = 0;
        return sha256_file(p, h, &sz) && sz == (ULONGLONG)o_sprays && !_stricmp(h, o_sprayh);
    }
    WIN32_FILE_ATTRIBUTE_DATA fa;
    return GetFileAttributesExW(p, GetFileExInfoStandard, &fa) && fa.nFileSizeLow == (DWORD)o_sprays;
}
/* custom.hpk - o'yinning spray keshi (o'yinchi spreylari). Kattalashib ketsa buziladi: spraylar boshqa rasm bo'lib
 * yoki umuman ko'rinmaydi. 5 MB dan oshsa o'chiriladi - o'yin uni o'zi qayta yaratadi. */
#define HPK_MAX_BYTES (5u * 1024 * 1024)
static void clean_hpk(void)
{
    wchar_t pat[MAX_PATH], p[MAX_PATH];
    path_join(pat, g_dir, L"cstrike*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) continue;
        wchar_t sub[MAX_PATH];
        _snwprintf(sub, MAX_PATH, L"%s\\custom.hpk", fd.cFileName); sub[MAX_PATH - 1] = 0;
        path_join(p, g_dir, sub);
        WIN32_FILE_ATTRIBUTE_DATA fa;
        if (GetFileAttributesExW(p, GetFileExInfoStandard, &fa) && (fa.nFileSizeHigh || fa.nFileSizeLow > HPK_MAX_BYTES)) {
            SetFileAttributesW(p, FILE_ATTRIBUTE_NORMAL);
            DeleteFileW(p);
        }
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
/* Menyu har o'yinni demo qilib yozadi (cstrike\\xc_*.dem) - disk to'lmasin: eng yangi 40 tasi qoladi, 30 kundan eskisi o'chiriladi */
#define DEMO_KEEP 40
#define DEMO_DAYS 30
typedef struct { wchar_t n[64]; ULONGLONG t; } DemoF;
static int demo_cmp(const void *a, const void *b) { ULONGLONG x = ((const DemoF *)a)->t, y = ((const DemoF *)b)->t; return x < y ? 1 : x > y ? -1 : 0; }
static void prune_demos(void)
{
    wchar_t pat[MAX_PATH], p[MAX_PATH];
    path_join(pat, g_dir, L"cstrike\\xc_*.dem");
    DemoF *l = (DemoF *)malloc(sizeof(DemoF) * 1000); int n = 0;
    if (!l) return;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do {
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || wcslen(fd.cFileName) >= 64 || n >= 1000) continue;
            lstrcpynW(l[n].n, fd.cFileName, 64); l[n].t = ((ULONGLONG)fd.ftLastWriteTime.dwHighDateTime << 32) | fd.ftLastWriteTime.dwLowDateTime; n++;
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    qsort(l, n, sizeof(DemoF), demo_cmp);
    FILETIME now; GetSystemTimeAsFileTime(&now);
    ULONGLONG cut = (((ULONGLONG)now.dwHighDateTime << 32) | now.dwLowDateTime) - (ULONGLONG)DEMO_DAYS * 24 * 3600 * 10000000ULL;
    for (int i = 0; i < n; i++) {
        if (i < DEMO_KEEP && l[i].t >= cut) continue;
        wchar_t sub[MAX_PATH]; _snwprintf(sub, MAX_PATH, L"cstrike\\%s", l[i].n); sub[MAX_PATH - 1] = 0;
        path_join(p, g_dir, sub);
        DeleteFileW(p);
    }
    free(l);
}
static void install_spray(void)
{
    wchar_t dst[16][MAX_PATH], tmp[MAX_PATH];
    char url[256];
    if (o_spray <= 0) return;
    int n = spray_targets(dst, 16);
    if ((o_sprayh[0] || o_spray == ini_int(L"sprayt")) && o_sprays) {   /* o'rnatilgan - lekin o'yin yoki boshqa dastur almashtirgan bo'lsa qayta yozamiz */
        BOOL ok = TRUE;
        for (int i = 0; i < n && ok; i++) ok = spray_same(dst[i]);
        if (ok) { ini_set_int(L"sprayt", o_spray); return; }
    }
    path_join(tmp, g_dir, L"cstrike\\tempdecal.xcdl");
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=spray_get&d=%s", g_id); url[sizeof(url) - 1] = 0;
    status(L"Spray o‘rnatilmoqda...", 1);
    if (!http_download(url, tmp) || (o_sprayh[0] && !spray_same(tmp))) { DeleteFileW(tmp); return; }   /* yarim yoki boshqa fayl kelsa - qo'ymaymiz */
    int done = 0;
    for (int i = 0; i < n; i++) {
        SetFileAttributesW(dst[i], FILE_ATTRIBUTE_NORMAL);
        if (CopyFileW(tmp, dst[i], FALSE)) { SetFileAttributesW(dst[i], FILE_ATTRIBUTE_READONLY); done++; }   /* o'yin ustidan yozib yubormasin */
    }
    DeleteFileW(tmp);
    if (done == n) ini_set_int(L"sprayt", o_spray);
}

/* Paketlar: saytdagi mmb/packs/<id>/files/ o'yin papkasiga ko'chiriladi, asl fayllar xc_backup/<id>/ ga saqlanadi */
static BOOL safe_rel(const char *rel)
{
    if (!rel[0] || rel[0] == '/' || rel[0] == '\\' || strstr(rel, "..") || strchr(rel, ':')) return FALSE;
    return TRUE;
}
static void rel_to_w(const char *rel, wchar_t *out)
{
    MultiByteToWideChar(CP_UTF8, 0, rel, -1, out, MAX_PATH);
    for (wchar_t *c = out; *c; c++) if (*c == L'/') *c = L'\\';
}
static BOOL pack_install(const char *id)
{
    char url[256];
    _snprintf(url, sizeof(url), XC_SITE "packs.php?files=%s", id); url[sizeof(url) - 1] = 0;
    char *list = http_get(url, NULL);
    if (!list) return FALSE;
    wchar_t wid[64], bdir[MAX_PATH], sub[MAX_PATH], lst[MAX_PATH];
    MultiByteToWideChar(CP_UTF8, 0, id, -1, wid, 64);
    _snwprintf(sub, MAX_PATH, L"xc_backup\\%s", wid); sub[MAX_PATH - 1] = 0;
    path_join(bdir, g_dir, sub);
    path_join(lst, bdir, L"_files.txt");
    mkdirs_for(lst);
    FILE *lf = _wfopen(lst, L"ab");
    int n = 0, fails = 0;
    status(L"Paket o‘rnatilmoqda...", 1);
    for (char *line = strtok(list, "\n"); line; line = strtok(NULL, "\n")) {
        char *t1 = strchr(line, '\t'); if (!t1) continue;
        *t1 = 0;
        char *t2 = strchr(t1 + 1, '\t'); if (!t2) continue;
        char *u = t2 + 1, *cr = strchr(u, '\r'); if (cr) *cr = 0;
        /* fayllar faqat shu saytning packs/ papkasidan (javob http orqali keladi - begona manzildan yuklamaymiz) */
        if (!safe_rel(line) || (_strnicmp(u, XC_SITE "packs/", sizeof(XC_SITE "packs/") - 1)
            && _strnicmp(u, "https://mmb.boost-top.com/packs/", 32)) || strstr(u, "..")) continue;
        wchar_t wrel[MAX_PATH], dst[MAX_PATH], bak[MAX_PATH], tmp[MAX_PATH + 8];
        rel_to_w(line, wrel);
        path_join(dst, g_dir, wrel);
        path_join(bak, bdir, wrel);
        if (file_exists(dst) && !file_exists(bak)) { mkdirs_for(bak); CopyFileW(dst, bak, TRUE); }
        mkdirs_for(dst);
        _snwprintf(tmp, MAX_PATH + 8, L"%s.xcdl", dst); tmp[MAX_PATH + 7] = 0;
        if (http_download(u, tmp) && MoveFileExW(tmp, dst, MOVEFILE_REPLACE_EXISTING)) {
            if (lf) fprintf(lf, "%s\n", line);
            n++;
        } else { DeleteFileW(tmp); fails++; }
    }
    if (lf) fclose(lf);
    free(list);
    return n > 0;
}
static void pack_remove(const char *id)
{
    wchar_t wid[64], bdir[MAX_PATH + 2] = {0}, sub[MAX_PATH], lst[MAX_PATH];
    MultiByteToWideChar(CP_UTF8, 0, id, -1, wid, 64);
    _snwprintf(sub, MAX_PATH, L"xc_backup\\%s", wid); sub[MAX_PATH - 1] = 0;
    path_join(bdir, g_dir, sub);
    path_join(lst, bdir, L"_files.txt");
    long len = 0;
    char *b = read_all(lst, &len);
    if (b) {
        for (char *line = strtok(b, "\n"); line; line = strtok(NULL, "\n")) {
            char *cr = strchr(line, '\r'); if (cr) *cr = 0;
            if (!safe_rel(line)) continue;
            wchar_t wrel[MAX_PATH], dst[MAX_PATH], bak[MAX_PATH];
            rel_to_w(line, wrel);
            path_join(dst, g_dir, wrel);
            path_join(bak, bdir, wrel);
            if (file_exists(bak)) CopyFileW(bak, dst, FALSE); else DeleteFileW(dst);
        }
        free(b);
    }
    SHFILEOPSTRUCTW op = {0};
    op.wFunc = FO_DELETE; op.pFrom = bdir;
    op.fFlags = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;
    SHFileOperationW(&op);
}
static BOOL in_list(const char *list, const char *id)
{
    size_t n = strlen(id);
    for (const char *p = list; (p = strstr(p, id)) != NULL; p += n)
        if ((p == list || p[-1] == ',') && (p[n] == 0 || p[n] == ',')) return TRUE;
    return FALSE;
}
static BOOL pack_id_ok(const char *id)
{
    size_t n = strlen(id);
    if (!n || n > 40) return FALSE;
    for (; *id; id++) if (!((*id >= 'a' && *id <= 'z') || (*id >= 'A' && *id <= 'Z') || (*id >= '0' && *id <= '9') || *id == '_' || *id == '-' || *id == '~')) return FALSE;   /* "id~versiya" - admin "hammaga" bergan paket */
    return TRUE;
}
static void apply_packs(void)
{
    wchar_t ini[MAX_PATH], w[256];
    char have[256], now[256] = "", id[48];
    ini_path(ini);
    GetPrivateProfileStringW(L"x", L"packs", L"", w, 256, ini);
    WideCharToMultiByte(CP_UTF8, 0, w, -1, have, sizeof(have), NULL, NULL);
    /* menyuda o'chirilganlarini qaytarib olamiz */
    for (const char *p = have; *p; ) {
        size_t n = strcspn(p, ",");
        if (n && n < sizeof(id)) {
            memcpy(id, p, n); id[n] = 0;
            if (!pack_id_ok(id)) { p += n; if (*p == ',') p++; continue; }   /* id papka nomi bo'ladi - faqat harf/raqam/_- */
            if (!in_list(o_packs, id)) pack_remove(id);
            else { if (now[0]) strcat(now, ","); strcat(now, id); }
        }
        p += n; if (*p == ',') p++;
    }
    /* yangi tanlanganlarini o'rnatamiz */
    for (const char *p = o_packs; *p; ) {
        size_t n = strcspn(p, ",");
        if (n && n < sizeof(id)) {
            memcpy(id, p, n); id[n] = 0;
            if (pack_id_ok(id) && !in_list(now, id) && strlen(now) + n + 2 < sizeof(now) && pack_install(id)) { if (now[0]) strcat(now, ","); strcat(now, id); }
        }
        p += n; if (*p == ',') p++;
    }
    MultiByteToWideChar(CP_UTF8, 0, now, -1, w, 256);
    WritePrivateProfileStringW(L"x", L"packs", w, ini);
}

/* O'yinni tezlashtirish: Windows to'liq ekran "optimizatsiya"sini o'chirish (eski o'yinlarda FPS va kirish kechikishi) */
static void compat_flags(const wchar_t *exe, int on)
{
    HKEY k;
    /* boshqa moslik sozlamalari (RUNASADMIN, HIGHDPIAWARE ...) saqlanadi - faqat o'z belgimizni qo'shamiz/olamiz */
    const wchar_t *tok = L"DISABLEDXMAXIMIZEDWINDOWEDMODE";
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers", 0, NULL, 0, KEY_QUERY_VALUE | KEY_SET_VALUE, NULL, &k, NULL) != ERROR_SUCCESS) return;
    wchar_t cur[512] = L"", out[600] = L""; DWORD sz = sizeof(cur) - sizeof(wchar_t), type = 0;
    LONG qr = RegQueryValueExW(k, exe, NULL, &type, (BYTE *)cur, &sz);
    if (qr == ERROR_MORE_DATA) { RegCloseKey(k); return; }   /* juda uzun qiymat - o'yinchinikiga tegmaymiz */
    if (qr != ERROR_SUCCESS || type != REG_SZ) cur[0] = 0;
    cur[511] = 0;
    BOOL has = FALSE;
    for (wchar_t *ctx = NULL, *t = wcstok_s(cur, L" ", &ctx); t; t = wcstok_s(NULL, L" ", &ctx)) {
        if (!wcscmp(t, L"~")) continue;
        if (!wcscmp(t, tok)) { has = TRUE; if (!on) continue; }
        if (wcslen(out) + wcslen(t) + 2 < 600) { wcscat(out, L" "); wcscat(out, t); }
    }
    if (on && !has && wcslen(out) + wcslen(tok) + 2 < 600) { wcscat(out, L" "); wcscat(out, tok); }
    if (!out[0]) RegDeleteValueW(k, exe);
    else {
        wchar_t val[604]; _snwprintf(val, 604, L"~%s", out); val[603] = 0;
        RegSetValueExW(k, exe, 0, REG_SZ, (const BYTE *)val, (DWORD)((wcslen(val) + 1) * sizeof(wchar_t)));
    }
    RegCloseKey(k);
}

/* 740 (ERROR_ELEVATION_REQUIRED): cstrike.exe xususiyatlarida "Запускать от имени администратора" belgisi qo'yilgan - oddiy
 * CreateProcess ochmaydi (admin: 12 marta "createprocess err=740"). 1) HKCU dagi RUNASADMIN belgisini olib qayta urinamiz;
 * 2) bo'lmasa (HKLM yoki exe manifesti) - Windows ruxsat oynasi (UAC) orqali ochamiz, jarayon handle'i bilan kuzatish davom etadi */
static BOOL drop_runasadmin(const wchar_t *exe)
{
    HKEY k; BOOL changed = FALSE;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers", 0, KEY_QUERY_VALUE | KEY_SET_VALUE, &k) != ERROR_SUCCESS) return FALSE;
    wchar_t cur[512] = L"", out[600] = L""; DWORD sz = sizeof(cur) - sizeof(wchar_t), type = 0;
    if (RegQueryValueExW(k, exe, NULL, &type, (BYTE *)cur, &sz) == ERROR_SUCCESS && type == REG_SZ) {
        cur[511] = 0;
        for (wchar_t *ctx = NULL, *t = wcstok_s(cur, L" ", &ctx); t; t = wcstok_s(NULL, L" ", &ctx)) {
            if (!wcscmp(t, L"~")) continue;
            if (!_wcsicmp(t, L"RUNASADMIN")) { changed = TRUE; continue; }
            if (wcslen(out) + wcslen(t) + 2 < 600) { wcscat(out, L" "); wcscat(out, t); }
        }
        if (changed) {
            if (!out[0]) RegDeleteValueW(k, exe);
            else { wchar_t val[604]; _snwprintf(val, 604, L"~%s", out); val[603] = 0; RegSetValueExW(k, exe, 0, REG_SZ, (const BYTE *)val, (DWORD)((wcslen(val) + 1) * sizeof(wchar_t))); }
        }
    }
    RegCloseKey(k);
    return changed;
}
static BOOL game_spawn(const wchar_t *exe, wchar_t *cmd, STARTUPINFOW *si, PROCESS_INFORMATION *pi)
{
    if (CreateProcessW(exe, cmd, NULL, NULL, FALSE, 0, NULL, g_dir, si, pi)) return TRUE;
    if (GetLastError() != ERROR_ELEVATION_REQUIRED) return FALSE;
    if (drop_runasadmin(exe) && CreateProcessW(exe, cmd, NULL, NULL, FALSE, 0, NULL, g_dir, si, pi)) { prob_send("elev_fixed", 0); return TRUE; }
    /* argumentlar: cmd = "\"exe\" -game ..." - exe qismini tashlab, qolganini beramiz */
    const wchar_t *args = cmd; if (*args == L'"') { args = wcschr(args + 1, L'"'); args = args ? args + 1 : cmd; }
    while (*args == L' ') args++;
    SHELLEXECUTEINFOW sei = { sizeof(sei) };
    sei.fMask = SEE_MASK_NOCLOSEPROCESS; sei.lpVerb = L"runas"; sei.lpFile = exe; sei.lpParameters = args; sei.lpDirectory = g_dir; sei.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&sei) || !sei.hProcess) { SetLastError(ERROR_ELEVATION_REQUIRED); return FALSE; }
    ZeroMemory(pi, sizeof(*pi)); pi->hProcess = sei.hProcess; pi->hThread = NULL; pi->dwProcessId = GetProcessId(sei.hProcess);
    prob_send("elev_uac", 0);
    return TRUE;
}

/* Skrinshotlar: yangi BMP larni JPEG qilib saytga yuklash (menyudagi galereya uchun). GDI+ (Windows bilan keladi) */
typedef struct { UINT32 GdiplusVersion; void *DebugEventCallback; BOOL SuppressBackgroundThread; BOOL SuppressExternalCodecs; } XGdipStartupInput;
int WINAPI GdiplusStartup(ULONG_PTR *token, const XGdipStartupInput *input, void *output);
void WINAPI GdiplusShutdown(ULONG_PTR token);
int WINAPI GdipLoadImageFromFile(const WCHAR *file, void **image);
int WINAPI GdipGetImageWidth(void *image, UINT *w);
int WINAPI GdipGetImageHeight(void *image, UINT *h);
int WINAPI GdipGetImageThumbnail(void *image, UINT w, UINT h, void **thumb, void *cb, void *data);
int WINAPI GdipSaveImageToFile(void *image, const WCHAR *file, const CLSID *encoder, const void *params);
int WINAPI GdipDisposeImage(void *image);
static const CLSID XC_JPEG = { 0x557cf401, 0x1a04, 0x11d3, { 0x9a, 0x73, 0x00, 0x00, 0xf8, 0x1e, 0xf3, 0x2e } };

static char *http_post(const char *path, const void *data, DWORD len)
{
    HINTERNET c = InternetConnectA(g_net, "mmb.boost-top.com", INTERNET_DEFAULT_HTTP_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!c) return NULL;
    HINTERNET r = HttpOpenRequestA(c, "POST", path, NULL, NULL, NULL, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_UI, 0);
    char *out = NULL;
    if (r && HttpSendRequestA(r, "Content-Type: application/octet-stream\r\n", (DWORD)-1L, (LPVOID)data, len)) {
        out = (char *)calloc(1, 4097);
        DWORD got, n = 0;
        while (out && n < 4096 && InternetReadFile(r, out + n, 4096 - n, &got) && got) n += got;
    }
    if (r) InternetCloseHandle(r);
    InternetCloseHandle(c);
    return out;
}
static ULONGLONG ft64(FILETIME t) { return ((ULONGLONG)t.dwHighDateTime << 32) | t.dwLowDateTime; }
static void upload_shots(void)
{
    wchar_t ini[MAX_PATH], w[32], mask[MAX_PATH];
    ini_path(ini);
    GetPrivateProfileStringW(L"x", L"shott", L"0", w, 32, ini);
    ULONGLONG last = _wcstoui64(w, NULL, 10), best[8] = {0}, newest = last;
    wchar_t names[8][MAX_PATH];
    int cnt = 0;
    /* faqat oxirgi 8 ta yangi skrinshot */
    path_join(mask, g_dir, L"cstrike\\*.bmp");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(mask, &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do {
            ULONGLONG t = ft64(fd.ftLastWriteTime);
            if (t <= last || fd.nFileSizeLow < 100000 || (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) continue;
            int slot = cnt < 8 ? cnt++ : -1;
            if (slot < 0) { slot = 0; for (int i = 1; i < 8; i++) if (best[i] < best[slot]) slot = i; if (best[slot] >= t) continue; }
            best[slot] = t; { wchar_t cs[MAX_PATH]; path_join(cs, g_dir, L"cstrike"); path_join(names[slot], cs, fd.cFileName); }
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    if (!cnt) return;
    ULONG_PTR tok = 0;
    XGdipStartupInput in = { 1, NULL, FALSE, FALSE };
    if (GdiplusStartup(&tok, &in, NULL) != 0) return;
    status(L"Skrinshotlar yuklanmoqda...", 1);
    wchar_t tmp[MAX_PATH];
    path_join(tmp, g_dir, L"xc_shot.tmp.jpg");
    for (int i = 0; i < cnt; i++) {
        void *img = NULL, *th = NULL;
        UINT iw = 0, ih = 0;
        if (GdipLoadImageFromFile(names[i], &img) != 0 || !img) continue;
        GdipGetImageWidth(img, &iw); GdipGetImageHeight(img, &ih);
        if (iw > 1280 && ih) { UINT tw = 1280, thh = (UINT)((ULONGLONG)ih * 1280 / iw); if (GdipGetImageThumbnail(img, tw, thh, &th, NULL, NULL) != 0) th = NULL; }
        int ok = GdipSaveImageToFile(th ? th : img, tmp, &XC_JPEG, NULL) == 0;
        if (th) GdipDisposeImage(th);
        GdipDisposeImage(img);
        long len = 0;
        char *jpg = ok ? read_all(tmp, &len) : NULL;
        DeleteFileW(tmp);
        if (!jpg) continue;
        char path[160];
        _snprintf(path, sizeof(path), "/xc_api.php?a=shot_up&d=%s", g_id); path[sizeof(path) - 1] = 0;
        free(http_post(path, jpg, (DWORD)len));
        free(jpg);
        if (best[i] > newest) newest = best[i];
    }
    GdiplusShutdown(tok);
    _snwprintf(w, 32, L"%I64u", newest);
    WritePrivateProfileStringW(L"x", L"shott", w, ini);
}

/* X CLIENT menyusi saytda alohida manzilda: http://mmb.boost-top.com/xc.html. index.html - boshqa boost-top sborkalari
 * uchun (ular ham shu saytni ochadi), shuning uchun X CLIENT menyusi faqat shu launcher o'rnatgan o'yinda chiqadi.
 * Asl manzil bir marta platform/mmb_home_page.orig ga saqlanadi (o'chirishda qaytariladi). O'yin brauzeri "?..."
 * qo'shimchali manzilni ocholmaydi - shuning uchun alohida fayl nomi. Kompyuter id'si menyuga sayt orqali (IP) yetadi. */
#define XC_HOME XC_SITE "xc.html"
static void setup_main_menu(void)
{
    wchar_t home[MAX_PATH], orig[MAX_PATH];
    path_join(home, g_dir, L"platform\\mmb_home_page.html");
    path_join(orig, g_dir, L"platform\\mmb_home_page.orig");
    long n = 0;
    char *cur = read_all(home, &n);
    if (cur && !strstr(cur, XC_HOME)) {
        if (GetFileAttributesW(orig) == INVALID_FILE_ATTRIBUTES && !strstr(cur, "xclient") && !strstr(cur, "?xc=")) {
            FILE *o = _wfopen(orig, L"wb");
            if (o) { fwrite(cur, 1, n, o); fclose(o); }
        }
    }
    if (!cur || !strstr(cur, XC_HOME)) {
        mkdirs_for(home);
        SetFileAttributesW(home, FILE_ATTRIBUTE_NORMAL);
        FILE *f = _wfopen(home, L"wb");
        if (f) { fputs(XC_HOME, f); fclose(f); }
    }
    free(cur);
}

/* Internet serverlar ro'yxati + versiya -> platform/xclient/master.js (sahifa o'zi tashqi saytga XHR qila olmasligi mumkin) */
static void write_master_js(void)
{
    wchar_t p[MAX_PATH];
    path_join(p, g_dir, L"platform\\xclient\\master.js");
    char *body = http_get(XC_MASTER_URL, NULL);
    if (!body && GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES) return;   /* eski ro'yxat qolsin */
    mkdirs_for(p);
    FILE *f = _wfopen(p, L"wb");
    if (!f) { free(body); return; }
    fprintf(f, "// X CLIENT launcher tomonidan yoziladi\nwindow.XC_VERSION = \"%s\";\nwindow.XC_MASTER = [", g_version);
    int cnt = 0;
    for (char *line = body; line && *line && cnt < 1000;) {
        char *next = strchr(line, '\n');
        if (next) *next++ = 0;
        char kind[8], addr[64];
        unsigned a, b, c, d2, port;
        if (sscanf(line, " %7s %63s", kind, addr) == 2 && (!strcmp(kind, "gs") || !strcmp(kind, "ip"))
            && sscanf(addr, "%u.%u.%u.%u:%u", &a, &b, &c, &d2, &port) == 5 && a < 256 && b < 256 && c < 256 && d2 < 256 && port < 65536)
            fprintf(f, "%s\"%u.%u.%u.%u:%u\"", cnt++ ? "," : "", a, b, c, d2, port);
        line = next;
    }
    fprintf(f, "];\n");
    fclose(f);
    free(body);
}

static BOOL g_fresh = FALSE;
/* ---------------------------------------------------------------- HUD kattaligi */
/* O'yinda HUD'ni kattalashtiradigan sozlama yo'q: CS 1.6 raqamlar, pul, o'q va qurol rasmlarini
 * sprites\640hud(N).spr dan, joylashuvini sprites\(nom).txt dagi to'rtburchaklardan oladi. Shu rasmlarni
 * kattalashtirib, to'rtburchaklarni ham shuncha ko'paytirsak - butun HUD kattalashadi.
 * Asl fayllar xc_backup\hud\<papka>\ ga bir marta saqlanadi va har safar o'shalardan yasaladi. */
static int sc_i(int v, int pct) { return v >= 0 ? (v * pct + 50) / 100 : -((-v * pct + 50) / 100); }

static BOOL spr_scale(const char *in, long n, int pct, char **out, long *outLen)
{
    if (n < 44 || memcmp(in, "IDSP", 4) || *(const int *)(in + 4) != 2) return FALSE;
    int frames = *(const int *)(in + 28);
    unsigned short pal = *(const unsigned short *)(in + 40);
    long off = 42 + pal * 3L;
    if (frames < 1 || frames > 64 || off > n) return FALSE;
    long cap = off + 64;
    /* avval kirishni tekshirib, chiqish hajmini hisoblaymiz */
    long o = off;
    for (int f = 0; f < frames; f++) {
        if (o + 20 > n || *(const int *)(in + o) != 0) return FALSE;   /* guruh kadrlari - tegmaymiz */
        int w = *(const int *)(in + o + 12), h = *(const int *)(in + o + 16);
        if (w <= 0 || h <= 0 || w > 1024 || h > 1024 || o + 20 + (long)w * h > n) return FALSE;
        cap += 20 + (long)sc_i(w, pct) * sc_i(h, pct);
        o += 20 + (long)w * h;
    }
    char *b = (char *)malloc(cap);
    if (!b) return FALSE;
    memcpy(b, in, off);
    *(int *)(b + 20) = sc_i(*(const int *)(in + 20), pct);   /* umumiy kenglik/balandlik */
    *(int *)(b + 24) = sc_i(*(const int *)(in + 24), pct);
    long d = off; o = off;
    for (int f = 0; f < frames; f++) {
        int w = *(const int *)(in + o + 12), h = *(const int *)(in + o + 16);
        int w2 = sc_i(w, pct), h2 = sc_i(h, pct);
        *(int *)(b + d) = 0;
        *(int *)(b + d + 4) = sc_i(*(const int *)(in + o + 4), pct);
        *(int *)(b + d + 8) = sc_i(*(const int *)(in + o + 8), pct);
        *(int *)(b + d + 12) = w2; *(int *)(b + d + 16) = h2;
        const unsigned char *src = (const unsigned char *)in + o + 20;
        unsigned char *dst = (unsigned char *)b + d + 20;
        for (int y = 0; y < h2; y++) {
            int sy = y * h / h2;
            for (int x = 0; x < w2; x++) dst[y * w2 + x] = src[sy * w + x * w / w2];
        }
        d += 20 + (long)w2 * h2; o += 20 + (long)w * h;
    }
    *out = b; *outLen = d;
    return TRUE;
}

/* "nom 640 640hudN x y w h" qatorlaridagi x y w h ni ko'paytiradi; boshqa qatorlar o'zgarmaydi */
static char *txt_scale(const char *in, int pct, BOOL *changed)
{
    size_t n = strlen(in);
    char *b = (char *)malloc(n * 2 + 64), *d = b;
    if (!b) return NULL;
    *changed = FALSE;
    for (const char *p = in; *p; ) {
        const char *e = strchr(p, '\n');
        size_t L = e ? (size_t)(e - p + 1) : strlen(p);
        char line[256], name[64], spr[64]; int res, x, y, w, h;
        if (L < sizeof(line)) {
            memcpy(line, p, L); line[L] = 0;
            if (sscanf(line, "%63s %d %63s %d %d %d %d", name, &res, spr, &x, &y, &w, &h) == 7 && res == 640 && !_strnicmp(spr, "640hud", 6)) {
                d += sprintf(d, "%s\t%d\t%s\t%d\t%d\t%d\t%d\r\n", name, res, spr, sc_i(x, pct), sc_i(y, pct), sc_i(w, pct), sc_i(h, pct));
                *changed = TRUE; p += L; continue;
            }
        }
        memcpy(d, p, L); d += L; p += L;
    }
    *d = 0;
    return b;
}

static void hud_scale_dir(const wchar_t *sub, int pct)
{
    wchar_t dir[MAX_PATH], bak[MAX_PATH], st[MAX_PATH], pat[MAX_PATH], tmp[MAX_PATH];
    path_join(dir, g_dir, sub);
    _snwprintf(tmp, MAX_PATH, L"xc_backup\\hud\\%s", sub); tmp[MAX_PATH - 1] = 0;
    path_join(bak, g_dir, tmp);
    path_join(st, bak, L"_scale.txt");
    int was = 100;
    { long l = 0; char *s = read_all(st, &l); if (s) { was = atoi(s); free(s); } }
    if (was <= 0) was = 100;
    if (was == pct) return;
    path_join(pat, dir, L"*.*");
    WIN32_FIND_DATAW fd;
    HANDLE hf = FindFirstFileW(pat, &fd);
    if (hf == INVALID_HANDLE_VALUE) return;
    mkdirs_for(st);
    do {
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) continue;
        const wchar_t *ext = wcsrchr(fd.cFileName, L'.');
        BOOL isSpr = ext && !_wcsicmp(ext, L".spr") && !_wcsnicmp(fd.cFileName, L"640hud", 6);
        BOOL isTxt = ext && !_wcsicmp(ext, L".txt");
        if (!isSpr && !isTxt) continue;
        wchar_t cur[MAX_PATH], org[MAX_PATH];
        path_join(cur, dir, fd.cFileName);
        path_join(org, bak, fd.cFileName);
        if (!file_exists(org)) {                              /* asl nusxa hali yo'q: hozirgisi asl (was==100 bo'lsa) */
            if (was != 100) continue;
            if (isTxt) { long l = 0; char *t = read_all(cur, &l); BOOL ch = FALSE; char *x = t ? txt_scale(t, 100, &ch) : NULL; free(t); free(x); if (!ch) continue; }
            CopyFileW(cur, org, TRUE);
        }
        if (pct == 100) { CopyFileW(org, cur, FALSE); continue; }
        long l = 0; char *src = read_all(org, &l), *res = NULL; long rl = 0;
        if (!src) continue;
        if (isSpr) { if (!spr_scale(src, l, pct, &res, &rl)) res = NULL; }
        else { BOOL ch = FALSE; res = txt_scale(src, pct, &ch); rl = res ? (long)strlen(res) : 0; if (!ch) { free(res); res = NULL; } }
        free(src);
        if (!res) continue;
        SetFileAttributesW(cur, FILE_ATTRIBUTE_NORMAL);
        FILE *f = _wfopen(cur, L"wb");
        if (f) { fwrite(res, 1, rl, f); fclose(f); }
        free(res);
    } while (FindNextFileW(hf, &fd));
    FindClose(hf);
    FILE *f = _wfopen(st, L"wb");
    if (f) { fprintf(f, "%d", pct); fclose(f); }
}
static void hud_scale(void)
{
    int pct = o_hud == 150 || o_hud == 200 || o_hud == 125 ? o_hud : 100;
    hud_scale_dir(L"cstrike\\sprites", pct);
    wchar_t ru[MAX_PATH];
    path_join(ru, g_dir, L"cstrike_russian\\sprites\\hud.txt");
    if (file_exists(ru)) hud_scale_dir(L"cstrike_russian\\sprites", pct);
}

/* O'yin brauzeri (CEF) menyuni (mmb.boost-top.com/index.html) htmlcache dan soatlab ochishi mumkin - yangi menyu ko'rinmay qoladi.
 * Launcher yangi versiyaga o'tganda keshni bir marta tozalaymiz (sozlamalar va kirish saytdan qayta tiklanadi). */
static void clear_menu_cache(void)
{
    wchar_t ini[MAX_PATH], p[MAX_PATH + 2] = {0};
    ini_path(ini);
    int done = GetPrivateProfileIntW(L"x", L"cachebuild", 0, ini);
    if (GetPrivateProfileIntW(L"x", L"mhfix", 0, ini)) { done = -1; WritePrivateProfileStringW(L"x", L"mhfix", NULL, ini); }   /* menyu sayti tuzaldi - eski (buzilgan) javob xotirada qolmasin */
    if (done == g_build || g_build <= 0) return;
    path_join(p, g_dir, L"htmlcache");
    if (GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES) {
        SHFILEOPSTRUCTW op = {0};
        op.wFunc = FO_DELETE; op.pFrom = p;   /* pFrom ikki marta 0 bilan tugaydi */
        op.fFlags = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT;
        SHFileOperationW(&op);
    }
    wchar_t w[24]; _snwprintf(w, 24, L"%d", g_build);
    WritePrivateProfileStringW(L"x", L"cachebuild", w, ini);
}

/* O'yin allaqachon ochiqmi (shu papkadagi hl.exe / cstrike.exe). Ishlab turgan bo'lsa - oynasini oldinga chiqaramiz,
 * qotib qolgan yoki oynasiz orqada qolgan bo'lsa (CS "already running" deb ochilmay qoladi) - so'rab, yopamiz. */
typedef struct { DWORD pid; HWND wnd; } GameWnd;
static BOOL CALLBACK game_wnd_cb(HWND w, LPARAM lp)
{
    GameWnd *g = (GameWnd *)lp; DWORD pid = 0;
    GetWindowThreadProcessId(w, &pid);
    if (pid == g->pid && IsWindowVisible(w) && !GetWindow(w, GW_OWNER)) { g->wnd = w; return FALSE; }
    return TRUE;
}
/* O'yin papkasidan ishga tushgan hamma jarayonlar (hl.exe, cstrike.exe va o'yin brauzerining yordamchi jarayonlari -
 * o'yin qulaganda ular orqada qolib, CS ni "already running" deb ochilmaydigan qilib qo'yadi). Launcherning o'zi kirmaydi. */
static int game_procs(HANDLE out[], wchar_t names[][64], int cap)
{
    int n = 0;
    size_t dl = wcslen(g_dir);
    if (dl <= 3) return 0;                                  /* o'yin disk ildizida (D:\) - butun diskdagi jarayonlarni o'yin deb olmaymiz */
    DWORD me = GetCurrentProcessId();
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;
    PROCESSENTRY32W pe; pe.dwSize = sizeof(pe);
    for (BOOL ok = Process32FirstW(snap, &pe); ok && n < cap; ok = Process32NextW(snap, &pe)) {
        if (pe.th32ProcessID == me || !_wcsicmp(pe.szExeFile, XC_EXE) || !_wcsicmp(pe.szExeFile, XC_EXE_LEGACY)
            || !_wcsnicmp(pe.szExeFile, L"XClient-Uninstall", 17) || !_wcsnicmp(pe.szExeFile, L"unins", 5)
            || !_wcsicmp(pe.szExeFile, L"hlds.exe") || !_wcsicmp(pe.szExeFile, L"hltv.exe")) continue;   /* server/HLTV - o'yin emas */
        /* faqat so'rash huquqi: o'yin administrator sifatida ochilgan bo'lsa ham ko'rinsin (yopish huquqi keyin, "Ha" dan so'ng) */
        HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, pe.th32ProcessID);
        if (!h) continue;
        wchar_t img[MAX_PATH]; DWORD il = MAX_PATH;
        if (QueryFullProcessImageNameW(h, 0, img, &il) && il > dl && !_wcsnicmp(img, g_dir, dl) && (img[dl] == L'\\' || img[dl] == L'/')) {
            lstrcpynW(names[n], pe.szExeFile, 64);
            out[n++] = h;
        } else CloseHandle(h);
    }
    CloseHandle(snap);
    return n;
}
/* TRUE - o'yinni ochish mumkin, FALSE - ochmaymiz (ishlab turgan oynasi oldinga chiqarildi yoki o'yinchi "Yo'q" dedi) */
static BOOL handle_running_game(void)
{
    HANDLE ph[16]; wchar_t nm[16][64];
    int n = game_procs(ph, nm, 16);
    if (!n) return TRUE;
    wchar_t list[256] = L"";
    for (int i = 0; i < n && wcslen(list) < 180; i++) { if (i) wcscat(list, L", "); wcscat(list, nm[i]); }
    HWND live = NULL; BOOL hung = FALSE;
    for (int i = 0; i < n; i++) {
        if (_wcsicmp(nm[i], L"hl.exe") && _wcsicmp(nm[i], L"cstrike.exe")) continue;   /* oyna holati - faqat o'yinning o'zi */
        GameWnd g = { GetProcessId(ph[i]), NULL };
        EnumWindows(game_wnd_cb, (LPARAM)&g);
        if (g.wnd) { if (IsHungAppWindow(g.wnd)) hung = TRUE; else live = g.wnd; }
    }
    BOOL go = TRUE;
    if (live && !hung) {
        if (IsIconic(live)) ShowWindow(live, SW_RESTORE);
        SetForegroundWindow(live);
        go = FALSE;
    } else {
        wchar_t q[512];
        _snwprintf(q, 512, L"O‘yin oldingi safardan ochiq qolgan yoki qotib qolgan (%s).\nUni yopib, qayta ochaymi?\n\n"
                           L"Игра осталась открытой или зависла. Закрыть и запустить заново?", list);
        q[511] = 0;
        /* g_wnd ustida: launcher oynasi (topmost) so'rovni yopib qo'ymasin; xarita yuklanayotgan sog' o'yin ham "qotgan" ko'rinishi mumkin - standart "Yo'q" */
        if (MessageBoxW(g_wnd, q, L"X CLIENT", MB_YESNO | MB_ICONQUESTION | MB_SETFOREGROUND | MB_TOPMOST | MB_DEFBUTTON2) != IDYES) go = FALSE;
    }
    if (go && !(live && !hung)) {
        BOOL denied = FALSE;
        for (int i = 0; i < n; i++) {
            HANDLE t = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, GetProcessId(ph[i]));
            if (t) { TerminateProcess(t, 1); WaitForSingleObject(t, 5000); CloseHandle(t); } else denied = TRUE;
        }
        Sleep(500);
        if (denied) {
            MessageBoxW(g_wnd, L"O‘yinni yopib bo‘lmadi (administrator sifatida ochilgan). Диспетчер задач orqali yoping yoki kompyuterni qayta yoqing.\n\n"
                               L"Не удалось закрыть игру (запущена от администратора). Закройте её через диспетчер задач.", L"X CLIENT", MB_ICONWARNING | MB_TOPMOST);
            go = FALSE;
        }
    }
    for (int i = 0; i < n; i++) CloseHandle(ph[i]);
    return go;
}

#include "xc_rec.c"   /* F10: o'yinni MP4 qilib yozish */
#include "xc_radar.c" /* radar xaritasi: overview'i yo'q xaritalar uchun */
#include "xc_tune.c"  /* o'yin paytida Windows'ni moslash, yiqilishni tuzatish */

/* yuklangan fayllar (cstrike_downloads) - 30 kundan eskilari va hajmi: o'yin yopilgandan keyin (o'yin papkadan foydalanmayotganda).
 * Oldin o'yin ochilishidan OLDIN papka uch marta aylanib chiqilardi (minglab fayl - bir necha soniya) */
static DWORD WINAPI cache_maint(LPVOID unused)
{
    (void)unused;
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    auto_clean_cache();
    ini_set_int(L"cachemb", (int)cache_mb());
    return 0;
}
/* exe ochilmadi (o'yin yoki yangilangan launcher). Ko'pincha sabab - antivirus faylni to'xtatgan yoki karantinga olgan:
 * o'yinchiga nima qilishni aniq aytamiz (aks holda "launcher ochilmayapti" deyishadi va sababini bilishmaydi) */
static void start_failed(const wchar_t *exe, DWORD err)
{
    ini_set_int(L"autover", 1);                    /* 7. o'yin ochilmadi - keyingi safar fayllar tekshiriladi */
    const wchar_t *nm = wcsrchr(exe, L'\\'); nm = nm ? nm + 1 : exe;
    { char raw[160], n8[64]; WideCharToMultiByte(CP_UTF8, 0, nm, -1, n8, sizeof(n8), NULL, NULL);
      _snprintf(raw, sizeof(raw), "createprocess err=%lu exe=%s", (unsigned long)err, n8); raw[sizeof(raw) - 1] = 0;
      url_escape(g_probx, sizeof(g_probx), raw); prob_send("proc_fail", 3000); g_probx[0] = 0; }
    wchar_t m[900];
    if (err == ERROR_BAD_EXE_FORMAT || err == 216 || err == 1392 || err == 0xC1) {
        /* 193 - fayl buzilgan (Windows uni dastur deb tanimaydi): antivirus "tozalab" qo'ygan yoki chala yuklangan.
         * Buzilgan nusxa chetga olinadi - keyingi ochilishda launcher o'yinni o'zi qayta o'rnatadi (has_game() = yo'q) */
        wchar_t bad[MAX_PATH + 8]; _snwprintf(bad, MAX_PATH + 8, L"%s.bad", exe); bad[MAX_PATH + 7] = 0;
        BOOL moved = MoveFileExW(exe, bad, MOVEFILE_REPLACE_EXISTING);
        _snwprintf(m, 900, L"%s fayli buzilgan (xato %lu) - ko‘pincha antivirus uni «tozalab» qo‘yadi yoki fayl chala yuklangan.\n\n"
            L"%s\n\nAntivirusda o‘yin papkasini istisnoga qo‘shing: %s\n\n"
            L"Файл %s повреждён (ошибка %lu) - обычно его «вылечил» антивирус или файл скачан не полностью. %s Добавьте папку игры в исключения антивируса.",
            nm, (unsigned long)err,
            moved ? L"X CLIENT uni o‘zi tiklaydi: OK ni bosing va X CLIENT ni qayta oching - o‘yin qayta o‘rnatiladi (sozlamalar saqlanadi)." : L"X CLIENT ni saytdan qayta o‘rnating.",
            g_dir, nm, (unsigned long)err, moved ? L"Откройте X CLIENT снова - игра будет переустановлена." : L"Переустановите X CLIENT с сайта.");
    }
    else if (err == ERROR_ELEVATION_REQUIRED)
        _snwprintf(m, 900, L"%s administrator huquqini talab qilyapti (xato 740) va Windows ruxsat oynasida «Да» bosilmadi.\n\n"
            L"Tuzatish: X CLIENT ni qayta oching va Windows so‘raganda «Да» ni bosing. Yoki: %s → o‘ng tugma → Свойства → Совместимость → «Запускать от имени администратора» belgisini olib tashlang.\n\n"
            L"%s требует прав администратора (ошибка 740). Снова откройте X CLIENT и нажмите «Да» в окне Windows, или снимите галочку «Запускать от имени администратора» в свойствах файла.",
            nm, nm, nm);
    else if (err == 225 || err == 226 || err == ERROR_ACCESS_DENIED || err == ERROR_FILE_NOT_FOUND || err == ERROR_PATH_NOT_FOUND || err == 1260)
        _snwprintf(m, 900, L"%s ni ochib bo‘lmadi (xato %lu). Ko‘pincha sabab - antivirus faylni to‘xtatgan yoki karantinga olgan.\n\n"
            L"Tuzatish: antivirusni oching → «Karantin» → %s ni toping → «Tiklash» va «Istisnolarga qo‘shish». Keyin X CLIENT ni qayta oching.\n\n"
            L"Не удалось запустить %s (ошибка %lu). Обычно файл заблокировал или поместил в карантин антивирус.\n"
            L"Откройте антивирус → «Карантин» → найдите %s → «Восстановить» и «Добавить в исключения», затем снова откройте X CLIENT.",
            nm, (unsigned long)err, nm, nm, (unsigned long)err, nm);
    else _snwprintf(m, 900, L"%s ni ochib bo‘lmadi (xato %lu). Kompyuterni qayta yoqib ko‘ring.\n\nНе удалось запустить %s (ошибка %lu). Перезагрузите компьютер.",
            nm, (unsigned long)err, nm, (unsigned long)err);
    m[899] = 0;
    MessageBoxW(NULL, m, L"X CLIENT", MB_ICONWARNING | MB_SETFOREGROUND);
}

/* O'yin oynasi (taskbar, Alt+Tab, sarlavha) - X CLIENT belgisi. O'yin o'z ikonkasini qo'yadi va video rejim almashganda
 * qayta qo'yishi mumkin, shuning uchun o'yin davomida 5 soniyada bir tekshiramiz (arzon: bitta xabar). Ikonka launcher
 * jarayonida yaratiladi - launcher o'yin yopilguncha ishlab turadi, shuning uchun u o'chib qolmaydi */
typedef struct { DWORD pid; HWND w; } GameWin;
static volatile LONG g_game_seen = 0;   /* o'yin oynasi paydo bo'ldimi (ishga tushishdagi xatoni o'yin ichidagi yiqilishdan ajratish) */
static BOOL CALLBACK game_win_cb(HWND h, LPARAM l)
{
    GameWin *g = (GameWin *)l; DWORD pid = 0;
    GetWindowThreadProcessId(h, &pid);
    if (pid == g->pid && IsWindowVisible(h) && !GetWindow(h, GW_OWNER)) { RECT r; GetWindowRect(h, &r); if (r.right - r.left >= 320) { g->w = h; return FALSE; } }
    return TRUE;
}
static DWORD WINAPI game_icon_thread(LPVOID arg)
{
    HANDLE proc = (HANDLE)arg;
    HINSTANCE hi = GetModuleHandleW(NULL);
    HICON big = (HICON)LoadImageW(hi, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), 0);
    HICON sm = (HICON)LoadImageW(hi, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), 0);
    if (!big || !sm) return 0;
    /* O'yin oynasiga xabar yuborish uning kadr aylanishiga tegadi - o'yin davomida doimiy tekshirmaymiz (5 soniyada bir
     * WM_SETICON qotish berardi). Oyna topilgach faqat bir necha marta: darhol, 15 s, 60 s, 3 daqiqadan keyin (video rejim o'rnashguncha) */
    GameWin g; g.pid = GetProcessId(proc);
    static const DWORD waits[] = { 2000, 15000, 45000, 120000 };
    int found = 0, k = 0;
    for (int i = 0; i < 60 && !found; i++) {                          /* oynani 2 daqiqagacha kutamiz */
        if (WaitForSingleObject(proc, 2000) != WAIT_TIMEOUT) goto out;
        g.w = NULL; EnumWindows(game_win_cb, (LPARAM)&g); found = g.w != NULL;
    }
    if (found) { InterlockedExchange(&g_game_seen, 1); fn_send("game"); }
    for (k = 0; found && k < 4; k++) {
        if (WaitForSingleObject(proc, waits[k]) != WAIT_TIMEOUT) break;
        g.w = NULL; EnumWindows(game_win_cb, (LPARAM)&g);
        if (!g.w) continue;
        DWORD_PTR cur = 0;
        if (!SendMessageTimeoutW(g.w, WM_GETICON, ICON_BIG, 0, SMTO_ABORTIFHUNG, 300, &cur) || (HICON)cur != big) {
            SendMessageTimeoutW(g.w, WM_SETICON, ICON_BIG, (LPARAM)big, SMTO_ABORTIFHUNG, 300, NULL);
            SendMessageTimeoutW(g.w, WM_SETICON, ICON_SMALL, (LPARAM)sm, SMTO_ABORTIFHUNG, 300, NULL);
        }
    }
    WaitForSingleObject(proc, INFINITE);                              /* ikonkalar o'yin yopilguncha yashashi kerak */
out:
    CloseHandle(proc);
    DestroyIcon(big); DestroyIcon(sm);
    return 0;
}

/* qaytaradi TRUE - o'yin yiqildi va o'yinchi "qayta ochish" ni tanladi */
/* O'yin ishga tushishda yiqilsa - Windows "Application" jurnalidagi oxirgi "Application Error" (1000) yozuvidan
 * qaysi modul (DLL) yiqilganini olamiz: "mod=nvoglv32.dll code=c0000005 off=0001a2b3 app=cstrike.exe". Admin > Muammolar */
static void crash_detail(char *out, size_t cap, DWORD since)
{
    out[0] = 0;
    HANDLE ev = OpenEventLogW(NULL, L"Application");
    if (!ev) { lstrcpynA(out, "nolog", (int)cap); return; }
    static BYTE buf[65536]; DWORD rd = 0, need = 0; int seen = 0;
    while (!out[0] && seen < 400 && ReadEventLogW(ev, EVENTLOG_BACKWARDS_READ | EVENTLOG_SEQUENTIAL_READ, 0, buf, sizeof(buf), &rd, &need)) {
        for (BYTE *p = buf; p < buf + rd && !out[0]; p += ((EVENTLOGRECORD *)p)->Length) {
            EVENTLOGRECORD *r = (EVENTLOGRECORD *)p; seen++;
            if (r->TimeGenerated + 5 < since) { seen = 9999; break; }          /* bu ishga tushirishdan oldingilar */
            if ((r->EventID & 0xFFFF) != 1000 || r->NumStrings < 7) continue;
            const wchar_t *src = (const wchar_t *)(p + sizeof(EVENTLOGRECORD));
            if (_wcsicmp(src, L"Application Error")) continue;
            const wchar_t *st[12] = {0}; const wchar_t *q = (const wchar_t *)(p + r->StringOffset);
            for (int i = 0; i < (int)r->NumStrings && i < 12; i++) { st[i] = q; q += wcslen(q) + 1; }
            if (!st[0] || (_wcsicmp(st[0], L"cstrike.exe") && _wcsicmp(st[0], L"hl.exe"))) continue;
            char a[64], m[96], c[24], o[24];
            WideCharToMultiByte(CP_UTF8, 0, st[0], -1, a, sizeof(a), NULL, NULL);
            WideCharToMultiByte(CP_UTF8, 0, st[3] ? st[3] : L"?", -1, m, sizeof(m), NULL, NULL);
            WideCharToMultiByte(CP_UTF8, 0, st[6] ? st[6] : L"?", -1, c, sizeof(c), NULL, NULL);
            WideCharToMultiByte(CP_UTF8, 0, st[7] ? st[7] : L"?", -1, o, sizeof(o), NULL, NULL);
            char raw[200]; _snprintf(raw, sizeof(raw), "mod=%s code=%s off=%s app=%s", m, c, o, a); raw[sizeof(raw) - 1] = 0;
            lstrcpynA(g_cmod, m, sizeof(g_cmod));
            url_escape(out, cap, raw);
        }
    }
    CloseEventLog(ev);
    /* ishga tushish xatosi (loader) ko'pincha "System" jurnaliga "Application Popup" (26) bo'lib yoziladi */
    if (!out[0] && (ev = OpenEventLogW(NULL, L"System")) != NULL) {
        seen = 0;
        while (!out[0] && seen < 400 && ReadEventLogW(ev, EVENTLOG_BACKWARDS_READ | EVENTLOG_SEQUENTIAL_READ, 0, buf, sizeof(buf), &rd, &need)) {
            for (BYTE *p = buf; p < buf + rd && !out[0]; p += ((EVENTLOGRECORD *)p)->Length) {
                EVENTLOGRECORD *r = (EVENTLOGRECORD *)p; seen++;
                if (r->TimeGenerated + 5 < since) { seen = 9999; break; }
                if ((r->EventID & 0xFFFF) != 26 || r->NumStrings < 2) continue;
                const wchar_t *q = (const wchar_t *)(p + r->StringOffset), *t1 = q, *t2 = q + wcslen(q) + 1;
                wchar_t lw[400]; _snwprintf(lw, 400, L"%s | %s", t1, t2); lw[399] = 0; CharLowerW(lw);
                if (!wcsstr(lw, L"cstrike") && !wcsstr(lw, L"hl.exe")) continue;
                char raw[200]; WideCharToMultiByte(CP_UTF8, 0, lw, -1, raw, sizeof(raw) - 1, NULL, NULL); raw[sizeof(raw) - 1] = 0;
                char tmp[200]; _snprintf(tmp, sizeof(tmp), "popup=%s", raw); tmp[120] = 0;
                url_escape(out, cap, tmp);
            }
        }
        CloseEventLog(ev);
    }
    if (!out[0]) lstrcpynA(out, "noevent", (int)cap);
}

/* Windows jurnali bo'sh bo'lsa ("noevent" - o'yin DLL'lar yuklanayotganda yiqilgan): o'yinni bir marta kuzatuv
 * (debug) rejimida ochamiz va qaysi modulda, qaysi DLL yuklangandan keyin yiqilganini o'zimiz ushlaymiz.
 * Natija: "dbg=c0000005 mod=xyz.dll+1a2b last=abc.dll n=37" (2-imkoniyat - aniq yiqilish; 1-imkoniyat - "fc") */
typedef struct { ULONG_PTR base; char name[48]; } DbgMod;
/* qaytaradi: TRUE - Windows papkasidan tashqaridagi (begona) DLL */
static BOOL dbg_name(HANDLE f, char *out, size_t cap)
{
    char path[MAX_PATH] = "", win[MAX_PATH] = "";
    if (!f || !GetFinalPathNameByHandleA(f, path, MAX_PATH, 0)) { lstrcpynA(out, "?", (int)cap); return FALSE; }
    char *b = strrchr(path, '\\'); lstrcpynA(out, b ? b + 1 : path, (int)cap);
    UINT wl = GetWindowsDirectoryA(win, MAX_PATH);
    char *pp = path; if (!strncmp(pp, "\\\\?\\", 4)) pp += 4;
    return !(wl && wl < MAX_PATH && !_strnicmp(pp, win, wl));
}
/* Yiqilish paytidagi stek: ESP dan 1 KB o'qib, modullar ichiga tushgan qaytish manzillari (mod+offset) - qaysi DLL ntdll'ni
 * chaqirganini ko'rsatadi (masalan tier0.dll+1a2b -> ntdll). Modul hajmi PE sarlavhasidan (SizeOfImage) */
static void dbg_stack(HANDLE proc, DWORD tid, DbgMod *mods, int nm, char *out, size_t cap)
{
    out[0] = 0;
    static DWORD msz[400];
    for (int i = 0; i < nm && i < 400; i++) {
        DWORD lf = 0, sz = 0; SIZE_T rd = 0; msz[i] = 0;
        if (ReadProcessMemory(proc, (LPCVOID)(mods[i].base + 0x3C), &lf, 4, &rd) && lf && lf < 0x1000 &&
            ReadProcessMemory(proc, (LPCVOID)(mods[i].base + lf + 0x50), &sz, 4, &rd)) msz[i] = sz;
    }
    HANDLE th = OpenThread(THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION, FALSE, tid);
    if (!th) return;
    DWORD sp = 0, ip = 0;
#ifdef _WIN64
    WOW64_CONTEXT c; ZeroMemory(&c, sizeof(c)); c.ContextFlags = WOW64_CONTEXT_CONTROL;
    if (Wow64GetThreadContext(th, &c)) { sp = c.Esp; ip = c.Eip; }
#else
    CONTEXT c; ZeroMemory(&c, sizeof(c)); c.ContextFlags = CONTEXT_CONTROL;
    if (GetThreadContext(th, &c)) { sp = c.Esp; ip = c.Eip; }
#endif
    CloseHandle(th);
    if (!sp) return;
    DWORD st[256]; SIZE_T got = 0;
    if (!ReadProcessMemory(proc, (LPCVOID)(ULONG_PTR)sp, st, sizeof(st), &got)) return;
    int n = (int)(got / 4), hits = 0; size_t len = 0;
    (void)ip;
    for (int k = 0; k < n && hits < 8; k++) {
        ULONG_PTR a = st[k]; int bi = -1;
        for (int i = 0; i < nm && i < 400; i++) if (msz[i] && a >= mods[i].base && a < mods[i].base + msz[i]) { bi = i; break; }
        if (bi < 0) continue;
        char one[72]; _snprintf(one, sizeof(one), "%s%s+%lx", hits ? "," : "", mods[bi].name, (unsigned long)(a - mods[bi].base)); one[71] = 0;
        if (len + strlen(one) + 1 >= cap) break;
        strcat(out, one); len += strlen(one); hits++;
    }
}
/* Yiqilish dampi (minidump): o'yin ishlab chiqaruvchisiga (NextClient) sababni topish uchun. %TEMP%\xc_crash.dmp
 * Faqat kuzatuv rejimida, birinchi xotira xatosida - o'yin oqimlari to'xtagan holatda yoziladi */
typedef BOOL (WINAPI *MDWD)(HANDLE, DWORD, HANDLE, int, void *, void *, void *);
static wchar_t g_dmp[MAX_PATH] = L"";
static void dbg_dump(HANDLE proc, DWORD pid, DWORD tid, EXCEPTION_RECORD *er)
{
    if (g_dmp[0]) return;
    HMODULE dh = LoadLibraryW(L"dbghelp.dll"); if (!dh) return;
    MDWD wd = (MDWD)GetProcAddress(dh, "MiniDumpWriteDump");
    wchar_t tp[MAX_PATH], f[MAX_PATH];
    if (wd && GetTempPathW(MAX_PATH, tp)) {
        _snwprintf(f, MAX_PATH, L"%sxc_crash.dmp", tp); f[MAX_PATH - 1] = 0;
        HANDLE h = CreateFileW(f, GENERIC_READ | GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (h != INVALID_HANDLE_VALUE) {
            /* istisno ma'lumoti: o'yin jarayoniga EXCEPTION_POINTERS yozamiz (ClientPointers=TRUE) - WinDbg !analyze yiqilgan joyni darhol ko'rsatadi */
            struct { DWORD ThreadId; void *ExceptionPointers; BOOL ClientPointers; } mei = { tid, NULL, TRUE };
            HANDLE th = OpenThread(THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION, FALSE, tid);
            CONTEXT c; ZeroMemory(&c, sizeof(c)); c.ContextFlags = CONTEXT_FULL;
            if (th && GetThreadContext(th, &c)) {
                SIZE_T need = sizeof(EXCEPTION_RECORD) + sizeof(CONTEXT) + sizeof(EXCEPTION_POINTERS), w = 0;
                BYTE *rm = (BYTE *)VirtualAllocEx(proc, NULL, need, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
                if (rm) {
                    EXCEPTION_POINTERS ep; ep.ExceptionRecord = (EXCEPTION_RECORD *)rm; ep.ContextRecord = (CONTEXT *)(rm + sizeof(EXCEPTION_RECORD));
                    if (WriteProcessMemory(proc, rm, er, sizeof(EXCEPTION_RECORD), &w) && WriteProcessMemory(proc, rm + sizeof(EXCEPTION_RECORD), &c, sizeof(CONTEXT), &w) &&
                        WriteProcessMemory(proc, rm + sizeof(EXCEPTION_RECORD) + sizeof(CONTEXT), &ep, sizeof(ep), &w))
                        mei.ExceptionPointers = rm + sizeof(EXCEPTION_RECORD) + sizeof(CONTEXT);
                }
            }
            if (th) CloseHandle(th);
            /* DataSegs | HandleData | IndirectlyReferencedMemory | UnloadedModules | ProcessThreadData | FullMemoryInfo | ThreadInfo - bir necha MB */
            DWORD fl = 0x1 | 0x4 | 0x40 | 0x20 | 0x100 | 0x800 | 0x1000;
            BOOL ok = wd(proc, pid, h, (int)fl, mei.ExceptionPointers ? &mei : NULL, NULL, NULL);
            if (!ok) { SetFilePointer(h, 0, NULL, FILE_BEGIN); SetEndOfFile(h); ok = wd(proc, pid, h, 0x1 | 0x20, NULL, NULL, NULL); }   /* kichikroq */
            CloseHandle(h);
            if (ok) lstrcpynW(g_dmp, f, MAX_PATH); else DeleteFileW(f);
        }
    }
    FreeLibrary(dh);
}
/* dampni saytga bo'laklab (1 MB) yuborish - admin "Muammolar" dan yuklab olinadi. Kuniga 1 marta */
static char *share_post(const char *path, const void *data, DWORD len);   /* xc_rec.c */
static void dmp_upload(const char *kind)
{
    if (!g_dmp[0]) return;
    FILETIME ft; GetSystemTimeAsFileTime(&ft);
    int day = (int)(((((ULONGLONG)ft.dwHighDateTime << 32) | ft.dwLowDateTime) / 10000000ULL) / 86400ULL);
    if (ini_int(L"dmpday") == day) return;
    long len = 0; char *b = read_all(g_dmp, &len);
    if (!b || len < 1024 || len > 48 * 1024 * 1024) { free(b); return; }
    ini_set_int(L"dmpday", day);
    char n[24]; _snprintf(n, sizeof(n), "%lu", (unsigned long)((((ULONGLONG)ft.dwHighDateTime << 32 | ft.dwLowDateTime) / 10000000ULL) - 11644473600ULL)); n[23] = 0;
    for (long off = 0; off < len; ) {
        DWORD part = (DWORD)(len - off > 1048576 ? 1048576 : len - off);
        char path[260]; _snprintf(path, sizeof(path), "/xc_api.php?a=dmpup&d=%s&n=%s&k=%s&v=%s&off=%ld&tot=%ld", g_id, n, kind, g_version[0] ? g_version : XC_VERSTR, off, len); path[sizeof(path) - 1] = 0;
        char *r = NULL;
        for (int a = 0; a < 3 && !(r && !strncmp(r, "ok", 2)); a++) { free(r); r = share_post(path, b + off, part); }
        BOOL ok = r && !strncmp(r, "ok", 2); free(r);
        if (!ok) break;
        off += part;
    }
    free(b);
}
static void dbg_probe(const wchar_t *exe, const wchar_t *cmd, char *out, size_t cap)
{
    static DbgMod mods[400]; int nm = 0;
    char last[48] = "", fc[160] = "", sc[160] = "", ext[160] = "", acc[40] = "", stk[300] = "";
    wchar_t c[1024]; lstrcpynW(c, cmd, 1024);
    STARTUPINFOW si = { sizeof(si) }; PROCESS_INFORMATION pi;
    if (!CreateProcessW(exe, c, NULL, NULL, FALSE, DEBUG_ONLY_THIS_PROCESS, NULL, g_dir, &si, &pi)) { _snprintf(out, cap, "dbgfail=%lu", GetLastError()); out[cap - 1] = 0; return; }
    DWORD t0 = GetTickCount(), exitc = 0; BOOL done = FALSE;
    while (!done && GetTickCount() - t0 < 25000) {
        DEBUG_EVENT de;
        if (!WaitForDebugEvent(&de, 1000)) continue;
        DWORD cont = DBG_CONTINUE;
        switch (de.dwDebugEventCode) {
        case CREATE_PROCESS_DEBUG_EVENT:
            if (nm < 400) { mods[nm].base = (ULONG_PTR)de.u.CreateProcessInfo.lpBaseOfImage; dbg_name(de.u.CreateProcessInfo.hFile, mods[nm].name, sizeof(mods[nm].name)); nm++; }
            if (de.u.CreateProcessInfo.hFile) CloseHandle(de.u.CreateProcessInfo.hFile);
            break;
        case LOAD_DLL_DEBUG_EVENT:
            if (nm < 400) { mods[nm].base = (ULONG_PTR)de.u.LoadDll.lpBaseOfDll;
                            if (dbg_name(de.u.LoadDll.hFile, mods[nm].name, sizeof(mods[nm].name)) && strlen(ext) + strlen(mods[nm].name) + 2 < sizeof(ext)) {   /* begona DLL (o'yin papkasi, antivirus, dastur) */
                                if (ext[0]) strcat(ext, ","); strcat(ext, mods[nm].name); }
                            lstrcpynA(last, mods[nm].name, sizeof(last)); nm++; }
            if (de.u.LoadDll.hFile) CloseHandle(de.u.LoadDll.hFile);
            break;
        case EXCEPTION_DEBUG_EVENT: {
            EXCEPTION_RECORD *er = &de.u.Exception.ExceptionRecord;
            DWORD code = er->ExceptionCode;
            if (code == EXCEPTION_BREAKPOINT || code == 0x4000001F || code == 0x406D1388 || code == 0xE06D7363) break;   /* boshlang'ich to'xtash, oqim nomi, C++ - o'tkazamiz */
            ULONG_PTR a = (ULONG_PTR)er->ExceptionAddress; int bi = -1;
            for (int i = 0; i < nm; i++) if (mods[i].base <= a && (bi < 0 || mods[i].base > mods[bi].base)) bi = i;
            char *dst = de.u.Exception.dwFirstChance ? fc : sc;
            if (code == EXCEPTION_ACCESS_VIOLATION && !stk[0]) { dbg_stack(pi.hProcess, de.dwThreadId, mods, nm, stk, sizeof(stk)); dbg_dump(pi.hProcess, pi.dwProcessId, de.dwThreadId, er); }   /* birinchi xotira xatosi - stek va damp */
            if (!de.u.Exception.dwFirstChance && code == EXCEPTION_ACCESS_VIOLATION && er->NumberParameters >= 2 && !acc[0]) {   /* o'qish/yozish/ishga tushirish va manzil */
                _snprintf(acc, sizeof(acc), " acc=%c@%lx", er->ExceptionInformation[0] == 0 ? 'r' : er->ExceptionInformation[0] == 1 ? 'w' : 'x', (unsigned long)er->ExceptionInformation[1]); acc[sizeof(acc) - 1] = 0; }
            if (!dst[0]) { _snprintf(dst, 160, "%08lx mod=%s+%lx", code, bi >= 0 ? mods[bi].name : "?", bi >= 0 ? (unsigned long)(a - mods[bi].base) : (unsigned long)a); dst[159] = 0;
                           if (bi >= 0 && (!de.u.Exception.dwFirstChance || !g_cmod[0])) lstrcpynA(g_cmod, mods[bi].name, sizeof(g_cmod)); }
            cont = DBG_EXCEPTION_NOT_HANDLED;        /* o'yin o'zi ushlasa - davom etsin (himoya tizimlari ataylab ishlatadi) */
            if (!de.u.Exception.dwFirstChance) done = TRUE;
            break; }
        case EXIT_PROCESS_DEBUG_EVENT: exitc = de.u.ExitProcess.dwExitCode; done = TRUE; break;
        default: break;
        }
        ContinueDebugEvent(de.dwProcessId, de.dwThreadId, cont);
    }
    if (!done || sc[0]) TerminateProcess(pi.hProcess, 1);
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
    _snprintf(out, cap, "%s%s%s%s%s exit=%08lx last=%s n=%d ext=%s stk=%s%s", sc[0] ? "dbg=" : "", sc, acc, fc[0] ? " fc=" : "", fc, (unsigned long)exitc, last[0] ? last : "-", nm, ext[0] ? ext : "-", stk[0] ? stk : "-", done ? "" : " timeout");
    out[cap - 1] = 0;
}

/* ---- Aqlli tuzatish: yiqilgan modulga qarab o'yinchiga aniq yo'l-yo'riq (har tur kuniga 1 marta) ----
 * 1 Intel / 2 NVIDIA / 3 AMD videokarta drayveri, 4 ekran yozuvchi/overlay, 5 antivirus, 6 o'yin fayli, 7 Windows 7 SP1 yo'q */
static int crash_kind(BOOL startup)
{
    char m[64]; lstrcpynA(m, g_cmod, sizeof(m)); CharLowerA(m);
    if (!m[0]) return 0;
    if (!strncmp(m, "ig4", 3) || !strncmp(m, "ig7", 3) || !strncmp(m, "ig9", 3) || !strncmp(m, "igx", 3) || !strncmp(m, "igd", 3) || !strncmp(m, "ig75", 4)) return 1;
    if (!strncmp(m, "nvogl", 5) || !strncmp(m, "nvd3d", 5) || !strncmp(m, "nvwgf", 5) || !strncmp(m, "nvumd", 5)) return 2;
    if (!strncmp(m, "atio", 4) || !strncmp(m, "atiu", 4) || !strncmp(m, "amdx", 4) || !strncmp(m, "atig", 4)) return 3;
    static const char *ov[] = { "rtsshooks", "obs-graphics-hook", "graphics-hook", "bdcam", "gameoverlayrenderer", "discord", "nvspcap", "fraps", "action_x86", "overwolf", "mirillis", "playclaw", "dxtory", "reshade" };
    for (size_t i = 0; i < sizeof(ov) / sizeof(ov[0]); i++) if (strstr(m, ov[i])) return 4;
    static const char *av[] = { "360", "safemon", "qhsafe", "aswhook", "avghook", "sbiedll", "cmdvrt", "hmpalert", "klhk", "eppapi", "bdhkm", "atcuf", "ekrn" };
    for (size_t i = 0; i < sizeof(av) / sizeof(av[0]); i++) if (strstr(m, av[i])) return 5;
    if (!strcmp(m, "hw.dll") || !strcmp(m, "sw.dll") || !strcmp(m, "client.dll") || !strcmp(m, "mp.dll") || !strcmp(m, "cstrike.exe") || !strcmp(m, "hl.exe") || !strcmp(m, "filesystem_stdio.dll") || !strncmp(m, "vgui", 4)) return 6;
    if (startup && !strcmp(m, "ntdll.dll")) {
        RTL_OSVERSIONINFOEXW vi; ZeroMemory(&vi, sizeof(vi)); vi.dwOSVersionInfoSize = sizeof(vi);
        typedef LONG (WINAPI *RGV)(RTL_OSVERSIONINFOEXW *);
        RGV rgv = (RGV)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion"); if (rgv) rgv(&vi);
        if (vi.dwMajorVersion == 6 && vi.dwMinorVersion == 1 && vi.wServicePackMajor == 0) return 7;
        if (vi.dwMajorVersion == 6 && vi.dwMinorVersion <= 1) return 8;   /* Win7 SP1 / Vista: tizim fayllari yoki yangilanishlar */
    }
    return 0;
}
/* TRUE - yo'l-yo'riq ko'rsatildi (umumiy xabar shart emas) */
static BOOL smart_fix(BOOL startup)
{
    int k = crash_kind(startup);
    if (!k) return FALSE;
    if (k == 6) ini_set_int(L"autover", 1);          /* o'yin faylida - keyingi ochilishda fayllar tekshiriladi */
    FILETIME ft; GetSystemTimeAsFileTime(&ft);
    int day = (int)(((((ULONGLONG)ft.dwHighDateTime << 32) | ft.dwLowDateTime) / 10000000ULL) / 86400ULL);
    wchar_t key[16]; _snwprintf(key, 16, L"hint%d", k); key[15] = 0;
    if (ini_int(key) == day) return FALSE;            /* bugun aytilgan */
    ini_set_int(key, day);
    BOOL ru = !strncmp(g_lang, "ru", 2);
    wchar_t mod[64]; MultiByteToWideChar(CP_UTF8, 0, g_cmod, -1, mod, 64);
    static const wchar_t *url[] = { NULL, L"https://www.intel.com/content/www/us/en/support/detect.html", L"https://www.nvidia.com/Download/index.aspx",
        L"https://www.amd.com/en/support", NULL, NULL, NULL, L"ms-settings:windowsupdate", L"https://mmb.boost-top.com/win7.html" };
    static const wchar_t *uz[] = { NULL,
        L"O‘yin Intel videokarta drayverida (%s) yiqildi.\n\nDrayver eski yoki buzilgan. Intel saytidan yangi drayverni o‘rnating - sahifa ochilsinmi?",
        L"O‘yin NVIDIA videokarta drayverida (%s) yiqildi.\n\nDrayver eski yoki buzilgan. NVIDIA saytidan yangi drayverni o‘rnating - sahifa ochilsinmi?",
        L"O‘yin AMD videokarta drayverida (%s) yiqildi.\n\nDrayver eski yoki buzilgan. AMD saytidan yangi drayverni o‘rnating - sahifa ochilsinmi?",
        L"O‘yinni ekran yozuvchi yoki overlay dastur (%s) yiqitdi - OBS, Bandicam, RivaTuner/MSI Afterburner, Discord, Steam overlay va h.k.\n\nO‘yin paytida shu dasturni yoping yoki undagi overlay'ni o‘chiring. Video yozish uchun X CLIENT'ning F10 tugmasidan foydalaning.",
        L"O‘yinni antivirus (%s) yiqitdi - u o‘yinga aralashyapti.\n\nAntivirusda o‘yin papkasini (C:\\Games\\X CLIENT) istisnoga qo‘shing yoki o‘yin paytida antivirusni vaqtincha o‘chiring.",
        L"O‘yin o‘z faylida (%s) yiqildi - fayl buzilgan bo‘lishi mumkin.\n\nX CLIENT keyingi ochilishda fayllarni o‘zi tekshiradi. Yana takrorlansa - X CLIENT ni saytdan qayta o‘rnating.",
        L"Bu kompyuterda Windows 7 Service Pack 1 o‘rnatilmagan - o‘yin shuning uchun ishga tushmayapti (%s).\n\n«Пуск» → «Центр обновления Windows» → barcha yangilanishlarni (Service Pack 1 ham) o‘rnating va kompyuterni qayta yoqing.",
        L"O‘yin Windows 7 ning o‘zida (%s) ishga tushishda yiqilyapti - Windows tizim fayllari buzilgan yoki muhim yangilanishlar yetishmaydi.\n\nTuzatish yo‘riqnomasi (3 qadam, 20-30 daqiqa) ochilsinmi?" };
    static const wchar_t *rus[] = { NULL,
        L"Игра вылетела в драйвере видеокарты Intel (%s).\n\nДрайвер устарел или повреждён. Установите новый драйвер с сайта Intel - открыть страницу?",
        L"Игра вылетела в драйвере видеокарты NVIDIA (%s).\n\nДрайвер устарел или повреждён. Установите новый драйвер с сайта NVIDIA - открыть страницу?",
        L"Игра вылетела в драйвере видеокарты AMD (%s).\n\nДрайвер устарел или повреждён. Установите новый драйвер с сайта AMD - открыть страницу?",
        L"Игру уронила программа записи экрана или оверлей (%s) - OBS, Bandicam, RivaTuner/MSI Afterburner, Discord, оверлей Steam и т.п.\n\nЗакройте её во время игры или отключите оверлей. Для записи видео используйте F10 в X CLIENT.",
        L"Игру уронил антивирус (%s) - он вмешивается в игру.\n\nДобавьте папку игры (C:\\Games\\X CLIENT) в исключения антивируса или временно отключайте его во время игры.",
        L"Игра вылетела в собственном файле (%s) - файл может быть повреждён.\n\nX CLIENT проверит файлы при следующем запуске. Если повторится - переустановите X CLIENT с сайта.",
        L"На этом компьютере не установлен Windows 7 Service Pack 1 - из-за этого игра не запускается (%s).\n\n«Пуск» → «Центр обновления Windows» → установите все обновления (включая Service Pack 1) и перезагрузите компьютер.",
        L"Игра падает при запуске внутри самой Windows 7 (%s) - повреждены системные файлы или не хватает важных обновлений.\n\nОткрыть инструкцию по исправлению (3 шага, 20-30 минут)?" };
    wchar_t msg[900]; _snwprintf(msg, 900, ru ? rus[k] : uz[k], mod); msg[899] = 0;
    { char raw[48]; _snprintf(raw, sizeof(raw), "kind=%d mod=%s", k, g_cmod); raw[47] = 0; url_escape(g_probx, sizeof(g_probx), raw); prob_send("smart_fix", 2000); g_probx[0] = 0; }
    if (url[k] && k != 7) {
        if (MessageBoxW(NULL, msg, L"X CLIENT", MB_YESNO | MB_ICONWARNING | MB_SETFOREGROUND) == IDYES) ShellExecuteW(NULL, L"open", url[k], NULL, NULL, SW_SHOWNORMAL);
    } else {
        MessageBoxW(NULL, msg, L"X CLIENT", MB_OK | MB_ICONWARNING | MB_SETFOREGROUND);
        if (k == 7 && (INT_PTR)ShellExecuteW(NULL, L"open", L"control.exe", L"/name Microsoft.WindowsUpdate", NULL, SW_SHOWNORMAL) <= 32) {}
    }
    return TRUE;
}

static BOOL run_game(void)
{
    wchar_t exe[MAX_PATH], cmd[1024];
    remove_old_ui();
    clear_menu_cache();
    apply_theme_dir(L"");
    fix_override_bg();
    lang_bg();
    setup_main_menu();
    remove_game_links();
    ensure_scheme();
    ensure_launcher_cfg();
    if (o_ok) hud_scale();
    { int rs = ini_int(L"rsk"); if (!o_ok && rs > 0) o_rsk = rs - 1; }   /* sayt javob bermasa - oxirgi tanlov */
    radar_skin(o_rsk);
    path_join(exe, g_dir, L"cstrike.exe");
    /* cstrike.exe bu kompyuterda ochilishdayoq yiqilgan bo'lsa (Windows 7: "Ошибка при запуске приложения 0xc0000005") -
     * o'sha o'yinni klassik hl.exe orqali ochamiz */
    if (ini_int(L"usehl")) { wchar_t hl[MAX_PATH]; path_join(hl, g_dir, L"hl.exe"); if (GetFileAttributesW(hl) != INVALID_FILE_ATTRIBUTES) lstrcpyW(exe, hl); }
    if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) path_join(exe, g_dir, L"hl.exe");
    if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxW(NULL, L"O‘yin fayllari (cstrike.exe) topilmadi. X CLIENT ni to‘liq paketdan qayta o‘rnating.", L"X CLIENT", MB_ICONERROR);
        return FALSE;
    }
    wchar_t vid[96] = L"";
    unsigned w = 0, h = 0;
    if (o_win == 2) {   /* oynali to'liq ekran: chegarasiz oyna monitor o'lchamida - Alt+Tab tez, qora ekransiz */
        DEVMODEW dm; ZeroMemory(&dm, sizeof(dm)); dm.dmSize = sizeof(dm);
        if (EnumDisplaySettingsW(NULL, ENUM_CURRENT_SETTINGS, &dm) && dm.dmPelsWidth >= 640) { w = dm.dmPelsWidth; h = dm.dmPelsHeight; }
        else if (!(o_res[0] && sscanf(o_res, "%ux%u", &w, &h) == 2)) { w = 1024; h = 768; }
        _snwprintf(vid, 96, L" -width %u -height %u -window -noborder", w, h);
    }
    else if (o_res[0] && sscanf(o_res, "%ux%u", &w, &h) == 2) _snwprintf(vid, 96, L" -width %u -height %u%s", w, h, o_win ? L" -window" : L" -full");
    else if (o_win) {   /* oyna + "Avto": ish maydoniga (vazifalar paneli chiqarilgan) sig'adigan eng katta standart o'lcham, monitor formati bilan.
                         * Oldin faqat -window edi - o'yin eski saqlangan o'lchamda (ko'pincha 800x600) ochilardi */
        RECT wa; DEVMODEW dm; ZeroMemory(&dm, sizeof(dm)); dm.dmSize = sizeof(dm);
        static const unsigned R169[][2] = { { 2560, 1440 }, { 1920, 1080 }, { 1600, 900 }, { 1366, 768 }, { 1280, 720 }, { 1024, 576 } };
        static const unsigned R43[][2] = { { 1600, 1200 }, { 1280, 960 }, { 1024, 768 }, { 800, 600 } };
        static const unsigned R1610[][2] = { { 1920, 1200 }, { 1680, 1050 }, { 1440, 900 }, { 1280, 800 } };
        if (SystemParametersInfoW(SPI_GETWORKAREA, 0, &wa, 0) && EnumDisplaySettingsW(NULL, ENUM_CURRENT_SETTINGS, &dm) && dm.dmPelsHeight) {
            unsigned aw = (unsigned)(wa.right - wa.left), ah = (unsigned)(wa.bottom - wa.top) - 32;   /* oyna sarlavhasi */
            double k = (double)dm.dmPelsWidth / dm.dmPelsHeight;
            const unsigned (*L)[2] = k < 1.45 ? R43 : k < 1.7 ? R1610 : R169; int n = k < 1.45 ? 4 : k < 1.7 ? 4 : 6;
            for (int i = 0; i < n; i++) if (L[i][0] <= aw && L[i][1] <= ah) { w = L[i][0]; h = L[i][1]; break; }
        }
        if (w) _snwprintf(vid, 96, L" -width %u -height %u -window", w, h); else lstrcpyW(vid, L" -window");
    }
    else {
        /* "Avto": o'yin monitorning haqiqiy o'lchamida ochiladi (Windows masshtabi 125%/150% bo'lsa ham - EnumDisplaySettings) */
        DEVMODEW dm; ZeroMemory(&dm, sizeof(dm)); dm.dmSize = sizeof(dm);
        if (EnumDisplaySettingsW(NULL, ENUM_CURRENT_SETTINGS, &dm) && dm.dmPelsWidth >= 640 && dm.dmPelsHeight >= 480) {
            w = dm.dmPelsWidth; h = dm.dmPelsHeight;
            _snwprintf(vid, 96, L" -width %u -height %u -full", w, h);
        }
    }
    /* -freq: busiz CS 1.6 to'liq ekranni ko'pincha 60 Hz da ochadi (144 Hz monitorda ham) - 100 FPS 60 Hz da notekis, "silliq emas".
     * Shu o'lcham uchun monitor qo'llaydigan eng yuqori chastotani tanlaymiz */
    if (!o_win && w && h) {
        DWORD best = 0; DEVMODEW m; ZeroMemory(&m, sizeof(m)); m.dmSize = sizeof(m);
        for (DWORD i = 0; EnumDisplaySettingsW(NULL, i, &m); i++)
            if (m.dmPelsWidth == w && m.dmPelsHeight == h && m.dmBitsPerPel >= 32 && m.dmDisplayFrequency > best && m.dmDisplayFrequency <= 500) best = m.dmDisplayFrequency;
        if (best > 60) { size_t l = wcslen(vid); _snwprintf(vid + l, 96 - l, L" -freq %lu", best); }
    }
    /* 6. xavfsiz rejim: o'yin ketma-ket 3 marta yiqilgan bo'lsa - oyna rejimi, 1024x768, yengil grafika, ustuvorliksiz.
     * Bir marta 2 daqiqadan ko'proq yiqilmay o'ynalsa - keyingi safar odatiy holga qaytadi */
    BOOL safe = ini_int(L"crs") >= 3;
    if (safe) {
        lstrcpyW(vid, L" -width 1024 -height 768 -window");
        wchar_t sc[MAX_PATH]; path_join(sc, g_dir, L"cstrike\\xclient_safe.cfg");
        FILE *sf = _wfopen(sc, L"wb");
        if (sf) { fprintf(sf, "// X CLIENT xavfsiz rejim (ketma-ket yiqilishlardan keyin)\nfps_max 100\nr_dynamic 0\nmp_decals 100\ngl_max_size 512\ncl_minmodels 1\n"); fclose(sf); }
        prob_send("safe_mode", 0);
        BOOL ru = !strncmp(g_lang, "ru", 2);
        MessageBoxW(NULL, ru ? L"Игра вылетела 3 раза подряд.\n\nX CLIENT откроет её в безопасном режиме: окно 1024x768 и лёгкая графика. Если всё будет нормально - в следующий раз вернётся обычный режим."
                             : L"O‘yin ketma-ket 3 marta yiqildi.\n\nX CLIENT uni xavfsiz rejimda ochadi: 1024x768 oyna va yengil grafika. Hammasi joyida bo‘lsa - keyingi safar odatiy holga qaytadi.",
                    L"X CLIENT", MB_ICONINFORMATION | MB_SETFOREGROUND);
    }
    _snwprintf(cmd, 1024, L"\"%s\" -game cstrike%s%s -noforcemparms -noforcemaccel +exec xclient_launcher.cfg%s", exe, vid, o_stretch && !safe ? L" -stretchaspect" : L"", safe ? L" +exec xclient_safe.cfg" : L"");
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    meta_save();
    if (o_ok && !safe) compat_flags(exe, o_prio);
    BOOL again = FALSE;
    FILETIME ft0; GetSystemTimeAsFileTime(&ft0);
    InterlockedExchange(&g_game_seen, 0);
    if (o_tune) ram_offer();                            /* xotira kam bo'lsa - og'ir dasturlarni yopishni taklif qilish, bo'shatish */
    if (game_spawn(exe, cmd, &si, &pi)) {
        if (g_one) { CloseHandle(g_one); g_one = NULL; }   /* o'yin ochildi - endi yana bosilsa, yangi launcher uni topib oldinga chiqaradi */
        if (o_prio && !safe) SetPriorityClass(pi.hProcess, ABOVE_NORMAL_PRIORITY_CLASS);   /* "O'yinni tezlashtirish": HIGH Windows ovoz xizmatini (audiodg) siqib, ovoz qotishi va chirsillashiga sabab bo'lardi */
        if (pi.hThread) CloseHandle(pi.hThread);
        /* guard_theme olib tashlandi: nDirect fayllarini qayta yozish har ochilishda yangilanishga sabab bo'lardi */
        /* O'yin yopilgach skrinshotlarni (F5) darhol galereyaga yuklaymiz - keyingi ishga tushishni kutmasdan.
         * fetch_opts qayta: menyuda o'yin paytida yoqilgan "galereyaga yuklash" ham hisobga olinadi va
         * sayt shu kompyuterni yana taniydi (shot_up 30 daqiqalik IP tekshiruvi). */
        { HANDLE dup = NULL;   /* taskbar va Alt+Tab da X CLIENT belgisi */
          if (DuplicateHandle(GetCurrentProcess(), pi.hProcess, GetCurrentProcess(), &dup, SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, 0)) {
              HANDLE it = CreateThread(NULL, 0, game_icon_thread, dup, 0, NULL); if (it) CloseHandle(it); else CloseHandle(dup); } }
        rec_session_begin(pi.dwProcessId);
        tune_begin();                                /* quvvat rejimi, sichqoncha, fon dasturlari - o'yin yopilguncha */
        perf_begin(pi.hProcess);                     /* lag sababi: o'yin protsessorni qancha band qilyapti */
        /* o'yin davomida launcher orqada turadi (F10, Windows sozlamalari). Uning ishlatmayotgan xotirasini Windows'ga qaytaramiz -
         * 2-4 GB li kompyuterlarda o'yinga ko'proq RAM qoladi. 20 soniyadan keyin (o'yin yuklanib bo'lgach), keyin 5 daqiqada bir;
         * video yozilayotganda tegmaymiz. Kerakli sahifalar so'ralganda Windows ularni o'zi qaytaradi */
        {
            /* faqat bir marta, o'yin yuklanib bo'lgach (60 s). Har 5 daqiqada qayta qilish launcher sahifalarini diskdan qayta
             * o'qitib, sekin diskli kompyuterda o'yin paytida qisqa qotish berishi mumkin edi */
            if (WaitForSingleObject(pi.hProcess, 60000) == WAIT_TIMEOUT && !g_rec_run) { HeapCompact(GetProcessHeap(), 0); SetProcessWorkingSetSize(GetCurrentProcess(), (SIZE_T)-1, (SIZE_T)-1); }
            WaitForSingleObject(pi.hProcess, INFINITE);
        }
        tune_end();
        DWORD code = 0; GetExitCodeProcess(pi.hProcess, &code);
        rec_session_end();
        ULONGLONG t0 = ((ULONGLONG)ft0.dwHighDateTime << 32) | ft0.dwLowDateTime;
        FILETIME ft1; GetSystemTimeAsFileTime(&ft1);
        ULONGLONG played = ((((ULONGLONG)ft1.dwHighDateTime << 32) | ft1.dwLowDateTime) - t0) / 10000000ULL;   /* soniya */
        g_played_s = (DWORD)played;
        perf_end((DWORD)played);
        if (played >= 600) fn_send("p10");
        BOOL crashed = game_crashed(code, t0);
        /* ochilishdayoq yiqildi (o'yin oynasi umuman paydo bo'lmadi, xotira xatosi): bu o'yin ichidagi xato emas - exe bu Windows'da ishga tushmayapti */
        if (crashed && code == 0xC0000005 && !g_game_seen && played < 300) {
            { FILETIME fe; GetSystemTimeAsFileTime(&fe);   /* jurnal yozilishiga ulgursin */
              Sleep(1500);
              DWORD since = (DWORD)((((ULONGLONG)ft0.dwHighDateTime << 32 | ft0.dwLowDateTime) / 10000000ULL) - 11644473600ULL);
              (void)fe; g_cmod[0] = 0; crash_detail(g_probx, sizeof(g_probx), since);
              /* jurnalda modul nomi yo'q (bo'sh yoki faqat "Ошибка при запуске приложения" oynasi) - o'yinni kuzatuv rejimida bir marta ochamiz */
              if (!strcmp(g_probx, "noevent") || !strcmp(g_probx, "nolog") || !strncmp(g_probx, "popup", 5)) {
                  status(L"Xato sababi aniqlanmoqda...", 100);
                  char raw[760], esc[1100]; dbg_probe(exe, cmd, raw, sizeof(raw)); url_escape(esc, sizeof(esc), raw);
                  lstrcpynA(g_probx, esc, sizeof(g_probx));   /* modul ma'lumoti muhimroq - popup matni o'rniga */
                  dmp_upload("start");                       /* damp - o'yin ishlab chiqaruvchisi uchun */
              } }
            prob_send("start_fail", 3000);
            g_probx[0] = 0;
            wchar_t hl[MAX_PATH]; path_join(hl, g_dir, L"hl.exe");
            BOOL isHl = !_wcsicmp(wcsrchr(exe, L'\\') ? wcsrchr(exe, L'\\') + 1 : exe, L"hl.exe");
            if (!isHl && GetFileAttributesW(hl) != INVALID_FILE_ATTRIBUTES) {   /* 1-chora: hl.exe bilan avtomatik qayta */
                ini_set_int(L"usehl", 1);
                CloseHandle(pi.hProcess);
                return TRUE;
            }
            ini_set_int(L"usehl", 0);
            if (smart_fix(TRUE)) { ini_set_int(L"crs", 0); CloseHandle(pi.hProcess); return FALSE; }   /* sabab aniq - o'shaning yo'l-yo'rig'i */
            BOOL ru = !strncmp(g_lang, "ru", 2);
            if (MessageBoxW(NULL, ru ? L"Игра не запускается на этом компьютере (ошибка 0xc0000005 при запуске).\n\nЧаще всего помогает:\n1) Установить Microsoft Visual C++ 2015-2022 (x86) - откроется страница загрузки.\n2) Windows 7: установить обновления (Центр обновления Windows), особенно KB2999226 и SP1.\n3) Временно отключить антивирус (360, Avast и др.) или добавить папку игры в исключения.\n4) Перезагрузить компьютер.\n\nОткрыть страницу Visual C++ сейчас?"
                                 : L"O‘yin bu kompyuterda ishga tushmayapti (ishga tushishda 0xc0000005 xatosi).\n\nKo‘pincha yordam beradi:\n1) Microsoft Visual C++ 2015-2022 (x86) ni o‘rnatish - yuklash sahifasi ochiladi.\n2) Windows 7: yangilanishlarni o‘rnatish (Windows Update), ayniqsa KB2999226 va SP1.\n3) Antivirusni (360, Avast va boshq.) vaqtincha o‘chirish yoki o‘yin papkasini istisnoga qo‘shish.\n4) Kompyuterni qayta yoqish.\n\nVisual C++ sahifasi hozir ochilsinmi?",
                            L"X CLIENT", MB_YESNO | MB_ICONWARNING | MB_SETFOREGROUND) == IDYES)
                ShellExecuteW(NULL, L"open", L"https://aka.ms/vs/17/release/vc_redist.x86.exe", NULL, NULL, SW_SHOWNORMAL);
            ini_set_int(L"crs", 0);                  /* bu yiqilish emas - xavfsiz rejim zanjiriga qo'shilmaydi */
            CloseHandle(pi.hProcess);
            return FALSE;
        }
        if (crashed) {
            int c = ini_int(L"crs") + 1; ini_set_int(L"crs", c);
            if (c >= 2) ini_set_int(L"autover", 1);   /* 7. ikkinchi yiqilishdan keyin - keyingi ochilishda X CLIENT fayllari tekshiriladi */
        } else if (played > 120) ini_set_int(L"crs", 0);
        if (crashed) {                               /* o'yin ichidagi yiqilish: Windows jurnalidan qaysi modulda yiqilganini olib, admin > Muammolar > Tafsilotlar ga */
            DWORD since = (DWORD)((t0 / 10000000ULL) - 11644473600ULL);
            g_cmod[0] = 0; Sleep(1500); crash_detail(g_probx, sizeof(g_probx), since);
            prob_send("game_crash", 3000); g_probx[0] = 0;
            smart_fix(FALSE);                        /* sabab ma'lum bo'lsa (drayver, overlay, antivirus...) - aniq yo'l-yo'riq */
        }
        if (crashed) {
            int n = crash_fix(t0);
            wchar_t w[24], m[640]; _snwprintf(w, 24, L"%lx~%d", (unsigned long)code, n); w[23] = 0; ini_str(L"t_cr", w);
            BOOL ru = !strncmp(g_lang, "ru", 2);
            if (n) _snwprintf(m, 640, ru ? L"Игра неожиданно закрылась (ошибка 0x%08lX).\n\nX CLIENT убрал %d файл(ов), скачанных с сервера перед вылетом: они могли быть повреждены. При следующем входе сервер отдаст их заново.\n\nОткрыть игру снова?"
                : L"O‘yin kutilmaganda yopildi (xato 0x%08lX).\n\nX CLIENT yiqilishdan oldin serverdan yuklangan %d ta faylni chetga oldi: ular buzilgan bo‘lishi mumkin. Keyingi kirishda server ularni qaytadan beradi.\n\nO‘yinni qayta ochaymi?", (unsigned long)code, n);
            else _snwprintf(m, 640, ru ? L"Игра неожиданно закрылась (ошибка 0x%08lX).\n\nОткрыть игру снова?" : L"O‘yin kutilmaganda yopildi (xato 0x%08lX).\n\nO‘yinni qayta ochaymi?", (unsigned long)code);
            m[639] = 0;
            again = MessageBoxW(NULL, m, L"X CLIENT", MB_YESNO | MB_ICONWARNING | MB_SETFOREGROUND) == IDYES;
        }
        cache_maint(NULL);                           /* o'yin yopilgach: yuklangan fayllarni o'yin ishlatayotgan paytda o'chirmaymiz */
        vthumb_start(0);                             /* "Mening videolarim" ko'rinishlari - o'yin yopilgach (o'yin paytida qotirardi) */
        fetch_opts();
        if (o_ok && o_shots) upload_shots();
        CloseHandle(pi.hProcess);
    } else start_failed(exe, GetLastError());
    return again;
}

/* Menyu sayti (XC_HOME) to'g'ri javob beryaptimi - yo'naltirishsiz. O'yin brauzeri yo'naltirishni ham, xato sahifasini ham
 * bir necha kun xotirada saqlab qolishi mumkin: sayt tuzalgandan keyin ham o'yinchida menyu qora bo'lib turadi.
 * Shuning uchun: oldingi safar buzilgan edi, endi tuzaldi -> o'yin brauzeri xotirasi (htmlcache) bir marta tozalanadi. */
static void menu_site_check(void)
{
    HINTERNET h = InternetOpenUrlA(g_net, XC_HOME "?lc=1", NULL, 0, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE | INTERNET_FLAG_NO_UI | INTERNET_FLAG_NO_AUTO_REDIRECT, 0);
    if (!h) return;                                              /* internet yo'q - hech narsa demaymiz */
    DWORD code = 0, len = sizeof(code);
    HttpQueryInfoA(h, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &code, &len, NULL);
    InternetCloseHandle(h);
    if (!code) return;
    int bad = ini_int(L"mhbad");
    if (code != 200) { if (!bad) ini_set_int(L"mhbad", 1); return; }
    /* birinchi tekshiruvda ham bir marta tozalaymiz: 2026-10-29 dagi https yo'naltirishi 7 kun xotirada turadi */
    if (bad || !ini_int(L"mhchk")) { ini_set_int(L"mhfix", 1); ini_set_int(L"mhbad", 0); }
    ini_set_int(L"mhchk", 1);
}

/* ---------------------------------------------------------------- ish oqimi */
/* 5. videokarta drayveri o'rnatilmagan (Windows o'zining "Basic Display"/"Standard VGA" drayverida) - CS 1.6 OpenGL
 * bilan sekin ishlaydi va tez-tez yiqiladi. O'yinchiga 3 kunda bir marta aytamiz, xohlasa Windows Update ochiladi */
static void gpu_check(void)
{
    DISPLAY_DEVICEW dd; wchar_t gpu[128] = L"";
    for (DWORD i = 0; ; i++) {
        ZeroMemory(&dd, sizeof(dd)); dd.cb = sizeof(dd);
        if (!EnumDisplayDevicesW(NULL, i, &dd, 0)) break;
        if (!gpu[0] || (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE)) lstrcpynW(gpu, dd.DeviceString, 128);
        if (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) break;
    }
    CharLowerW(gpu);
    /* asosiy ekran virtual drayverda (GameFusion, Parsec, spacedesk, virtual monitor...) - OpenGL o'sha "videokarta"ga tushadi va
     * cstrike.exe ishga tushishda yiqiladi (1.0.136: GameFusion Driver, cstrike.exe+14833c). Haqiqiy videokarta ekranini asosiy qilish kerak */
    static const wchar_t *virt[] = { L"gamefusion", L"parsec", L"spacedesk", L"virtual display", L"virtual monitor", L"indirect display", L"idd ", L"usb mobile monitor", L"duet display", L"splashtop", L"meta virtual" };
    for (size_t i = 0; gpu[0] && i < sizeof(virt) / sizeof(virt[0]); i++) if (wcsstr(gpu, virt[i])) {
        { char g8[80]; WideCharToMultiByte(CP_UTF8, 0, gpu, -1, g8, sizeof(g8), NULL, NULL); url_escape(g_probx, sizeof(g_probx), g8); }
        prob_send("gpu_virt", 0); g_probx[0] = 0;
        FILETIME ft; GetSystemTimeAsFileTime(&ft);
        int day = (int)(((((ULONGLONG)ft.dwHighDateTime << 32) | ft.dwLowDateTime) / 10000000ULL) / 86400ULL);
        if (ini_int(L"gpuv") == day) return;
        ini_set_int(L"gpuv", day);
        BOOL ru = !strncmp(g_lang, "ru", 2);
        wchar_t m[700];
        _snwprintf(m, 700, ru ? L"Основной экран работает через виртуальный драйвер «%s» (программа для стрима/второго монитора/ускорения игр).\n\nCS 1.6 из-за этого вылетает при запуске. Закройте или удалите эту программу (или отключите её виртуальный монитор) и перезагрузите компьютер. Также установите драйвер вашей видеокарты (Intel/NVIDIA/AMD)."
                              : L"Asosiy ekran «%s» virtual drayveri orqali ishlayapti (strim / ikkinchi monitor / o‘yin tezlatgich dasturi).\n\nShu sababli CS 1.6 ishga tushishda yiqiladi. Shu dasturni yoping yoki o‘chirib tashlang (yoki uning virtual monitorini o‘chiring) va kompyuterni qayta yoqing. Videokartangiz (Intel/NVIDIA/AMD) drayverini ham o‘rnating.", gpu);
        m[699] = 0;
        MessageBoxW(g_wnd, m, L"X CLIENT", MB_OK | MB_ICONWARNING | MB_SETFOREGROUND);
        return;
    }
    if (!gpu[0] || !(wcsstr(gpu, L"basic display") || wcsstr(gpu, L"basic render") || wcsstr(gpu, L"standard vga") ||
                     wcsstr(gpu, L"\x0441\x0442\x0430\x043d\x0434\x0430\x0440\x0442\x043d\x044b\x0439 vga") ||   /* стандартный vga */
                     wcsstr(gpu, L"\x0431\x0430\x0437\x043e\x0432\x044b\x0439 \x0432\x0438\x0434\x0435\x043e"))) return;   /* базовый видео... */
    prob_send("gpu_nodrv", 0);
    FILETIME ft; GetSystemTimeAsFileTime(&ft);
    int day = (int)(((((ULONGLONG)ft.dwHighDateTime << 32) | ft.dwLowDateTime) / 10000000ULL) / 86400ULL);
    if (day - ini_int(L"gpuw") < 3) return;
    ini_set_int(L"gpuw", day);
    BOOL ru = !strncmp(g_lang, "ru", 2);
    if (MessageBoxW(g_wnd, ru ? L"На этом компьютере не установлен драйвер видеокарты (работает стандартный драйвер Windows).\n\nИз-за этого CS 1.6 может тормозить и вылетать. Установите драйвер видеокарты (Windows Update или сайт производителя ноутбука/видеокарты).\n\nОткрыть Windows Update сейчас?"
                           : L"Bu kompyuterda videokarta drayveri o‘rnatilmagan (Windows’ning oddiy drayveri ishlayapti).\n\nShu sababli CS 1.6 sekin ishlashi va yiqilishi mumkin. Videokarta drayverini o‘rnating (Windows Update yoki noutbuk/videokarta ishlab chiqaruvchisi sayti).\n\nWindows Update hozir ochilsinmi?",
                    L"X CLIENT", MB_YESNO | MB_ICONWARNING | MB_SETFOREGROUND) == IDYES) {
        if ((INT_PTR)ShellExecuteW(NULL, L"open", L"ms-settings:windowsupdate", NULL, NULL, SW_SHOWNORMAL) <= 32)
            ShellExecuteW(NULL, L"open", L"control.exe", L"/name Microsoft.WindowsUpdate", NULL, SW_SHOWNORMAL);   /* Windows 7 */
    }
}

/* muammo hisoboti (admin panel > Muammolar): fonda, 4 s dan ortiq kutilmaydi */
static char g_prob[24];
/* Voronka: o'rnatgan o'yinchi qaysi bosqichgacha yetdi - inst (CS 1.6 bor), game (o'yin oynasi ochildi), p10 (10+ daqiqa o'ynadi).
 * Har bosqich shu kompyuterdan faqat bir marta yuboriladi (xclient.ini fn_*) */
static DWORD WINAPI fn_th(LPVOID arg)
{
    char url[400]; const char *st = (const char *)arg;
    _snprintf(url, sizeof(url), "http://mmb.boost-top.com/xc_api.php?a=fn&s=%s&d=%s&v=%s", st, g_id, g_version[0] ? g_version : XC_VERSTR); url[sizeof(url) - 1] = 0;
    HINTERNET h = open_url(url);
    if (h) InternetCloseHandle(h);
    return 0;
}
static void fn_send(const char *stage)
{
    static const char *ok[] = { "inst", "game", "p10" };
    const char *st = NULL; for (int i = 0; i < 3; i++) if (!strcmp(stage, ok[i])) st = ok[i];
    if (!st || !g_net || !g_id[0]) return;
    wchar_t k[16]; _snwprintf(k, 16, L"fn_%S", st); k[15] = 0;
    if (ini_int(k)) return;
    ini_set_int(k, 1);
    HANDLE th = CreateThread(NULL, 0, fn_th, (LPVOID)st, 0, NULL);
    if (th) CloseHandle(th);
}
static DWORD WINAPI prob_th(LPVOID unused)
{
    (void)unused;
    char url[2400];
    _snprintf(url, sizeof(url), "http://mmb.boost-top.com/xc_api.php?a=prob&k=%s&d=%s&v=%s%s%s", g_prob, g_id, g_version[0] ? g_version : XC_VERSTR, g_probx[0] ? "&x=" : "", g_probx);
    url[sizeof(url) - 1] = 0;
    HINTERNET h = open_url(url);
    if (h) InternetCloseHandle(h);
    return 0;
}
/* Har bir muammo hisobotiga kompyuter holati: Windows (build, SP, 64-bit), xotira (jami/bo'sh), protsessor, videokarta,
 * ishlab turgan antiviruslar, qaysi exe bilan ochilgan, xavfsiz rejim, o'yin davomiyligi. Admin > Muammolar > Tafsilotlar */
static void sys_ctx(char *out, size_t cap)
{
    RTL_OSVERSIONINFOEXW vi; ZeroMemory(&vi, sizeof(vi)); vi.dwOSVersionInfoSize = sizeof(vi);
    typedef LONG (WINAPI *RGV)(RTL_OSVERSIONINFOEXW *);
    RGV rgv = (RGV)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion"); if (rgv) rgv(&vi);
    BOOL w64 = FALSE; IsWow64Process(GetCurrentProcess(), &w64);
    MEMORYSTATUSEX ms; ms.dwLength = sizeof(ms); GlobalMemoryStatusEx(&ms);
    SYSTEM_INFO si; GetSystemInfo(&si);
    DISPLAY_DEVICEA dd; char gpu[64] = "?";
    for (DWORD i = 0; ; i++) { ZeroMemory(&dd, sizeof(dd)); dd.cb = sizeof(dd); if (!EnumDisplayDevicesA(NULL, i, &dd, 0)) break;
        if (gpu[0] == '?' || (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE)) lstrcpynA(gpu, dd.DeviceString, sizeof(gpu)); if (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) break; }
    static const char *avs[][2] = { {"360tray.exe","360"}, {"360sd.exe","360"}, {"zhudongfangyu.exe","360"}, {"avastui.exe","avast"}, {"avgui.exe","avg"}, {"avp.exe","kaspersky"},
        {"ekrn.exe","eset"}, {"msmpeng.exe","defender"}, {"dwservice.exe","drweb"}, {"mbamservice.exe","malwarebytes"}, {"bdagent.exe","bitdefender"}, {"psuaservice.exe","panda"}, {"qhsafetray.exe","360"} };
    char av[96] = "";
    HANDLE sn = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (sn != INVALID_HANDLE_VALUE) {
        PROCESSENTRY32W pe; pe.dwSize = sizeof(pe);
        for (BOOL ok = Process32FirstW(sn, &pe); ok; ok = Process32NextW(sn, &pe)) {
            char n8[64]; WideCharToMultiByte(CP_ACP, 0, pe.szExeFile, -1, n8, sizeof(n8), NULL, NULL); CharLowerA(n8);
            for (size_t k = 0; k < sizeof(avs) / sizeof(avs[0]); k++) if (!strcmp(n8, avs[k][0]) && !strstr(av, avs[k][1]) && strlen(av) + strlen(avs[k][1]) + 2 < sizeof(av)) { if (av[0]) strcat(av, ","); strcat(av, avs[k][1]); }
        }
        CloseHandle(sn);
    }
    _snprintf(out, cap, "os=%lu.%lu.%lu sp=%u x64=%d ram=%u/%uMB cpu=%lu gpu=%s av=%s hl=%d safe=%d t=%lus",
        vi.dwMajorVersion, vi.dwMinorVersion, vi.dwBuildNumber, (unsigned)vi.wServicePackMajor, w64 ? 1 : 0,
        (unsigned)(ms.ullTotalPhys >> 20), (unsigned)(ms.ullAvailPhys >> 20), si.dwNumberOfProcessors, gpu, av[0] ? av : "-",
        ini_int(L"usehl"), ini_int(L"crs") >= 3 ? 1 : 0, (unsigned long)g_played_s);
    out[cap - 1] = 0;
}
static void prob_send(const char *kind, DWORD wait)
{
    if (!g_net) return;
    lstrcpynA(g_prob, kind, sizeof(g_prob));
    { char ctx[300], esc[600]; sys_ctx(ctx, sizeof(ctx)); url_escape(esc, sizeof(esc), ctx);
      size_t l = strlen(g_probx);
      if (l + strlen(esc) + 8 < sizeof(g_probx)) { if (l) strcat(g_probx, "%20%7C%20"); strcat(g_probx, esc); } }
    HANDLE th = CreateThread(NULL, 0, prob_th, NULL, 0, NULL);
    if (th && !wait) Sleep(50);                  /* oqim url'ni yasab olsin, keyin g_probx tozalanadi */
    if (th) { if (wait) WaitForSingleObject(th, wait); CloseHandle(th); }
}
/* sayt 8 s ichida javob beradimi (DNS osilib qolsa WinINet o'z vaqt chegarasiga ham qaramaydi - shuning uchun alohida oqimda) */
static DWORD WINAPI net_probe(LPVOID unused)
{
    (void)unused;
    HINTERNET h = open_url_raw("http://mmb.boost-top.com/ver.txt");
    if (h) { InterlockedExchange(&g_probe_ok, 1); InternetCloseHandle(h); }
    return 0;
}
static DWORD WINAPI launch_ping(LPVOID unused) { (void)unused; api_call("launch", NULL); return 0; }
static BOOL g_relaunch = FALSE, g_play = TRUE;
static wchar_t g_err[256] = L"";

static DWORD WINAPI side_jobs(LPVOID unused)
{
    (void)unused;
    menu_site_check();
    clean_hpk();
    return 0;
}
static DWORD WINAPI worker(LPVOID unused)
{
    (void)unused;
    BOOL fresh = FALSE;
    if (!ensure_installed(&fresh)) {
        lstrcpyW(g_err, L"O‘rnatish papkasini yaratib bo‘lmadi (C:\\Games\\XClient).");
        g_play = FALSE;
        PostMessageW(g_wnd, WM_XC_DONE, 0, 0);
        return 0;
    }
    ini_load();
    game_dir_link();                              /* o'yin papkasida "O'YINNI SHU YERDAN OCHING" yorlig'i */
    if (!g_key[0]) read_trailer();
    make_id();
    ini_save();
    /* o'yin allaqachon ochiq: fayllarni (kesh, paketlar, yangilanish) o'yin ishlab turganda o'zgartirmaymiz -
     * ishlab turgan bo'lsa oynasi oldinga chiqadi, qotgan bo'lsa so'raladi va yopilgach odatdagidek davom etamiz */
    if (!handle_running_game()) { g_play = FALSE; PostMessageW(g_wnd, WM_XC_DONE, 0, 0); return 0; }
    tune_recover();                               /* oldingi safar launcher o'yin paytida yopilib qolgan bo'lsa - Windows sozlamalarini qaytarish */
    crash_prune();

    g_net = InternetOpenA("XClient", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    /* ulanish 6 s: sayt javob bermasa launcher 15 s kutib turmaydi (yuklab olishda o'qish kutishi 15 s qoladi) */
    DWORD to = 6000, rto = 15000;
    InternetSetOptionA(g_net, INTERNET_OPTION_CONNECT_TIMEOUT, &to, sizeof(to));
    InternetSetOptionA(g_net, INTERNET_OPTION_RECEIVE_TIMEOUT, &rto, sizeof(rto));

    /* internet tekshiruvi: javob 8 s da kelmasa (sekin/uzilgan) - tarmoq ishlarini o'tkazib, o'yinni darhol ochamiz.
     * Yangi o'rnatishda kutamiz (fayllar kerak). Yaxshi internetda ham hammasi 25 s dan oshmaydi */
    BOOL slow = FALSE;
    if (!fresh) {
        status(L"Internet tekshirilmoqda...", 1);
        HANDLE pr = CreateThread(NULL, 0, net_probe, NULL, 0, NULL);
        if (pr) { if (WaitForSingleObject(pr, 8000) != WAIT_OBJECT_0 || !g_probe_ok) slow = TRUE; CloseHandle(pr); }
        DWORD dl = GetTickCount() + (slow ? 1 : 25000); g_net_dl = dl ? dl : 1;
    }
    if (fresh) { g_fresh = TRUE; status(L"O‘rnatilmoqda...", 1); api_call("install", NULL); }

    prune_demos();                                /* ro'yxat saytga to'g'ri ketsin - o'chiriladiganlar oldin o'chadi */
    radar_start();                                /* fonda: overview'i yo'q xaritalarga radar rasmi */
    /* menyu sayti tekshiruvi va .hpk tozalash - yangilanish tekshiruvi bilan bir vaqtda (launcher tezroq ochiladi,
     * ayniqsa sekin internet/disk bo'lgan kompyuterlarda). O'yin ochilishidan oldin kutib olinadi */
    HANDLE side = CreateThread(NULL, 0, side_jobs, NULL, 0, NULL);
    if (!side) side_jobs(NULL);
    fetch_opts();
    if (o_beta >= 0) { lstrcpynA(g_chan, o_beta ? "beta" : "stable", sizeof(g_chan)); ini_save(); }
    if (o_start >= 0) set_autostart(o_start);
    if (o_clean) { status(L"Kesh tozalanmoqda...", 1); clean_cache(); }   /* eskilarini avtomatik tozalash - o'yin ochilgach fonda (cache_maint) */
    if (o_ok) {                                   /* internet bo'lmasa paketlarga tegmaymiz */
        install_spray();
        apply_packs();
    }   /* skrinshotlar o'yin yopilgach yuklanadi (run_game) - o'yin tezroq ochiladi */

    status(L"Yangilanish tekshirilmoqda...", 1);
    UpdInfo u;
    if (get_update(&u)) {
        if (u.msg[0]) {
            wchar_t w[256];
            MultiByteToWideChar(CP_UTF8, 0, u.msg, -1, w, 256);
            MessageBoxW(g_wnd, w, L"X CLIENT", MB_ICONWARNING);
        }
        BOOL autov = ini_int(L"autover") != 0;    /* 7. yiqilish/ochilmaslikdan keyin - hamma fayl tekshiriladi, buzilgani qayta yuklanadi */
        if (autov) { status(L"O‘yin fayllari tekshirilmoqda...", 1); prob_send("autover", 0); }
        BOOL must = fresh || o_verify || autov || (u.min && g_build < u.min);
        if (u.build && u.base[0] && u.manifest[0] && (u.build != g_build || must) && (o_auto || must)) {
            BOOL selfUp = FALSE;
            DWORD keep = g_net_dl; g_net_dl = 0;             /* yangilanish ma'lumoti keldi - internet bor, fayllarni oxirigacha yuklaymiz */
            int fails = sync_files(&u, &selfUp);
            if (keep) { DWORD dl = GetTickCount() + 10000; g_net_dl = dl ? dl : 1; }
            if (fails == 0) {
                if (autov) ini_set_int(L"autover", 0);
                g_build = u.build;
                lstrcpynA(g_version, u.version, sizeof(g_version));
                ini_save();
            } else if (fails > 0 && u.min && g_build < u.min) {
                lstrcpyW(g_err, L"Majburiy yangilanishni yuklab bo‘lmadi. Internetni tekshiring.");
                g_play = FALSE;
            }
            if (selfUp) g_relaunch = TRUE;
        }
        write_master_cfg(u.master);
    }
    if (!g_relaunch) write_master_js();
    if (!g_relaunch && (o_clean || o_verify || o_beta >= 0)) opts_done(cache_mb());
    g_net_dl = 0;                                 /* o'yin fayllari yo'q bo'lsa - yuklash kerak; keyingi ishlar ham cheklovsiz */
    if (!g_relaunch && ensure_game(u.game)) fn_send("inst");
    else if (!g_relaunch) {
        if (!g_err[0]) lstrcpyW(g_err, L"CS 1.6 o‘yin fayllarini o‘rnatib bo‘lmadi. Internetni tekshirib, X CLIENT ni qayta oching.");
        g_play = FALSE;
    }
    if (side) { WaitForSingleObject(side, slow ? 3000 : 20000); CloseHandle(side); }
    if (!g_relaunch && g_play) gpu_check();   /* menyu keshi tozalanib bo'lsin */
    status(L"O‘yin ochilmoqda...", 100);
    if (!g_relaunch) { HANDLE th = CreateThread(NULL, 0, launch_ping, NULL, 0, NULL); if (th) CloseHandle(th); }
    if (slow) prob_send("net_slow", 0);           /* fonda: internet qaytsa yetib boradi */   /* o'yinni kutdirmaydi; yangi launcher o'zi yuboradi */
    /* g_net yopilmaydi: o'yin yopilgach run_game() undan foydalanadi (sozlamalar, skrinshotlar) */
    PostMessageW(g_wnd, WM_XC_DONE, 0, 0);
    return 0;
}

/* ---------------------------------------------------------------- oyna */
static LRESULT CALLBACK wndproc(HWND h, UINT m, WPARAM w, LPARAM l)
{
    switch (m) {
    case WM_XC_STATUS:
        SetWindowTextW(g_txt, g_status);
        SendMessageW(g_bar, PBM_SETPOS, g_pct, 0);
        return 0;
    case WM_XC_DONE:
        DestroyWindow(h);
        return 0;
    case WM_CTLCOLORSTATIC:
        SetTextColor((HDC)w, RGB(236, 230, 234));
        SetBkColor((HDC)w, RGB(20, 17, 24));
        return (LRESULT)GetStockObject(BLACK_BRUSH);
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

/* Eski nom (XClient.exe) bilan ishga tushgan bo'lsak: o'zimizni XCLauncher.exe qilib nusxalaymiz va o'shani ochamiz.
 * Yangi nusxa eski faylni o'chiradi, ish stoli yorlig'i va avto-ishga tushirishni yangi nomga o'tkazadi. */
static BOOL g_migrated = FALSE;
static BOOL migrate_name(void)
{
    wchar_t *base = wcsrchr(g_self, L'\\');
    if (!base || _wcsicmp(base + 1, XC_EXE_LEGACY)) return FALSE;
    wchar_t dir[MAX_PATH], dst[MAX_PATH];
    lstrcpynW(dir, g_self, MAX_PATH);
    dir[base - g_self] = 0;
    path_join(dst, dir, XC_EXE);
    if (!CopyFileW(g_self, dst, FALSE)) return FALSE;
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    if (!CreateProcessW(dst, NULL, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) return FALSE;
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
    return TRUE;
}
static void remove_legacy_exe(void)
{
    wchar_t dir[MAX_PATH], old[MAX_PATH], oldBak[MAX_PATH];
    lstrcpynW(dir, g_self, MAX_PATH);
    wchar_t *bs = wcsrchr(dir, L'\\');
    if (!bs) return;
    *bs = 0;
    path_join(old, dir, XC_EXE_LEGACY);
    _snwprintf(oldBak, MAX_PATH, L"%s.old", old); oldBak[MAX_PATH - 1] = 0;
    DeleteFileW(oldBak);
    if (GetFileAttributesW(old) == INVALID_FILE_ATTRIBUTES) return;
    for (int i = 0; i < 40; i++) {                        /* eski jarayon yopilishini kutamiz (10 s gacha) */
        SetFileAttributesW(old, FILE_ATTRIBUTE_NORMAL);
        if (DeleteFileW(old)) { g_migrated = TRUE; return; }
        Sleep(250);
    }
    MoveFileExW(old, NULL, MOVEFILE_DELAY_UNTIL_REBOOT);
    g_migrated = TRUE;
}
/* yorliq va avto-ishga tushirish eski exe'ga qarab turgan bo'lsa - yangisiga */
static void fix_links_after_migration(void)
{
    if (!g_migrated) return;
    make_shortcut(g_self);
    HKEY k; wchar_t v[MAX_PATH + 4]; DWORD sz = sizeof(v), type = 0;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_QUERY_VALUE, &k) == ERROR_SUCCESS) {
        BOOL had = RegQueryValueExW(k, L"X CLIENT", NULL, &type, (BYTE *)v, &sz) == ERROR_SUCCESS;
        RegCloseKey(k);
        if (had) set_autostart(1);
    }
}

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, LPWSTR cmdline, int show)
{
    (void)hp; (void)cmdline; (void)show;
    CoInitialize(NULL);
    GetModuleFileNameW(NULL, g_self, MAX_PATH);
    if (cmdline && !wcsncmp(cmdline, L"--lantest ", 10)) {   /* avtomatik test: LAN skaner -> faylga */
        g_lan_dump = cmdline + 10; lan_thread(NULL); CoUninitialize(); return 0;
    }
    if (cmdline && !wcsncmp(cmdline, L"--shottest", 10)) {  /* avtomatik test: F11 skrinshot (ekran -> Rasmlar\X CLIENT\*.jpg) */
        shot_thread(NULL); CoUninitialize(); return g_shot_saved ? 0 : 3;
    }
    if (cmdline && !wcsncmp(cmdline, L"--ramtest ", 10)) {  /* avtomatik test: boshqa dasturlar xotirasini bo'shatish -> natija faylga */
        DWORD tot = 0, a0 = ram_avail(&tot); ram_trim(0); Sleep(1500); DWORD a1 = ram_avail(NULL);
        char t[120]; _snprintf(t, sizeof(t), "total=%lu before=%lu after=%lu freed=%ld", (unsigned long)tot, (unsigned long)a0, (unsigned long)a1, (long)a1 - (long)a0); t[119] = 0;
        HANDLE f = CreateFileW(cmdline + 10, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL); if (f != INVALID_HANDLE_VALUE) { DWORD w; WriteFile(f, t, (DWORD)strlen(t), &w, NULL); CloseHandle(f); }
        CoUninitialize(); return 0;
    }
    if (cmdline && !wcsncmp(cmdline, L"--fwtest", 8)) {     /* avtomatik test: LAN server uchun firewall ruxsati (fw_thread) */
        GetCurrentDirectoryW(MAX_PATH, g_dir); fw_thread(NULL); CoUninitialize(); return ini_int(L"fwok") == 1 ? 0 : 3;
    }
    if (cmdline && !wcsncmp(cmdline, L"--perftest ", 11)) {  /* avtomatik test: --perftest <natija.txt> <exe> - o'yin o'rnida exe, yuklama o'lchovi */
        wchar_t *ex = wcschr(cmdline + 11, L' '); if (!ex) return 2; *ex++ = 0; g_perf_dump = cmdline + 11;
        STARTUPINFOW si = { sizeof(si) }; PROCESS_INFORMATION pi; wchar_t c[MAX_PATH]; lstrcpynW(c, ex, MAX_PATH);
        if (!CreateProcessW(ex, c, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) return 4;
        DWORD t0 = GetTickCount(); perf_begin(pi.hProcess); WaitForSingleObject(pi.hProcess, INFINITE); perf_end((GetTickCount() - t0) / 1000);
        CoUninitialize(); return 0;
    }
    if (cmdline && !wcsncmp(cmdline, L"--dmptest ", 10)) {  /* avtomatik test: yiqiladigan exe ni kuzatuvda ochib damp yozish -> %TEMP%\xc_crash.dmp */
        GetCurrentDirectoryW(MAX_PATH, g_dir);
        char raw[760]; dbg_probe(cmdline + 10, cmdline + 10, raw, sizeof(raw));
        wchar_t rf2[MAX_PATH]; GetTempPathW(MAX_PATH, rf2); wcscat(rf2, L"xc_dmptest.txt");
        HANDLE f = CreateFileW(rf2, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (f != INVALID_HANDLE_VALUE) { DWORD w; WriteFile(f, raw, (DWORD)strlen(raw), &w, NULL); CloseHandle(f); }
        CoUninitialize(); return g_dmp[0] ? 0 : 3;
    }
    if (cmdline && !wcsncmp(cmdline, L"--sltest ", 9)) {   /* avtomatik test: skrinshotlar ro'yxati (hello &sl=) -> faylga */
        char sl[1800]; shot_list(sl, sizeof(sl));
        HANDLE f = CreateFileW(cmdline + 9, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (f != INVALID_HANDLE_VALUE) { DWORD w; WriteFile(f, sl, (DWORD)strlen(sl), &w, NULL); CloseHandle(f); }
        CoUninitialize(); return 0;
    }
    if (cmdline && !wcsncmp(cmdline, L"--vftest ", 9)) {   /* avtomatik test (GitHub Windows): --vftest <fmt> <video.mp4> - formatga o'tkazish */
        int f = _wtoi(cmdline + 9); const wchar_t *fp = wcschr(cmdline + 9, L' ');
        BOOL r = fp && rec_load() && vid_reformat(fp + 1, f);
        CoUninitialize(); return r ? 0 : 3;
    }
    if (migrate_name()) { CoUninitialize(); return 0; }
    remove_legacy_exe();
    if (g_migrated) {                                       /* yorliq uchun ishchi papka - exe turgan papka */
        lstrcpynW(g_dir, g_self, MAX_PATH);
        wchar_t *bs = wcsrchr(g_dir, L'\\'); if (bs) *bs = 0;
        fix_links_after_migration();
        g_dir[0] = 0;
    }
    detect_os();

    /* oldingi yangilanishdan qolgan eski exe */
    wchar_t old[MAX_PATH];
    _snwprintf(old, MAX_PATH, L"%s.old", g_self); old[MAX_PATH - 1] = 0;
    DeleteFileW(old);

    /* bitta nusxa: ikki marta bosilsa ikkinchisi bir xil fayllarni bir vaqtda yangilab, o'yinni ikki marta ochmasin */
    HANDLE one = CreateMutexW(NULL, FALSE, L"Local\\XClientLauncher");
    if ((one && GetLastError() == ERROR_ALREADY_EXISTS) || (!one && GetLastError() == ERROR_ACCESS_DENIED)) {   /* denied: admin huquqidagi nusxa ishlayapti */
        if (one) CloseHandle(one);
        CoUninitialize(); return 0;
    }
    g_one = one;

    INITCOMMONCONTROLSEX ic = { sizeof(ic), ICC_PROGRESS_CLASS };
    InitCommonControlsEx(&ic);
    WNDCLASSW wc = {0};
    wc.lpfnWndProc = wndproc;
    wc.hInstance = hi;
    wc.lpszClassName = L"XClientLauncher";
    wc.hbrBackground = CreateSolidBrush(RGB(20, 17, 24));
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon = LoadIconW(hi, MAKEINTRESOURCEW(1));
    RegisterClassW(&wc);
    int W = 460, H = 130;
    g_wnd = CreateWindowExW(WS_EX_TOPMOST, wc.lpszClassName, L"X CLIENT", WS_POPUP | WS_BORDER | WS_VISIBLE,
                            (GetSystemMetrics(SM_CXSCREEN) - W) / 2, (GetSystemMetrics(SM_CYSCREEN) - H) / 2, W, H, NULL, NULL, hi, NULL);
    HFONT big = CreateFontW(26, 0, 0, 0, FW_BOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Tahoma");
    HFONT sm  = CreateFontW(15, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Tahoma");
    HWND t = CreateWindowW(L"STATIC", L"\u2715  X CLIENT", WS_CHILD | WS_VISIBLE, 20, 14, 420, 30, g_wnd, NULL, hi, NULL);
    SendMessageW(t, WM_SETFONT, (WPARAM)big, TRUE);
    g_txt = CreateWindowW(L"STATIC", g_status, WS_CHILD | WS_VISIBLE | SS_ENDELLIPSIS, 20, 52, 420, 20, g_wnd, NULL, hi, NULL);
    SendMessageW(g_txt, WM_SETFONT, (WPARAM)sm, TRUE);
    g_bar = CreateWindowW(PROGRESS_CLASSW, NULL, WS_CHILD | WS_VISIBLE, 20, 84, 420, 18, g_wnd, NULL, hi, NULL);
    SendMessageW(g_bar, PBM_SETRANGE, 0, MAKELPARAM(0, 100));
    SendMessageW(g_bar, PBM_SETBARCOLOR, 0, RGB(255, 59, 59));

    HANDLE th = CreateThread(NULL, 0, worker, NULL, 0, NULL);
    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0) > 0) { TranslateMessage(&msg); DispatchMessageW(&msg); }
    WaitForSingleObject(th, 5000);

    if (g_err[0]) {                                     /* launcher ko'rsatgan har qanday xato - admin > Muammolar ga matni bilan */
        char raw[400]; WideCharToMultiByte(CP_UTF8, 0, g_err, -1, raw, sizeof(raw), NULL, NULL); raw[sizeof(raw) - 1] = 0;
        url_escape(g_probx, sizeof(g_probx), raw); prob_send("launch_err", 4000); g_probx[0] = 0;
        MessageBoxW(NULL, g_err, L"X CLIENT", MB_ICONERROR);
    }
    if (g_relaunch && g_one) { CloseHandle(g_one); g_one = NULL; }   /* yangilangan launcher ochila olsin */
    if (g_relaunch) {
        /* yangi launcher bilan qayta ishga tushamiz */
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi;
        if (CreateProcessW(g_self, NULL, NULL, NULL, FALSE, 0, NULL, g_dir, &si, &pi)) {
            CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
            return 0;
        }
        start_failed(g_self, GetLastError());          /* yangi launcher ochilmadi - o'yin shu (eski) nusxa bilan ochiladi */
    }
    if (g_play) { int tries = 0; while (run_game() && ++tries < 3) ; }   /* yiqilsa - o'yinchi xohlasa qayta ochiladi */
    for (int i = 0; i < 1200 && g_vth_run; i++) Sleep(100);   /* videolar ko'rinishi tugasin (2 daqiqagacha), launcher oynasiz turadi */
    CoUninitialize();
    return 0;
}
