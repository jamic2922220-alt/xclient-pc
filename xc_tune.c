/* =====================================================================
 *  O'yin paytida Windows'ni o'yinga moslash (xclient_launcher.c ichiga #include qilinadi).
 *  Hammasi faqat o'yin ochiq turganda: o'yin yopilgach asl holiga qaytariladi.
 *   - quvvat rejimi "Yuqori unumdorlik" (noutbuklarda FPS ancha ko'tariladi)
 *   - sichqoncha tezlashuvi ("Повышенная точность указателя") o'chadi - aim barqaror
 *   - brauzer, OneDrive, torrent kabi fon dasturlari ustuvorligi pasayadi (yopilmaydi)
 *  Launcher yiqilib qolsa ham: ini da "qaytarish kerak" belgisi qoladi - keyingi ochilishda tiklanadi (tune_recover).
 *  Shuningdek: Windows Game Bar fon yozuvi (FPS ni tushiradi) - o'yinchi menyuda rozi bo'lsa o'chiriladi;
 *  o'yin yiqilsa - shu o'yinda serverdan yuklangan va buzilgan bo'lishi mumkin bo'lgan fayllar chetga olinadi.
 * ===================================================================== */
/* o_tune, o_macc, o_bgp, o_dvroff - xclient_launcher.c da (sayt / menyu beradi; standart - yoqiq) */

/* ---------------- quvvat rejimi ---------------- */
typedef DWORD (WINAPI *PGetScheme)(HKEY, GUID **);
typedef DWORD (WINAPI *PSetScheme)(HKEY, const GUID *);
typedef DWORD (WINAPI *PGetOverlay)(GUID *);
typedef DWORD (WINAPI *PSetOverlay)(const GUID *);
static const GUID XC_HIGHPERF = { 0x8c5e7fda, 0xe8bf, 0x4a96, { 0x9a, 0x85, 0xa6, 0xe2, 0x3a, 0x8c, 0x63, 0x5c } };
static const GUID XC_OVL_BEST = { 0xded574b5, 0x45a0, 0x4f42, { 0x87, 0x37, 0x46, 0x34, 0x5c, 0x09, 0xc2, 0x38 } };   /* Windows 10/11 "Наилучшая производительность" */
static HMODULE g_pw = NULL;
static PGetScheme pGetScheme; static PSetScheme pSetScheme; static PGetOverlay pGetOverlay; static PSetOverlay pSetOverlay;
static BOOL pw_load(void)
{
    if (!g_pw) g_pw = LoadLibraryW(L"powrprof.dll");
    if (!g_pw) return FALSE;
    pGetScheme = (PGetScheme)GetProcAddress(g_pw, "PowerGetActiveScheme");
    pSetScheme = (PSetScheme)GetProcAddress(g_pw, "PowerSetActiveScheme");
    pGetOverlay = (PGetOverlay)GetProcAddress(g_pw, "PowerGetActualOverlayScheme");   /* hujjatlanmagan, Windows 10 1709+ */
    pSetOverlay = (PSetOverlay)GetProcAddress(g_pw, "PowerSetActiveOverlayScheme");
    return pGetScheme && pSetScheme;
}
static void guid_str(const GUID *g, wchar_t *out) { StringFromGUID2(g, out, 40); }
static BOOL guid_parse(const wchar_t *s, GUID *g) { return s[0] == L'{' && SUCCEEDED(CLSIDFromString((LPCOLESTR)s, g)); }
static void ini_str(const wchar_t *k, const wchar_t *v) { wchar_t ini[MAX_PATH]; ini_path(ini); WritePrivateProfileStringW(L"x", k, v, ini); }
static void ini_get(const wchar_t *k, wchar_t *out, DWORD cap) { wchar_t ini[MAX_PATH]; ini_path(ini); GetPrivateProfileStringW(L"x", k, L"", out, cap, ini); }

