/* =====================================================================
 *  X CLIENT — ishga tushiruvchi (launcher) va avto-yangilovchi
 *
 *  1) Birinchi marta ("X CLIENT Setup.exe"): C:\Games\XClient ga o'rnatadi,
 *     ish stolida yorliq yaratadi, serverga "install" yuboradi.
 *  2) Har ishga tushganda: serverdan eng yangi versiyani so'raydi (vetka:
 *     stable/beta), o'zgargan fayllarnigina yuklab oladi (SHA-256 bilan
 *     tekshiriladi), "launch" yuboradi va o'yinni ochadi.
 *  3) Internet bo'lmasa — o'yin baribir ochiladi.
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
#include <shlobj.h>
#include <objbase.h>
#include <shobjidl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef XC_API
#define XC_API "https://mmb.boost-top.com/xclient/api.php"
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
typedef struct { char status[16], version[32], base[512], manifest[512], master[512], msg[256]; int build, min; } UpdInfo;

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
    if (_wcsicmp(dst, g_self)) CopyFileW(g_self, dst, FALSE);
    make_shortcut(dst);
    *fresh = TRUE;
    lstrcpyW(g_self, dst);
    return TRUE;
}

/* ---------------------------------------------------------------- o'yin */
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

static BOOL g_fresh = FALSE;
static void run_game(void)
{
    wchar_t exe[MAX_PATH], cmd[1024];
    /* X CLIENT oynasi (x-ui) bo'lsa - o'shani ochamiz, o'yinni u ishga tushiradi */
    wchar_t ui[MAX_PATH];
    path_join(ui, g_dir, L"x-ui\\XClientUI.exe");
    if (GetFileAttributesW(ui) != INVALID_FILE_ATTRIBUTES) {
        STARTUPINFOW si0 = { sizeof(si0) };
        PROCESS_INFORMATION pi0;
        wchar_t uidir[MAX_PATH];
        path_join(uidir, g_dir, L"x-ui");
        if (CreateProcessW(ui, NULL, NULL, NULL, FALSE, 0, NULL, uidir, &si0, &pi0)) {
            CloseHandle(pi0.hThread); CloseHandle(pi0.hProcess);
            return;
        }
    }
    path_join(exe, g_dir, L"hl.exe");
    if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxW(NULL, L"O‘yin fayllari (hl.exe) topilmadi. X CLIENT ni to‘liq paketdan qayta o‘rnating.", L"X CLIENT", MB_ICONERROR);
        return;
    }
    _snwprintf(cmd, 1024, L"\"%s\" -game cstrike -noforcemparms -noforcemaccel +exec xclient_launcher.cfg", exe);
    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi;
    if (CreateProcessW(exe, cmd, NULL, NULL, FALSE, 0, NULL, g_dir, &si, &pi)) {
        CloseHandle(pi.hThread);
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

    status(L"Yangilanish tekshirilmoqda...", 1);
    UpdInfo u;
    if (get_update(&u)) {
        if (u.msg[0]) {
            wchar_t w[256];
            MultiByteToWideChar(CP_UTF8, 0, u.msg, -1, w, 256);
            MessageBoxW(g_wnd, w, L"X CLIENT", MB_ICONWARNING);
        }
        if (u.build && u.base[0] && u.manifest[0] && (u.build != g_build || fresh)) {
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
