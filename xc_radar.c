/* =====================================================================
 *  X CLIENT — radar xaritasi (overview) yasash: o'yinchining o'z xarita fayllaridan (.bsp)
 *  Radar xarita rasmini faqat cstrike\overviews\<xarita>.txt + .bmp bo'lsa ko'rsatadi; ko'p xaritalarda (ayniqsa
 *  serverdan yuklanganlarda) ular yo'q. Launcher yo'q bo'lganlarini o'zi chizadi: pol yuzalari tepadan, balandlikka qarab soya.
 *  Joylashuv Valve de_dust2 overview'i bilan o'lchab tekshirilgan (ROTATED 0): rasm ustuni = dunyo Y (o'ngga kamayadi),
 *  qatori = dunyo X (pastga kamayadi), 1 piksel = 8/ZOOM birlik, markaz - ORIGIN. Tom va devor ustlari (spawn nuqtalaridan
 *  60 birlikdan baland) chizilmaydi - de_dust2 da Valve rasmi bilan 93% mos.
 *  Valve/server overview'lari hech qachon almashtirilmaydi; o'zimiznikida "X CLIENT auto" belgisi bor.
 * ===================================================================== */
#include <math.h>

#define RAD_W 1024
#define RAD_H 768
#define RAD_VER "X CLIENT auto v1"

typedef struct { float x, y, z; } RV;
typedef struct { int first, n; float z; int water; } RPoly;

static int rad_rd32(const unsigned char *p) { return (int)((unsigned)p[0] | (unsigned)p[1] << 8 | (unsigned)p[2] << 16 | (unsigned)p[3] << 24); }
static float rad_rdf(const unsigned char *p) { float f; memcpy(&f, p, 4); return f; }
static int rad_rd16(const unsigned char *p) { return (short)(p[0] | p[1] << 8); }

static int rad_cmp(const void *a, const void *b) { float x = ((const RPoly *)a)->z, y = ((const RPoly *)b)->z; return x < y ? -1 : x > y; }

/* spawn nuqtalari balandligi (info_player_start / info_player_deathmatch) */
static int rad_spawns(const char *e, size_t n, float *zmin, float *zmax)
{
    int cnt = 0; *zmin = 1e9f; *zmax = -1e9f;
    for (size_t i = 0; i < n; i++) {
        if (e[i] != '{') continue;
        size_t j = i; while (j < n && e[j] != '}') j++;
        BOOL sp = FALSE; float oz = 0; BOOL haveo = FALSE;
        for (size_t k = i; k + 12 < j; k++) {
            if (!strncmp(e + k, "\"info_player_start\"", 19) || !strncmp(e + k, "\"info_player_deathmatch\"", 24)) sp = TRUE;
            if (!strncmp(e + k, "\"origin\"", 8)) {
                const char *q = memchr(e + k + 8, '"', j - k - 8);
                float ox, oy;
                if (q && sscanf(q + 1, "%f %f %f", &ox, &oy, &oz) == 3) haveo = TRUE;
            }
        }
        if (sp && haveo) { if (oz < *zmin) *zmin = oz; if (oz > *zmax) *zmax = oz; cnt++; }
        i = j;
    }
    return cnt;
}

/* qavariq ko'pburchakni to'ldirish (BSP yuzalari qavariq) */
static void rad_fill(unsigned char *img, unsigned char *hm, const float *px, const float *py, int n, unsigned char col, unsigned char h)
{
    float y0 = 1e9f, y1 = -1e9f;
    for (int i = 0; i < n; i++) { if (py[i] < y0) y0 = py[i]; if (py[i] > y1) y1 = py[i]; }
    int r0 = (int)ceilf(y0 - 0.5f), r1 = (int)floorf(y1 - 0.5f);
    if (r0 < 0) r0 = 0;
    if (r1 >= RAD_H) r1 = RAD_H - 1;
    for (int r = r0; r <= r1; r++) {
        float yc = r + 0.5f, xa = 1e9f, xb = -1e9f;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            float ya = py[i], yb = py[j];
            if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) {
                float x = px[i] + (yc - ya) * (px[j] - px[i]) / (yb - ya);
                if (x < xa) xa = x;
                if (x > xb) xb = x;
            }
        }
        int c0 = (int)ceilf(xa - 0.5f), c1 = (int)floorf(xb - 0.5f);
        if (c0 < 0) c0 = 0;
        if (c1 >= RAD_W) c1 = RAD_W - 1;
        for (int c = c0; c <= c1; c++) { img[r * RAD_W + c] = col; hm[r * RAD_W + c] = h; }
    }
}

