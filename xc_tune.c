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

/* ---------------- o'yin yiqildimi yoki oddiy yopildimi ----------------
 * CS 1.6 oddiy yopilganda ham (Выход, quit, oynani yopish) ko'pincha oxirida 0xC0000005 bilan tugaydi - o'yinchi buni sezmaydi.
 * Lekin oddiy chiqishda o'yin avval sozlamalarni config.cfg ga yozadi, keyin yopiladi; haqiqiy yiqilishda config.cfg yozilmaydi.
 * Shuning uchun: xato kodi bor, lekin config.cfg o'yin tugashidan oldingi 30 soniyada yozilgan bo'lsa - bu oddiy chiqish. */
static BOOL crash_code(DWORD code);
static BOOL cfg_written_since(ULONGLONG from)
{
    wchar_t p[MAX_PATH]; WIN32_FILE_ATTRIBUTE_DATA fa;
    path_join(p, g_dir, L"cstrike\\config.cfg");
    if (!GetFileAttributesExW(p, GetFileExInfoStandard, &fa)) return FALSE;
    return (((ULONGLONG)fa.ftLastWriteTime.dwHighDateTime << 32) | fa.ftLastWriteTime.dwLowDateTime) >= from;
}
static BOOL game_crashed(DWORD code, ULONGLONG t0)
{
    if (!crash_code(code)) return FALSE;
    FILETIME nf; GetSystemTimeAsFileTime(&nf);
    ULONGLONG now = ((ULONGLONG)nf.dwHighDateTime << 32) | nf.dwLowDateTime, from = now - 30ULL * 10000000;
    return !cfg_written_since(from > t0 ? from : t0);
}

/* ---------------- o'yin seansi ---------------- */
/* Shift 5 marta (Sticky Keys), o'ng Shift 8 soniya (Filter Keys), NumLock 5 soniya (Toggle Keys) - Windows so'rov oynasini ochib,
 * o'yinni yig'ib qo'yadi. O'yin paytida faqat shu "tezkor tugma" o'chadi (funksiyaning o'zi yoqilgan bo'lsa - tegmaymiz).
 * SPIF_UPDATEINIFILE yo'q: o'zgarish profilga yozilmaydi, launcher to'satdan yopilsa ham kompyuter qayta yoqilganda qaytadi */