static void power_on(void)
{
    if (!pw_load()) return;
    GUID *cur = NULL; wchar_t s[40];
    if (pGetScheme(NULL, &cur) == ERROR_SUCCESS && cur) {
        if (!IsEqualGUID(cur, &XC_HIGHPERF) && pSetScheme(NULL, &XC_HIGHPERF) == ERROR_SUCCESS) { guid_str(cur, s); ini_str(L"t_pw", s); }
        LocalFree(cur);
    }
    /* "Yuqori unumdorlik" rejimi yo'q kompyuterlar (zamonaviy noutbuklar): Windows'ning "quvvat rejimi" slayderi */
    GUID ov;
    wchar_t had[40]; ini_get(L"t_pw", had, 40);
    if (!had[0] && pGetOverlay && pSetOverlay && pGetOverlay(&ov) == ERROR_SUCCESS && !IsEqualGUID(&ov, &XC_OVL_BEST)
        && pSetOverlay(&XC_OVL_BEST) == ERROR_SUCCESS) { guid_str(&ov, s); ini_str(L"t_ov", s); }
}
static void power_off(void)
{
    wchar_t s[40]; GUID g;
    ini_get(L"t_pw", s, 40);
    if (s[0] && pw_load() && guid_parse(s, &g)) pSetScheme(NULL, &g);
    ini_get(L"t_ov", s, 40);
    if (s[0] && pw_load() && pSetOverlay && guid_parse(s, &g)) pSetOverlay(&g);
    ini_str(L"t_pw", NULL); ini_str(L"t_ov", NULL);
}

/* ---------------- sichqoncha tezlashuvi ----------------
 * O'yin -noforcemaccel bilan ochiladi (Windows sozlamasini o'zgartirmaydi), shuning uchun "Повышенная точность указателя"
 * yoqiq bo'lsa o'yinda ham ishlaydi (m_rawinput 0 da). Faqat seans uchun o'chiramiz (ro'yxatga yozilmaydi) va qaytaramiz. */
static void macc_off(void)
{
    int m[3];
    if (!SystemParametersInfoW(SPI_GETMOUSE, 0, m, 0) || !m[2]) return;
    wchar_t s[48]; _snwprintf(s, 48, L"%d %d %d", m[0], m[1], m[2]); s[47] = 0;
    m[2] = 0;
    if (SystemParametersInfoW(SPI_SETMOUSE, 0, m, 0)) ini_str(L"t_ma", s);
}
static void macc_restore(void)
{
    wchar_t s[48]; int m[3];
    ini_get(L"t_ma", s, 48);
    if (s[0] && swscanf(s, L"%d %d %d", &m[0], &m[1], &m[2]) == 3) SystemParametersInfoW(SPI_SETMOUSE, 0, m, 0);
    ini_str(L"t_ma", NULL);
}

/* ---------------- fon dasturlari ----------------
 * Ovoz/ovozli chat dasturlari (Discord ...) ro'yxatda yo'q - ularga tegilmaydi. Faqat NORMAL ustuvorlikdagilar pasaytiriladi
 * va qaytarishda faqat o'zimiz pasaytirganlari (hali ham BELOW_NORMAL bo'lsa) NORMAL ga qaytadi. */
static const wchar_t *BGP_NAMES[] = { L"chrome.exe", L"msedge.exe", L"firefox.exe", L"opera.exe", L"browser.exe", L"yandex.exe",
    L"OneDrive.exe", L"Dropbox.exe", L"GoogleDriveFS.exe", L"utorrent.exe", L"bittorrent.exe", L"qbittorrent.exe",
    L"steamwebhelper.exe", L"EpicGamesLauncher.exe", L"MicrosoftEdgeUpdate.exe", L"SearchIndexer.exe" };