/* .bsp (v30) -> 8 bitli BMP (1024x768) + overview matni. Muvaffaqiyat - TRUE */
static BOOL radar_gen(const unsigned char *b, size_t len, const char *map, unsigned char **bmp_out, size_t *bmp_len, char *txt, size_t txtcap)
{
    *bmp_out = NULL;
    if (len < 4 + 15 * 8 || rad_rd32(b) != 30) return FALSE;
    int lo[15], ll[15];
    for (int i = 0; i < 15; i++) { lo[i] = rad_rd32(b + 4 + i * 8); ll[i] = rad_rd32(b + 8 + i * 8); if (lo[i] < 0 || ll[i] < 0 || (size_t)lo[i] + ll[i] > len) return FALSE; }
    const unsigned char *planes = b + lo[1], *tex = b + lo[2], *verts = b + lo[3], *ti = b + lo[6], *faces = b + lo[7], *edges = b + lo[12], *se = b + lo[13], *models = b + lo[14];
    int nplanes = ll[1] / 20, nverts = ll[3] / 12, nti = ll[6] / 40, nfaces = ll[7] / 20, nedges = ll[12] / 4, nse = ll[13] / 4;
    int ntex = ll[2] >= 4 ? rad_rd32(tex) : 0;
    if (ll[14] < 64 || ntex < 0 || ntex > 100000 || ll[2] < 4 + ntex * 4) return FALSE;
    int ff = rad_rd32(models + 56), nf = rad_rd32(models + 60);   /* 0-model (dunyo): firstface, numfaces */
    if (ff < 0 || nf <= 0 || ff + nf > nfaces) return FALSE;
    float szmin, szmax;
    int nsp = rad_spawns((const char *)b + lo[0], ll[0], &szmin, &szmax);
    RPoly *pl = (RPoly *)malloc(sizeof(RPoly) * nf);
    RV *pv = (RV *)malloc(sizeof(RV) * (size_t)nse);
    if (!pl || !pv) { free(pl); free(pv); return FALSE; }
    int np = 0, nv = 0;
    for (int f = ff; f < ff + nf; f++) {
        const unsigned char *fc = faces + f * 20;
        int pn = rad_rd16(fc) & 0xFFFF, side = rad_rd16(fc + 2), fe = rad_rd32(fc + 4), ne = rad_rd16(fc + 8), t = rad_rd16(fc + 10) & 0xFFFF;
        if (pn >= nplanes || t >= nti || fe < 0 || ne < 3 || fe + ne > nse) continue;
        float nz = rad_rdf(planes + pn * 20 + 8);
        if (side) nz = -nz;
        if (nz < 0.7f) continue;                                   /* faqat pol (tepaga qaragan) */
        int mi = rad_rd32(ti + t * 40 + 32);
        char name[17] = "";
        if (mi >= 0 && mi < ntex) {
            int mo = rad_rd32(tex + 4 + mi * 4);
            if (mo >= 0 && (size_t)lo[2] + mo + 16 <= len) { memcpy(name, tex + mo, 16); name[16] = 0; }
        }
        for (char *c = name; *c; c++) if (*c >= 'A' && *c <= 'Z') *c += 32;
        if (!strncmp(name, "sky", 3) || !strncmp(name, "aaatrigger", 10) || !strncmp(name, "clip", 4) || !strncmp(name, "null", 4)
            || !strncmp(name, "origin", 6) || !strncmp(name, "hint", 4) || !strncmp(name, "skip", 4)) continue;
        float zs = 0; int ok = 1;
        for (int k = 0; k < ne; k++) {
            int e = rad_rd32(se + (fe + k) * 4), ei = e >= 0 ? e : -e;
            if (ei >= nedges) { ok = 0; break; }
            int v = e >= 0 ? (edges[ei * 4] | edges[ei * 4 + 1] << 8) : (edges[ei * 4 + 2] | edges[ei * 4 + 3] << 8);
            if (v >= nverts) { ok = 0; break; }
            pv[nv + k].x = rad_rdf(verts + v * 12); pv[nv + k].y = rad_rdf(verts + v * 12 + 4); pv[nv + k].z = rad_rdf(verts + v * 12 + 8);
            zs += pv[nv + k].z;
        }
        if (!ok) continue;
        zs /= ne;
        if (nsp && (zs > szmax + 60 || zs < szmin - 640)) continue;  /* tom, devor ustlari, chuqurliklar */
        pl[np].first = nv; pl[np].n = ne; pl[np].z = zs; pl[np].water = name[0] == '!';
        nv += ne; np++;
    }
    if (np < 8) { free(pl); free(pv); return FALSE; }
    /* chegaralar -> masshtab */
    float x0 = 1e9f, x1 = -1e9f, y0 = 1e9f, y1 = -1e9f, zlo, zhi;
    for (int i = 0; i < nv; i++) { if (pv[i].x < x0) x0 = pv[i].x; if (pv[i].x > x1) x1 = pv[i].x; if (pv[i].y < y0) y0 = pv[i].y; if (pv[i].y > y1) y1 = pv[i].y; }
    qsort(pl, np, sizeof(RPoly), rad_cmp);                       /* pastdan tepaga - balandrog'i ustida */
    zlo = pl[np / 20].z; zhi = pl[np - 1 - np / 20].z;
    if (zhi - zlo < 1) zhi = zlo + 1;
    float u = (y1 - y0) / (RAD_W * 0.94f), u2 = (x1 - x0) / (RAD_H * 0.94f);
    if (u2 > u) u = u2;
    if (u < 0.5f) u = 0.5f;
    float zoom = 8.0f / u, ox = (x0 + x1) / 2, oy = (y0 + y1) / 2;
    unsigned char *img = (unsigned char *)calloc(RAD_W * RAD_H, 1), *hm = (unsigned char *)calloc(RAD_W * RAD_H, 1);
    float *px = (float *)malloc(sizeof(float) * 512), *py = (float *)malloc(sizeof(float) * 512);
    if (!img || !hm || !px || !py) { free(img); free(hm); free(px); free(py); free(pl); free(pv); return FALSE; }
    for (int i = 0; i < np; i++) {
        int n = pl[i].n > 512 ? 512 : pl[i].n;
        for (int k = 0; k < n; k++) { RV *v = &pv[pl[i].first + k]; px[k] = 512 - (v->y - oy) / u; py[k] = 384 - (v->x - ox) / u; }
        float t = (pl[i].z - zlo) / (zhi - zlo); if (t < 0) t = 0; if (t > 1) t = 1;
        unsigned char col = pl[i].water ? 201 : (unsigned char)(1 + t * 99), h = (unsigned char)(1 + t * 254);
        rad_fill(img, hm, px, py, n, col, h);
    }
    /* chegaralar: bo'sh joy yoki keskin balandlik farqi yonida - to'qroq (devor chizig'i) */
    unsigned char *out = (unsigned char *)malloc(RAD_W * RAD_H);
    if (out) {
        memcpy(out, img, RAD_W * RAD_H);
        for (int r = 1; r < RAD_H - 1; r++) for (int c = 1; c < RAD_W - 1; c++) {
            int i = r * RAD_W + c, h = hm[i];
            if (!img[i] || img[i] > 100) continue;
            int nb[4] = { i - 1, i + 1, i - RAD_W, i + RAD_W };
            for (int k = 0; k < 4; k++) if (!img[nb[k]] || abs((int)hm[nb[k]] - h) > 18) { out[i] = (unsigned char)(img[i] + 100); break; }
        }
    }
    /* BMP: 8 bit, palitra; 0 - fon (sof yashil, radar uni shaffof ko'radi), 1..100 - balandlik, 101..200 - chegara, 201 - suv */
    size_t sz = 54 + 1024 + (size_t)RAD_W * RAD_H;
    unsigned char *bm = out ? (unsigned char *)calloc(sz, 1) : NULL;
    if (bm) {
        bm[0] = 'B'; bm[1] = 'M';
        unsigned v32;
        v32 = (unsigned)sz; memcpy(bm + 2, &v32, 4);
        v32 = 54 + 1024; memcpy(bm + 10, &v32, 4);
        v32 = 40; memcpy(bm + 14, &v32, 4);
        v32 = RAD_W; memcpy(bm + 18, &v32, 4);
        v32 = RAD_H; memcpy(bm + 22, &v32, 4);
        bm[26] = 1; bm[28] = 8;
        v32 = RAD_W * RAD_H; memcpy(bm + 34, &v32, 4);
        v32 = 256; memcpy(bm + 46, &v32, 4); memcpy(bm + 50, &v32, 4);
        unsigned char *pal = bm + 54;                              /* B G R 0 */
        pal[1] = 255;                                              /* 0: yashil */
        for (int i = 1; i <= 100; i++) {
            float t = (i - 1) / 99.0f;
            int R = (int)(70 + 150 * t), G = (int)(64 + 130 * t), B = (int)(56 + 100 * t);
            pal[i * 4] = (unsigned char)B; pal[i * 4 + 1] = (unsigned char)G; pal[i * 4 + 2] = (unsigned char)R;
            pal[(i + 100) * 4] = (unsigned char)(B / 3); pal[(i + 100) * 4 + 1] = (unsigned char)(G / 3); pal[(i + 100) * 4 + 2] = (unsigned char)(R / 3);
        }
        pal[201 * 4] = 160; pal[201 * 4 + 1] = 110; pal[201 * 4 + 2] = 60;
        for (int r = 0; r < RAD_H; r++) memcpy(bm + 54 + 1024 + (size_t)(RAD_H - 1 - r) * RAD_W, out + r * RAD_W, RAD_W);   /* pastdan tepaga */
        _snprintf(txt, txtcap, "// overview description file for %s.bsp (%s)\r\n\r\nglobal\r\n{\r\n\tZOOM\t%.3f\r\n\tORIGIN\t%.0f\t%.0f\t%.0f\r\n\tROTATED\t0\r\n}\r\n\r\nlayer\r\n{\r\n\tIMAGE\t\"overviews/%s.bmp\"\r\n\tHEIGHT\t%.0f\r\n}\r\n",
                  map, RAD_VER, zoom, ox, oy, zlo, map, zlo);
        txt[txtcap - 1] = 0;
        *bmp_out = bm; *bmp_len = sz;
    }
    free(out); free(img); free(hm); free(px); free(py); free(pl); free(pv);
    return bm != NULL;
}