static STICKYKEYS g_sk0; static FILTERKEYS g_fk0; static TOGGLEKEYS g_tk0; static BOOL g_acc = FALSE;
static void acc_off(void)
{
    g_sk0.cbSize = sizeof(g_sk0); g_fk0.cbSize = sizeof(g_fk0); g_tk0.cbSize = sizeof(g_tk0);
    if (!SystemParametersInfoW(SPI_GETSTICKYKEYS, sizeof(g_sk0), &g_sk0, 0) || !SystemParametersInfoW(SPI_GETFILTERKEYS, sizeof(g_fk0), &g_fk0, 0)
        || !SystemParametersInfoW(SPI_GETTOGGLEKEYS, sizeof(g_tk0), &g_tk0, 0)) return;
    g_acc = TRUE;
    STICKYKEYS sk = g_sk0; FILTERKEYS fk = g_fk0; TOGGLEKEYS tk = g_tk0;
    if (!(sk.dwFlags & SKF_STICKYKEYSON)) { sk.dwFlags &= ~(SKF_HOTKEYACTIVE | SKF_CONFIRMHOTKEY); SystemParametersInfoW(SPI_SETSTICKYKEYS, sizeof(sk), &sk, 0); }
    if (!(fk.dwFlags & FKF_FILTERKEYSON)) { fk.dwFlags &= ~(FKF_HOTKEYACTIVE | FKF_CONFIRMHOTKEY); SystemParametersInfoW(SPI_SETFILTERKEYS, sizeof(fk), &fk, 0); }
    if (!(tk.dwFlags & TKF_TOGGLEKEYSON)) { tk.dwFlags &= ~(TKF_HOTKEYACTIVE | TKF_CONFIRMHOTKEY); SystemParametersInfoW(SPI_SETTOGGLEKEYS, sizeof(tk), &tk, 0); }
}
static void acc_restore(void)
{
    if (!g_acc) return;
    g_acc = FALSE;
    SystemParametersInfoW(SPI_SETSTICKYKEYS, sizeof(g_sk0), &g_sk0, 0);
    SystemParametersInfoW(SPI_SETFILTERKEYS, sizeof(g_fk0), &g_fk0, 0);
    SystemParametersInfoW(SPI_SETTOGGLEKEYS, sizeof(g_tk0), &g_tk0, 0);
}
static void tune_begin(void)
{
    acc_off();                                    /* "Залипание клавиш" oynasi o'yinni yig'ib qo'ymasin (har doim) */
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
    acc_restore();
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

/* ---- O'yin paytidagi yuklama (lag sababini aniqlash uchun): har 5 soniyada o'yin protsessorni qancha band qilyapti.
 * CS 1.6 bitta yadroda ishlaydi: o'yin bitta yadroning ~90%+ ini olsa - FPS kompyuter kuchiga tiralgan (FPS lag).
 * Kam olsa-yu lag bo'lsa - sabab internet (ping/yo'qotish, buni menyu o'lchaydi). Yakunda saytga: ?a=perfl ---- */
typedef struct { HANDLE h; DWORD cores; int n, n90; double gsum, ssum; DWORD ramMin; } PerfSt;
static PerfSt g_perf; static HANDLE g_perf_th = NULL; static const wchar_t *g_perf_dump = NULL;   /* test: natija faylga */
static DWORD WINAPI perf_thread(LPVOID unused)
{
    (void)unused;
    FILETIME c, e, k, u, si, sk, su; ULONGLONG pg = 0, pw = 0, ps_i = 0, ps_t = 0; int warm = 12;   /* birinchi 60 s - yuklanish, hisobga olinmaydi */
    while (WaitForSingleObject(g_perf.h, 5000) == WAIT_TIMEOUT) {
        FILETIME now; GetSystemTimeAsFileTime(&now);
        if (!GetProcessTimes(g_perf.h, &c, &e, &k, &u) || !GetSystemTimes(&si, &sk, &su)) continue;
        ULONGLONG g = ft64(k) + ft64(u), w = ft64(now), sI = ft64(si), sT = ft64(sk) + ft64(su);   /* sk ichida idle ham bor */
        if (pw && w > pw && sT > ps_t && warm <= 0) {
            double gc = (double)(g - pg) / (double)(w - pw);            /* 1.0 = bitta yadro to'liq band */
            double sc = 1.0 - (double)(sI - ps_i) / (double)(sT - ps_t);  /* butun protsessor */
            if (gc > 4) gc = 4; if (sc < 0) sc = 0; if (sc > 1) sc = 1;
            g_perf.gsum += gc; g_perf.ssum += sc; g_perf.n++; if (gc >= 0.9) g_perf.n90++;
            MEMORYSTATUSEX ms; ms.dwLength = sizeof(ms);
            if (GlobalMemoryStatusEx(&ms)) { DWORD av = (DWORD)(ms.ullAvailPhys >> 20); if (!g_perf.ramMin || av < g_perf.ramMin) g_perf.ramMin = av; }
        }
        if (warm > 0) warm--;
        pg = g; pw = w; ps_i = sI; ps_t = sT;
    }
    return 0;
}
static void perf_begin(HANDLE proc)
{
    ZeroMemory(&g_perf, sizeof(g_perf));
    SYSTEM_INFO s; GetSystemInfo(&s); g_perf.cores = s.dwNumberOfProcessors;
    if (!DuplicateHandle(GetCurrentProcess(), proc, GetCurrentProcess(), &g_perf.h, SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, 0)) { g_perf.h = NULL; return; }
    g_perf_th = CreateThread(NULL, 0, perf_thread, NULL, 0, NULL);
    if (g_perf_th) SetThreadPriority(g_perf_th, THREAD_PRIORITY_BELOW_NORMAL);
}
static void perf_end(DWORD played)
{
    if (g_perf_th) { WaitForSingleObject(g_perf_th, 8000); CloseHandle(g_perf_th); g_perf_th = NULL; }
    if (g_perf.h) { CloseHandle(g_perf.h); g_perf.h = NULL; }
    if (g_perf.n < 6 || played < 120) return;              /* 2 daqiqadan kam - ma'lumot yetarli emas */
    char url[300];
    if (g_perf_dump) { char t[200]; _snprintf(t, sizeof(t), "gc=%d g90=%d sc=%d ram=%lu cores=%lu n=%d", (int)(g_perf.gsum * 100 / g_perf.n), g_perf.n90 * 100 / g_perf.n, (int)(g_perf.ssum * 100 / g_perf.n), (unsigned long)g_perf.ramMin, (unsigned long)g_perf.cores, g_perf.n); t[199] = 0;
        HANDLE f = CreateFileW(g_perf_dump, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL); if (f != INVALID_HANDLE_VALUE) { DWORD w; WriteFile(f, t, (DWORD)strlen(t), &w, NULL); CloseHandle(f); } return; }
    _snprintf(url, sizeof(url), XC_SITE "xc_api.php?a=perfl&d=%s&gc=%d&g90=%d&sc=%d&ram=%lu&cores=%lu&n=%d&t=%lu", g_id,
              (int)(g_perf.gsum * 100 / g_perf.n), g_perf.n90 * 100 / g_perf.n, (int)(g_perf.ssum * 100 / g_perf.n),
              (unsigned long)g_perf.ramMin, (unsigned long)g_perf.cores, g_perf.n, (unsigned long)played);
    url[sizeof(url) - 1] = 0;
    free(http_get(url, NULL));
}