#define BGP_MAX 256
static DWORD g_bgp_pid[BGP_MAX]; static FILETIME g_bgp_ct[BGP_MAX]; static int g_bgp_n = 0;
static HANDLE g_bgp_stop = NULL, g_bgp_th = NULL;
static BOOL bgp_known(DWORD pid) { for (int i = 0; i < g_bgp_n; i++) if (g_bgp_pid[i] == pid) return TRUE; return FALSE; }
static void bgp_scan(void)
{
    HANDLE sn = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (sn == INVALID_HANDLE_VALUE) return;
    PROCESSENTRY32W pe; pe.dwSize = sizeof(pe);
    for (BOOL ok = Process32FirstW(sn, &pe); ok; ok = Process32NextW(sn, &pe)) {
        BOOL hit = FALSE;
        for (size_t i = 0; i < sizeof(BGP_NAMES) / sizeof(BGP_NAMES[0]); i++) if (!_wcsicmp(pe.szExeFile, BGP_NAMES[i])) { hit = TRUE; break; }
        if (!hit || g_bgp_n >= BGP_MAX || bgp_known(pe.th32ProcessID)) continue;
        HANDLE h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pe.th32ProcessID);
        if (!h) continue;
        FILETIME c, e, k, u;
        if (GetPriorityClass(h) == NORMAL_PRIORITY_CLASS && GetProcessTimes(h, &c, &e, &k, &u) && SetPriorityClass(h, BELOW_NORMAL_PRIORITY_CLASS)) {
            g_bgp_pid[g_bgp_n] = pe.th32ProcessID; g_bgp_ct[g_bgp_n] = c; g_bgp_n++;
        }
        CloseHandle(h);
    }
    CloseHandle(sn);
}
static DWORD WINAPI bgp_thread(LPVOID unused)
{
    (void)unused;
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    do bgp_scan(); while (WaitForSingleObject(g_bgp_stop, 60000) == WAIT_TIMEOUT);   /* o'yin paytida yangi ochilgan brauzer oynalari ham */
    return 0;
}
static void bgp_restore(void)
{
    for (int i = 0; i < g_bgp_n; i++) {
        HANDLE h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, g_bgp_pid[i]);
        if (!h) continue;
        FILETIME c, e, k, u;   /* PID qayta ishlatilgan bo'lishi mumkin - yaratilgan vaqti bir xil bo'lsagina */
        if (GetProcessTimes(h, &c, &e, &k, &u) && !CompareFileTime(&c, &g_bgp_ct[i]) && GetPriorityClass(h) == BELOW_NORMAL_PRIORITY_CLASS)
            SetPriorityClass(h, NORMAL_PRIORITY_CLASS);
        CloseHandle(h);
    }
    g_bgp_n = 0;
}

/* ---------------- Windows Game Bar fon yozuvi ("Записывать в фоновом режиме") ---------------- */
static const wchar_t *DVR_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR";
static int dvr_state(void)                    /* 1 - fon yozuvi yoqiq (FPS ni tushiradi) */
{
    DWORD v = 0, sz = sizeof(v);
    return RegGetValueW(HKEY_CURRENT_USER, DVR_KEY, L"HistoricalCaptureEnabled", RRF_RT_REG_DWORD, NULL, &v, &sz) == ERROR_SUCCESS && v ? 1 : 0;
}
static void dvr_off(void)                     /* faqat o'yinchi menyuda "O'chirish" ni bosgan bo'lsa (o_dvroff) */
{
    HKEY k; DWORD z = 0;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, DVR_KEY, 0, KEY_SET_VALUE, &k) != ERROR_SUCCESS) return;
    RegSetValueExW(k, L"HistoricalCaptureEnabled", 0, REG_DWORD, (const BYTE *)&z, sizeof(z));
    RegCloseKey(k);
}

/* ---------------- o'yin seansi ---------------- */
static void tune_begin(void)
{
    if (o_dvroff && dvr_state()) dvr_off();
    if (!o_tune) return;                          /* "O'yin uchun Windows'ni moslash" o'chiq */
    power_on();
    if (o_macc) macc_off();
    if (o_bgp && (g_bgp_stop = CreateEventW(NULL, TRUE, FALSE, NULL)) != NULL) g_bgp_th = CreateThread(NULL, 0, bgp_thread, NULL, 0, NULL);
}
static void tune_end(void)
{
    if (g_bgp_th) { SetEvent(g_bgp_stop); WaitForSingleObject(g_bgp_th, 5000); CloseHandle(g_bgp_th); g_bgp_th = NULL; }
    if (g_bgp_stop) { CloseHandle(g_bgp_stop); g_bgp_stop = NULL; }
    bgp_restore();
    macc_restore();
    power_off();
}
/* launcher oldingi safar o'yin paytida yopilib qolgan (o'chirilgan, yiqilgan): qolgan o'zgarishlarni qaytarish */
static void tune_recover(void) { macc_restore(); power_off(); }

/* ---------------- o'yin yiqilsa ----------------
 * CS 1.6 ko'pincha serverdan yuklangan buzilgan fayl (model, sprayt, ovoz, xarita) tufayli serverga kirganda yiqiladi.
 * Shu o'yin davomida, yiqilishdan oldingi 10 daqiqada cstrike_downloads ga tushgan fayllar xc_backup\crash ga ko'chiriladi -
 * keyingi kirishda server ularni qaytadan, butun holda beradi. 7 kundan keyin zaxira o'chiriladi. */