#ifndef XC_RADAR_TEST
/* ---- launcher: overview'i yo'q xaritalar (cstrike\maps, serverdan yuklanganlar) uchun fonda yasash ---- */
#define RAD_MAX_PER_RUN 60
static BOOL rad_has(const wchar_t *map)
{
    static const wchar_t *dirs[] = { L"cstrike", L"cstrike_downloads", L"cstrike_addon", L"cstrike_russian", L"cstrike_hd" };
    for (int i = 0; i < 5; i++) {
        wchar_t sub[MAX_PATH], p[MAX_PATH];
        _snwprintf(sub, MAX_PATH, L"%s\\overviews\\%s.txt", dirs[i], map); sub[MAX_PATH - 1] = 0;
        path_join(p, g_dir, sub);
        HANDLE f = CreateFileW(p, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
        if (f == INVALID_HANDLE_VALUE) continue;
        char head[160] = ""; DWORD got = 0;
        ReadFile(f, head, sizeof(head) - 1, &got, NULL); CloseHandle(f);
        head[got] = 0;
        if (strstr(head, "X CLIENT auto v") && !strstr(head, RAD_VER)) return FALSE;   /* eski versiyamiz - qayta chizamiz */
        return TRUE;                                                                   /* Valve / server / bizning joriy */
    }
    return FALSE;
}

static BOOL rad_write(const wchar_t *dst, const void *data, size_t n)   /* vaqtinchalik fayl + almashtirish: o'yin yarim faylni o'qimasin */
{
    wchar_t tmp[MAX_PATH];
    _snwprintf(tmp, MAX_PATH, L"%s.xctmp", dst); tmp[MAX_PATH - 1] = 0;
    HANDLE f = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) return FALSE;
    DWORD wr = 0; BOOL ok = WriteFile(f, data, (DWORD)n, &wr, NULL) && wr == n;
    CloseHandle(f);
    if (ok) ok = MoveFileExW(tmp, dst, MOVEFILE_REPLACE_EXISTING);
    if (!ok) DeleteFileW(tmp);
    return ok;
}

