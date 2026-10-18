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
#include <wininet.h>
#include <wincrypt.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <objbase.h>
#include <shobjidl.h>
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
#define XC_VERSION_FILE L"xclient_version.txt"
#define WM_XC_STATUS (WM_APP + 1)
#define WM_XC_DONE   (WM_APP + 2)

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
static HINTERNET open_url(const char *url)
{
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
    while (InternetReadFile(h, buf, sizeof(buf), &got)) {
        if (!got) break;
        if (!WriteFile(f, buf, got, &wr, NULL) || wr != got) { ok = FALSE; break; }
    }
    CloseHandle(f);
    InternetCloseHandle(h);
    return ok;
}

/* katta faylni foiz bilan yuklash (o'yin o'rnatuvchisi) */
static BOOL http_download_pct(const char *url, const wchar_t *dst, const wchar_t *label)
{
    HINTERNET h = open_url(url);
    if (!h) return FALSE;
    DWORD total = 0, len = sizeof(total);
    HttpQueryInfoA(h, HTTP_QUERY_CONTENT_LENGTH | HTTP_QUERY_FLAG_NUMBER, &total, &len, NULL);
    HANDLE f = CreateFileW(dst, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { InternetCloseHandle(h); return FALSE; }
    static char buf[65536];
    DWORD got, wr;
    ULONGLONG n = 0;
    int lastPct = -1;
    BOOL ok = TRUE;
    while ((ok = InternetReadFile(h, buf, sizeof(buf), &got)) != FALSE) {
        if (!got) break;
        if (!WriteFile(f, buf, got, &wr, NULL) || wr != got) { ok = FALSE; break; }
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
        MultiByteToWideChar(CP_UTF8, 0, rel, -1, wrel, MAX_PATH);
        path_join(dst, g_dir, wrel);

        if (onlyMissing && GetFileAttributesW(dst) != INVALID_FILE_ATTRIBUTES) continue;
        BOOL isSelf = !_wcsicmp(wrel, L"XClient.exe");
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
        _snwprintf(tmp, MAX_PATH, L"%s.xcdl", dst);

        BOOL ok = FALSE;
        for (int attempt = 0; attempt < 3 && !ok; attempt++) {
            if (http_download(url, tmp) && sha256_file(tmp, have, &hs) && hs == size && !_stricmp(have, sha)) ok = TRUE;
            else Sleep(800);
        }
        if (!ok) { DeleteFileW(tmp); fails++; continue; }

        if (isSelf) {
            wchar_t old[MAX_PATH];
            _snwprintf(old, MAX_PATH, L"%s.old", g_self);
            DeleteFileW(old);
            if (MoveFileExW(g_self, old, MOVEFILE_REPLACE_EXISTING) && MoveFileExW(tmp, g_self, MOVEFILE_REPLACE_EXISTING))
                *selfUpdated = TRUE;
            else DeleteFileW(tmp);
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
    _snwprintf(lnk, MAX_PATH, L"%s\\X CLIENT.lnk", desk);
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
    path_join(dst, g_dir, L"XClient.exe");
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

static BOOL run_setup(const wchar_t *exe, const wchar_t *params)
{
    SHELLEXECUTEINFOW sei = { sizeof(sei) };
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.lpVerb = L"runas";               /* o'rnatuvchi administrator huquqini so'raydi */
    sei.lpFile = exe;
    sei.lpParameters = params;
    sei.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&sei) || !sei.hProcess) return FALSE;
    WaitForSingleObject(sei.hProcess, INFINITE);
    CloseHandle(sei.hProcess);
    return TRUE;
}

/* O'yin yo'q bo'lsa - asl boost-top PRO o'rnatuvchisini yuklab, shu papkaga o'rnatamiz */
static BOOL ensure_game(const char *url)
{
    if (has_game()) return TRUE;
    if (!url || !*url) url = XC_GAME_URL;
    wchar_t tmp[MAX_PATH], params[1024];
    GetTempPathW(MAX_PATH, tmp);
    wcscat(tmp, L"xc_cs16_setup.exe");
    BOOL ok = FALSE;
    for (int i = 0; i < 3 && !ok; i++) {
        ok = http_download_pct(url, tmp, L"CS 1.6 yuklanmoqda:");
        if (!ok) { status(L"Yuklab bo‘lmadi, qayta urinilmoqda...", 0); Sleep(2000); }
    }
    if (!ok) { DeleteFileW(tmp); return FALSE; }
    status(L"CS 1.6 o‘rnatilmoqda... (ruxsat so‘ralsa \"Ha\" ni bosing)", 100);
    SetWindowPos(g_wnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    _snwprintf(params, 1024, L"/SILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS=\"\" /LANG=uzbek /DIR=\"%s\"", g_dir);
    run_setup(tmp, params);
    if (!has_game()) {
        /* jim rejim ishlamasa - oddiy oynali o'rnatish (papka oldindan tanlangan) */
        _snwprintf(params, 1024, L"/SP- /NOICONS /LANG=uzbek /DIR=\"%s\"", g_dir);
        run_setup(tmp, params);
    }
    DeleteFileW(tmp);
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
static BOOL same_file(const wchar_t *a, const wchar_t *b)
{
    char ha[65], hb[65];
    ULONGLONG sa = 0, sb = 0;
    return sha256_file(a, ha, &sa) && sha256_file(b, hb, &sb) && sa == sb && !strcmp(ha, hb);
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
        path_join(from, src, fd.cFileName);
        path_join(to, g_dir, r);
        if (GetFileAttributesW(to) != INVALID_FILE_ATTRIBUTES) {
            if (same_file(from, to)) continue;
            _snwprintf(bak, MAX_PATH, L"%s\\xclient_backup\\%s", g_dir, r);
            bak[MAX_PATH - 1] = 0;
            if (GetFileAttributesW(bak) == INVALID_FILE_ATTRIBUTES) { mkdirs_for(bak); CopyFileW(to, bak, TRUE); }
        }
        mkdirs_for(to);
        SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL);
        CopyFileW(from, to, FALSE);
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
        if (!file_exists(from)) continue;
        mkdirs_for(to); SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL); CopyFileW(from, to, FALSE);
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
        mkdirs_for(to); SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL); CopyFileW(from, to, FALSE);
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
 * 2) O'yin ochilgandan keyin bir necha daqiqa kuzatamiz: fayl qaytarilsa - X CLIENT nikini qayta qo'yamiz. */
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
        if (!file_exists(to) || !same_file(from, to)) { mkdirs_for(to); SetFileAttributesW(to, FILE_ATTRIBUTE_NORMAL); CopyFileW(from, to, FALSE); }
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
    /* boshqa til tanlangan bo'lsa (Steam/NextClient sozlamasi) - o'sha papkaga ham */
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", 0, KEY_QUERY_VALUE, &k) == ERROR_SUCCESS) {
        if (RegQueryValueExW(k, L"Language", NULL, &type, (BYTE *)w, &sz) == ERROR_SUCCESS && type == REG_SZ) lstrcpynW(lang, w, 32);
        RegCloseKey(k);
    }
    for (wchar_t *c = lang; *c; c++) if (!((*c >= L'a' && *c <= L'z') || (*c >= L'A' && *c <= L'Z'))) { lang[0] = 0; break; }
    if (lang[0] && _wcsicmp(lang, L"russian") && _wcsicmp(lang, L"english")) lang_bg_dir(lang);
}
static BOOL theme_changed(const wchar_t *rel)
{
    wchar_t a[MAX_PATH], b[MAX_PATH], t[MAX_PATH];
    path_join(t, L"xc_theme", rel);
    path_join(a, g_dir, t); path_join(b, g_dir, rel);
    return file_exists(a) && !same_file(a, b);
}
static void guard_theme(HANDLE game)
{
    const wchar_t *watch[] = { L"platform\\mmb_error_page.html", L"cstrike\\resource\\background\\bt_1_1.tga",
        L"cstrike\\resource\\BackgroundLoadingLayout.txt", L"platform\\mmb\\bg_1920.jpg" };
    DWORD start = GetTickCount();
    while (GetTickCount() - start < 240000) {              /* 4 daqiqa */
        if (WaitForSingleObject(game, 1500) == WAIT_OBJECT_0) break;   /* o'yin yopildi */
        for (int i = 0; i < 4; i++) if (theme_changed(watch[i])) { apply_theme_dir(L""); break; }
    }
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
    fprintf(f, "// X CLIENT\nscr_drawversion \"0\"\n");
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
static int  o_beta = -1, o_auto = 1, o_start = -1, o_win = 0, o_clean = 0, o_verify = 0;
static int  o_prio = 0, o_shots = 0, o_spray = 0, o_ok = 0, o_hud = 100;   /* o_hud: HUD kattaligi, % */   /* o_ok: sozlamalar saytdan olindi */
static char o_res[16] = "", o_packs[256] = "";

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
    _snprintf(out, cap, "&ram=%u&cpu=%u&gpu=%s&res=%dx%d&os=%s&ch=%s&pt=%s", ram, (unsigned)si.dwNumberOfProcessors, eg,
        GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN), ew, g_chan, ek); out[cap - 1] = 0;
}
static unsigned cache_mb(void);
static void fetch_opts(void)
{
    char url[1200], hw[800];
    char v[48];
    url_escape(v, sizeof(v), g_version[0] ? g_version : "1.0");
    hw_query(hw, sizeof(hw));
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=hello&d=%s&v=%s&cache=%u%s", g_id, v, cache_mb(), hw); url[sizeof(url) - 1] = 0;
    char *r = http_get(url, NULL);
    if (!r || !strstr(r, "\"ok\":true")) { free(r); return; }
    o_beta = jint(r, "beta", -1); o_auto = jint(r, "auto", 1); o_start = jint(r, "start", -1);
    o_win = jint(r, "win", 0); o_clean = jint(r, "clean", 0); o_verify = jint(r, "verify", 0);
    o_prio = jint(r, "prio", 0); o_hud = jint(r, "hud", 100); o_shots = jint(r, "shots", 0); o_spray = jint(r, "spray", 0);
    jstr(r, "packs", o_packs, sizeof(o_packs));
    o_ok = 1;
    const char *p = strstr(r, "\"res\":\"");
    unsigned w = 0, h = 0;
    if (p && sscanf(p + 7, "%ux%u", &w, &h) == 2 && w >= 640 && w <= 7680 && h >= 480 && h <= 4320) _snprintf(o_res, sizeof(o_res), "%ux%u", w, h);
    free(r);
}
static void opts_done(unsigned cacheMb)
{
    char url[320], v[48];
    url_escape(v, sizeof(v), g_version[0] ? g_version : "1.0");
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

/* ---------------------------------------------------------------- Kontent (menyudan tanlanadi) */
static BOOL file_exists(const wchar_t *p) { return GetFileAttributesW(p) != INVALID_FILE_ATTRIBUTES; }
static int ini_int(const wchar_t *k) { wchar_t ini[MAX_PATH]; ini_path(ini); return GetPrivateProfileIntW(L"x", k, 0, ini); }
static void ini_set_int(const wchar_t *k, int v) { wchar_t ini[MAX_PATH], w[24]; ini_path(ini); _snwprintf(w, 24, L"%d", v); WritePrivateProfileStringW(L"x", k, w, ini); }

/* Spray: menyu tayyorlagan tempdecal.wad ni o'rnatish */
static void install_spray(void)
{
    if (o_spray <= 0 || o_spray == ini_int(L"sprayt")) return;
    wchar_t dst[MAX_PATH], tmp[MAX_PATH];
    char url[256];
    path_join(dst, g_dir, L"cstrike\\tempdecal.wad");
    path_join(tmp, g_dir, L"cstrike\\tempdecal.xcdl");
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=spray_get&d=%s", g_id); url[sizeof(url) - 1] = 0;
    status(L"Spray o‘rnatilmoqda...", 1);
    if (!http_download(url, tmp)) { DeleteFileW(tmp); return; }
    SetFileAttributesW(dst, FILE_ATTRIBUTE_NORMAL);
    if (MoveFileExW(tmp, dst, MOVEFILE_REPLACE_EXISTING)) {
        SetFileAttributesW(dst, FILE_ATTRIBUTE_READONLY);   /* o'yin ustidan yozib yubormasin */
        ini_set_int(L"sprayt", o_spray);
    } else DeleteFileW(tmp);
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
        if (!safe_rel(line) || _strnicmp(u, "http", 4)) continue;
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
            if (!in_list(now, id) && strlen(now) + n + 2 < sizeof(now) && pack_install(id)) { if (now[0]) strcat(now, ","); strcat(now, id); }
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
    const wchar_t *val = L"~ DISABLEDXMAXIMIZEDWINDOWEDMODE";
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers", 0, NULL, 0, KEY_QUERY_VALUE | KEY_SET_VALUE, NULL, &k, NULL) != ERROR_SUCCESS) return;
    if (on) RegSetValueExW(k, exe, 0, REG_SZ, (const BYTE *)val, (DWORD)((wcslen(val) + 1) * sizeof(wchar_t)));
    else {
        wchar_t cur[128]; DWORD sz = sizeof(cur), type = 0;
        if (RegQueryValueExW(k, exe, NULL, &type, (BYTE *)cur, &sz) == ERROR_SUCCESS && type == REG_SZ && !wcscmp(cur, val)) RegDeleteValueW(k, exe);
    }
    RegCloseKey(k);
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
            best[slot] = t; path_join(names[slot], g_dir, L"cstrike"); path_join(names[slot], names[slot], fd.cFileName);
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

/* Bosh menyu manzili oddiy http://mmb.boost-top.com/index.html bo'lib qoladi - o'yin brauzeri
 * "?..." qo'shimchali manzilni ocholmadi (xato sahifasi chiqdi). Oldingi versiyalar yozgan
 * file:/// yoki ?xc= manzilini shu yerda qaytaramiz. Kompyuter id'si menyuga sayt orqali (IP bo'yicha) yetadi. */
static void setup_main_menu(void)
{
    wchar_t home[MAX_PATH];
    path_join(home, g_dir, L"platform\\mmb_home_page.html");
    long n = 0;
    char *cur = read_all(home, &n);
    if (cur && (strstr(cur, "?xc=") || (strstr(cur, "file:///") && strstr(cur, "xclient")))) {
        SetFileAttributesW(home, FILE_ATTRIBUTE_NORMAL);
        FILE *f = _wfopen(home, L"wb");
        if (f) { fputs(XC_SITE "index.html", f); fclose(f); }
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

static void run_game(void)
{
    wchar_t exe[MAX_PATH], cmd[1024];
    remove_old_ui();
    apply_theme_dir(L"");
    fix_override_bg();
    lang_bg();
    setup_main_menu();
    ensure_scheme();
    ensure_launcher_cfg();
    if (o_ok) hud_scale();
    path_join(exe, g_dir, L"cstrike.exe");
    if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) path_join(exe, g_dir, L"hl.exe");
    if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxW(NULL, L"O‘yin fayllari (cstrike.exe) topilmadi. X CLIENT ni to‘liq paketdan qayta o‘rnating.", L"X CLIENT", MB_ICONERROR);
        return;
    }
    wchar_t vid[64] = L"";
    unsigned w = 0, h = 0;
    if (o_res[0] && sscanf(o_res, "%ux%u", &w, &h) == 2) _snwprintf(vid, 64, L" -width %u -height %u%s", w, h, o_win ? L" -window" : L" -full");
    else if (o_win) lstrcpyW(vid, L" -window");
    _snwprintf(cmd, 1024, L"\"%s\" -game cstrike%s -noforcemparms -noforcemaccel +exec xclient_launcher.cfg", exe, vid);
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    if (o_ok) compat_flags(exe, o_prio);
    if (CreateProcessW(exe, cmd, NULL, NULL, FALSE, 0, NULL, g_dir, &si, &pi)) {
        if (o_prio) SetPriorityClass(pi.hProcess, HIGH_PRIORITY_CLASS);   /* "O'yinni tezlashtirish" */
        CloseHandle(pi.hThread);
        guard_theme(pi.hProcess);
        CloseHandle(pi.hProcess);
    }
}

/* ---------------------------------------------------------------- ish oqimi */
static BOOL g_relaunch = FALSE, g_play = TRUE;
static wchar_t g_err[256] = L"";

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
    if (!g_key[0]) read_trailer();
    make_id();
    ini_save();

    g_net = InternetOpenA("XClient", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    DWORD to = 15000;
    InternetSetOptionA(g_net, INTERNET_OPTION_CONNECT_TIMEOUT, &to, sizeof(to));
    InternetSetOptionA(g_net, INTERNET_OPTION_RECEIVE_TIMEOUT, &to, sizeof(to));

    if (fresh) { g_fresh = TRUE; status(L"O‘rnatilmoqda...", 1); api_call("install", NULL); }

    fetch_opts();
    if (o_beta >= 0) { lstrcpynA(g_chan, o_beta ? "beta" : "stable", sizeof(g_chan)); ini_save(); }
    if (o_start >= 0) set_autostart(o_start);
    if (o_clean) { status(L"Kesh tozalanmoqda...", 1); clean_cache(); }
    if (o_ok) {                                   /* internet bo'lmasa paketlarga tegmaymiz */
        install_spray();
        apply_packs();
        if (o_shots) upload_shots();
    }

    status(L"Yangilanish tekshirilmoqda...", 1);
    UpdInfo u;
    if (get_update(&u)) {
        if (u.msg[0]) {
            wchar_t w[256];
            MultiByteToWideChar(CP_UTF8, 0, u.msg, -1, w, 256);
            MessageBoxW(g_wnd, w, L"X CLIENT", MB_ICONWARNING);
        }
        BOOL must = fresh || o_verify || (u.min && g_build < u.min);
        if (u.build && u.base[0] && u.manifest[0] && (u.build != g_build || must) && (o_auto || must)) {
            BOOL selfUp = FALSE;
            int fails = sync_files(&u, &selfUp);
            if (fails == 0) {
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
    if (!g_relaunch && !ensure_game(u.game)) {
        lstrcpyW(g_err, L"CS 1.6 o‘yin fayllarini o‘rnatib bo‘lmadi. Internetni tekshirib, X CLIENT ni qayta oching.");
        g_play = FALSE;
    }
    status(L"O‘yin ochilmoqda...", 100);
    if (!g_relaunch) api_call("launch", NULL);   /* yangi launcher o'zi yuboradi */
    InternetCloseHandle(g_net);
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

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE hp, LPWSTR cmdline, int show)
{
    (void)hp; (void)cmdline; (void)show;
    CoInitialize(NULL);
    GetModuleFileNameW(NULL, g_self, MAX_PATH);
    detect_os();

    /* oldingi yangilanishdan qolgan eski exe */
    wchar_t old[MAX_PATH];
    _snwprintf(old, MAX_PATH, L"%s.old", g_self);
    DeleteFileW(old);

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

    if (g_err[0]) MessageBoxW(NULL, g_err, L"X CLIENT", MB_ICONERROR);
    if (g_relaunch) {
        /* yangi launcher bilan qayta ishga tushamiz */
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi;
        if (CreateProcessW(g_self, NULL, NULL, NULL, FALSE, 0, NULL, g_dir, &si, &pi)) {
            CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
            return 0;
        }
    }
    if (g_play) run_game();
    CoUninitialize();
    return 0;
}