static BOOL crash_code(DWORD code) { return code >= 0xC0000000u; }   /* Windows istisnosi (access violation, stack overflow ...) */
static const wchar_t *CRASH_EXT[] = { L".mdl", L".spr", L".wav", L".mp3", L".bsp", L".wad", L".tga", L".bmp", L".res" };
static void crash_walk(const wchar_t *dir, const wchar_t *rel, ULONGLONG from, const wchar_t *dst, int *n, int depth)
{
    wchar_t pat[MAX_PATH], p[MAX_PATH], r[MAX_PATH];
    if (depth > 5) return;
    _snwprintf(pat, MAX_PATH, L"%s\\*", dir); pat[MAX_PATH - 1] = 0;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..") || (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) continue;
        _snwprintf(p, MAX_PATH, L"%s\\%s", dir, fd.cFileName); p[MAX_PATH - 1] = 0;
        _snwprintf(r, MAX_PATH, L"%s%s%s", rel, rel[0] ? L"\\" : L"", fd.cFileName); r[MAX_PATH - 1] = 0;
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) { crash_walk(p, r, from, dst, n, depth + 1); continue; }
        ULONGLONG ct = ((ULONGLONG)fd.ftCreationTime.dwHighDateTime << 32) | fd.ftCreationTime.dwLowDateTime;
        ULONGLONG wt = ((ULONGLONG)fd.ftLastWriteTime.dwHighDateTime << 32) | fd.ftLastWriteTime.dwLowDateTime;
        if ((ct > wt ? ct : wt) < from) continue;
        const wchar_t *ext = wcsrchr(fd.cFileName, L'.');
        BOOL ok = FALSE;
        for (size_t i = 0; ext && i < sizeof(CRASH_EXT) / sizeof(CRASH_EXT[0]); i++) if (!_wcsicmp(ext, CRASH_EXT[i])) { ok = TRUE; break; }
        if (!ok) continue;
        wchar_t to[MAX_PATH]; _snwprintf(to, MAX_PATH, L"%s\\%s", dst, r); to[MAX_PATH - 1] = 0;
        mkdirs_for(to);
        if (MoveFileExW(p, to, MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED)) (*n)++;
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
/* t0 - o'yin ochilgan vaqt (FILETIME). Qaytaradi: chetga olingan fayllar soni */
static int crash_fix(ULONGLONG t0)
{
    FILETIME nf; GetSystemTimeAsFileTime(&nf);
    ULONGLONG now = ((ULONGLONG)nf.dwHighDateTime << 32) | nf.dwLowDateTime, win = now - 10ULL * 60 * 10000000;
    ULONGLONG from = t0 > win ? t0 : win;
    wchar_t src[MAX_PATH], dst[MAX_PATH], sub[64];
    SYSTEMTIME st; GetLocalTime(&st);
    _snwprintf(sub, 64, L"xc_backup\\crash\\%04u%02u%02u_%02u%02u%02u", st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond); sub[63] = 0;
    path_join(src, g_dir, L"cstrike_downloads");
    path_join(dst, g_dir, sub);
    int n = 0;
    crash_walk(src, L"", from, dst, &n, 0);
    clean_hpk();
    return n;
}
static void crash_prune(void)
{
    wchar_t base[MAX_PATH], pat[MAX_PATH];
    path_join(base, g_dir, L"xc_backup\\crash");
    _snwprintf(pat, MAX_PATH, L"%s\\*", base); pat[MAX_PATH - 1] = 0;
    FILETIME nf; GetSystemTimeAsFileTime(&nf);
    ULONGLONG cut = (((ULONGLONG)nf.dwHighDateTime << 32) | nf.dwLowDateTime) - 7ULL * 86400 * 10000000;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || fd.cFileName[0] == L'.') continue;
        ULONGLONG ct = ((ULONGLONG)fd.ftCreationTime.dwHighDateTime << 32) | fd.ftCreationTime.dwLowDateTime;
        if (ct >= cut) continue;
        wchar_t d[MAX_PATH + 2]; _snwprintf(d, MAX_PATH, L"%s\\%s", base, fd.cFileName); d[MAX_PATH - 1] = 0;
        size_t L = wcslen(d); d[L + 1] = 0;
        SHFILEOPSTRUCTW op = { 0 }; op.wFunc = FO_DELETE; op.pFrom = d;
        op.fFlags = FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI;
        SHFileOperationW(&op);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}