static void rad_one(const wchar_t *bsp, const wchar_t *map)
{
    HANDLE f = CreateFileW(bsp, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
    if (f == INVALID_HANDLE_VALUE) return;
    DWORD sz = GetFileSize(f, NULL), got = 0;
    unsigned char *b = (sz > 1024 && sz < 96u * 1024 * 1024) ? (unsigned char *)malloc(sz) : NULL;
    BOOL rd = b && ReadFile(f, b, sz, &got, NULL) && got == sz;
    CloseHandle(f);
    char nm[64]; unsigned char *bmp = NULL; size_t bl = 0; char txt[1024];
    WideCharToMultiByte(CP_UTF8, 0, map, -1, nm, sizeof(nm), NULL, NULL); nm[63] = 0;
    if (rd && radar_gen(b, sz, nm, &bmp, &bl, txt, sizeof(txt))) {
        wchar_t dir[MAX_PATH], p[MAX_PATH], sub[MAX_PATH];
        path_join(dir, g_dir, L"cstrike\\overviews");
        CreateDirectoryW(dir, NULL);
        _snwprintf(sub, MAX_PATH, L"cstrike\\overviews\\%s.bmp", map); sub[MAX_PATH - 1] = 0; path_join(p, g_dir, sub);
        if (rad_write(p, bmp, bl)) {
            _snwprintf(sub, MAX_PATH, L"cstrike\\overviews\\%s.txt", map); sub[MAX_PATH - 1] = 0; path_join(p, g_dir, sub);
            rad_write(p, txt, strlen(txt));                       /* txt oxirida - rasm tayyor bo'lgandan keyin */
        }
    }
    free(bmp); free(b);
}

typedef struct { wchar_t path[MAX_PATH]; wchar_t map[64]; ULONGLONG t; } RadMap;
static int rad_tcmp(const void *a, const void *b) { ULONGLONG x = ((const RadMap *)a)->t, y = ((const RadMap *)b)->t; return x < y ? 1 : x > y ? -1 : 0; }
static DWORD WINAPI radar_thread(LPVOID unused)
{
    (void)unused;
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_LOWEST);
    static const wchar_t *mdirs[] = { L"cstrike\\maps", L"cstrike_downloads\\maps", L"cstrike_addon\\maps" };
    RadMap *l = (RadMap *)malloc(sizeof(RadMap) * 3000); int n = 0;
    if (!l) return 0;
    for (int d = 0; d < 3; d++) {
        wchar_t pat[MAX_PATH], sub[MAX_PATH];
        _snwprintf(sub, MAX_PATH, L"%s\\*.bsp", mdirs[d]); sub[MAX_PATH - 1] = 0; path_join(pat, g_dir, sub);
        WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
        if (h == INVALID_HANDLE_VALUE) continue;
        do {
            size_t L = wcslen(fd.cFileName);
            if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || L < 5 || L - 4 >= 64 || n >= 3000) continue;
            lstrcpynW(l[n].map, fd.cFileName, (int)(L - 4 + 1));
            _snwprintf(sub, MAX_PATH, L"%s\\%s", mdirs[d], fd.cFileName); sub[MAX_PATH - 1] = 0; path_join(l[n].path, g_dir, sub);
            l[n].t = ((ULONGLONG)fd.ftLastWriteTime.dwHighDateTime << 32) | fd.ftLastWriteTime.dwLowDateTime;
            n++;
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    qsort(l, n, sizeof(RadMap), rad_tcmp);                       /* yangi yuklangan (yaqinda o'ynalgan) xaritalar birinchi */
    int done = 0;
    for (int i = 0; i < n && done < RAD_MAX_PER_RUN; i++) {
        if (rad_has(l[i].map)) continue;
        rad_one(l[i].path, l[i].map);
        done++;
    }
    free(l);
    return 0;
}

static void radar_start(void)
{
    HANDLE th = CreateThread(NULL, 0, radar_thread, NULL, 0, NULL);
    if (th) CloseHandle(th);
}
#endif
