/* =====================================================================
 *  X CLIENT — video muharriri (xc_rec.c oxirida #include qilinadi)
 *  Menyu > Demo > ✂: launcher shu oynani ochadi. Tepada video (MFPlay), pastda kadrchalar bilan vaqt chizig'i:
 *  sariq tutqichlar - boshlanish va oxiri, oq chiziq - hozirgi joy. "Saqlash" - tanlangan qism yangi MP4 bo'lib
 *  (qayta siqilmasdan, remux) Videolar\X CLIENT ga qo'shiladi, asli qoladi.
 * ===================================================================== */
#include <mfplay.h>

typedef HRESULT (WINAPI *t_MFPCreateMediaPlayer)(LPCWSTR, BOOL, MFP_CREATION_OPTIONS, IMFPMediaPlayerCallback *, HWND, IMFPMediaPlayer **);

#define ED_THUMBS 12
#define ED_TW 128
#define ED_TH 72
#define WM_ED_THUMBS (WM_APP + 11)

typedef struct {
    HWND wnd, video, tl, play, save, cancel, info;
    IMFPMediaPlayer *mp;
    wchar_t path[MAX_PATH];
    LONGLONG dur, a, b, pos;            /* 100 ns: davomiylik, boshlanish, oxiri, hozirgi joy */
    int drag;                           /* 0 - yo'q, 1 - boshlanish, 2 - oxiri, 3 - hozirgi joy */
    BOOL playing, saving;
    HBITMAP thumbs;                     /* ED_THUMBS ta kadrcha yonma-yon (ED_TW*ED_THUMBS x ED_TH) */
    int nthumbs;
    HFONT font, big;
} Ed;

static BOOL ed_ru(void) { return !strcmp(g_lang, "ru"); }
static void ed_fmt(wchar_t *o, size_t n, LONGLONG t)
{
    unsigned s = (unsigned)(t / 10000000), cs = (unsigned)((t / 100000) % 100);
    _snwprintf(o, n, L"%02u:%02u.%02u", s / 60, s % 60, cs); o[n - 1] = 0;
}

/* ---- kadrchalar: Source Reader (RGB32 ga aylantirib) - har 1/12 qismdan bittadan, fon oqimida ---- */
typedef struct { Ed *e; wchar_t path[MAX_PATH]; LONGLONG dur; HWND wnd; } ThumbJob;
static DWORD WINAPI ed_thumb_thread(LPVOID p)
{
    ThumbJob *j = (ThumbJob *)p;
    IMFAttributes *at = NULL; IMFSourceReader *r = NULL; IMFMediaType *t = NULL;
    HBITMAP bmp = NULL; int done = 0;
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (FAILED(rf.MFStartup(0x00020070, 0))) goto out0;
    if (FAILED(rf.MFCreateAttributes(&at, 1))) goto out;
    IMFAttributes_SetUINT32(at, &MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, TRUE);
    if (FAILED(rf.MFCreateSourceReaderFromURL(j->path, at, &r))) goto out;
    IMFSourceReader_SetStreamSelection(r, MF_SOURCE_READER_ALL_STREAMS, FALSE);
    IMFSourceReader_SetStreamSelection(r, MF_SOURCE_READER_FIRST_VIDEO_STREAM, TRUE);
    if (!(t = mt_new())) goto out;
    IMFMediaType_SetGUID(t, &MF_MT_MAJOR_TYPE, &MFMediaType_Video); IMFMediaType_SetGUID(t, &MF_MT_SUBTYPE, &MFVideoFormat_RGB32);
    if (FAILED(IMFSourceReader_SetCurrentMediaType(r, MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, t))) goto out;
    SREL(t);
    UINT64 fs = 0; UINT32 fw = 0, fh = 0;
    if (SUCCEEDED(IMFSourceReader_GetCurrentMediaType(r, MF_SOURCE_READER_FIRST_VIDEO_STREAM, &t)) && SUCCEEDED(IMFMediaType_GetUINT64(t, &MF_MT_FRAME_SIZE, &fs))) {
        fw = (UINT32)(fs >> 32); fh = (UINT32)fs;
    }
    SREL(t);
    if (!fw || !fh) goto out;
    HDC sdc = GetDC(NULL), mdc = CreateCompatibleDC(sdc);
    bmp = CreateCompatibleBitmap(sdc, ED_TW * ED_THUMBS, ED_TH);
    ReleaseDC(NULL, sdc);
    HGDIOBJ ob = SelectObject(mdc, bmp);
    PatBlt(mdc, 0, 0, ED_TW * ED_THUMBS, ED_TH, BLACKNESS);
    SetStretchBltMode(mdc, HALFTONE);
    for (int i = 0; i < ED_THUMBS; i++) {
        PROPVARIANT pv; ZeroMemory(&pv, sizeof(pv)); pv.vt = VT_I8; pv.hVal.QuadPart = j->dur * i / ED_THUMBS + j->dur / (ED_THUMBS * 2);
        IMFSourceReader_SetCurrentPosition(r, &GUID_NULL, &pv);
        for (int tries = 0; tries < 90; tries++) {        /* kalit kadrdan kerakli joygacha */
            DWORD idx, fl; LONGLONG ts; IMFSample *s = NULL;
            if (FAILED(IMFSourceReader_ReadSample(r, MF_SOURCE_READER_FIRST_VIDEO_STREAM, 0, &idx, &fl, &ts, &s)) || (fl & MF_SOURCE_READERF_ENDOFSTREAM)) { SREL(s); break; }
            if (!s) continue;
            if (ts + 400000 < pv.hVal.QuadPart && tries < 89) { SREL(s); continue; }
            IMFMediaBuffer *mb = NULL; IMF2DBuffer *b2 = NULL; BYTE *line = NULL; LONG pitch = 0;
            if (SUCCEEDED(IMFSample_ConvertToContiguousBuffer(s, &mb))) {
                BOOL locked2d = SUCCEEDED(IMFMediaBuffer_QueryInterface(mb, &IID_IMF2DBuffer, (void **)&b2)) && SUCCEEDED(IMF2DBuffer_Lock2D(b2, &line, &pitch));
                BYTE *raw = NULL; DWORD len = 0;
                if (!locked2d && SUCCEEDED(IMFMediaBuffer_Lock(mb, &raw, NULL, &len))) { line = raw; pitch = (LONG)fw * 4; }
                if (line) {
                    BITMAPINFO bi; ZeroMemory(&bi, sizeof(bi));
                    bi.bmiHeader.biSize = sizeof(bi.bmiHeader); bi.bmiHeader.biWidth = pitch / 4; bi.bmiHeader.biPlanes = 1; bi.bmiHeader.biBitCount = 32;
                    /* pitch musbat - tepadan pastga (biHeight manfiy), manfiy - pastdan tepaga */
                    BYTE *base = line;
                    if (pitch > 0) bi.bmiHeader.biHeight = -(LONG)fh;
                    else { bi.bmiHeader.biWidth = -pitch / 4; bi.bmiHeader.biHeight = (LONG)fh; base = line + (LONG)(fh - 1) * pitch; }
                    StretchDIBits(mdc, i * ED_TW, 0, ED_TW, ED_TH, 0, 0, fw, fh, base, &bi, DIB_RGB_COLORS, SRCCOPY);
                    done++;
                }
                if (locked2d) IMF2DBuffer_Unlock2D(b2); else if (raw) IMFMediaBuffer_Unlock(mb);
            }
            SREL(b2); SREL(mb); SREL(s);
            break;
        }
    }
    SelectObject(mdc, ob); DeleteDC(mdc);
out:
    SREL(t); SREL(r); SREL(at);
    rf.MFShutdown();
out0:
    CoUninitialize();
    if (bmp && done && IsWindow(j->wnd)) PostMessageW(j->wnd, WM_ED_THUMBS, (WPARAM)bmp, done);
    else if (bmp) DeleteObject(bmp);
    free(j);
    return 0;
}

/* ---- vaqt chizig'i ---- */
static RECT ed_track(HWND h) { RECT r; GetClientRect(h, &r); r.left += 14; r.right -= 14; r.top += 22; r.bottom -= 8; return r; }
static int ed_x(Ed *e, RECT *tr, LONGLONG t) { return e->dur ? tr->left + (int)((tr->right - tr->left) * (double)t / e->dur) : tr->left; }
static LONGLONG ed_t(Ed *e, RECT *tr, int x)
{
    if (x < tr->left) x = tr->left;
    if (x > tr->right) x = tr->right;
    return (LONGLONG)((double)(x - tr->left) / (tr->right - tr->left) * e->dur);
}

static void ed_seek(Ed *e, LONGLONG t)
{
    if (!e->mp) return;
    PROPVARIANT pv; ZeroMemory(&pv, sizeof(pv)); pv.vt = VT_I8; pv.hVal.QuadPart = t;
    IMFPMediaPlayer_SetPosition(e->mp, &GUID_NULL, &pv);
    e->pos = t;
}

static void ed_info(Ed *e)
{
    wchar_t a[24], b[24], t[160];
    ed_fmt(a, 24, e->a); ed_fmt(b, 24, e->b);
    unsigned len = (unsigned)((e->b - e->a) / 10000000);
    _snwprintf(t, 160, ed_ru() ? L"Выбрано: %s — %s   (%u с)" : L"Tanlangan: %s — %s   (%u soniya)", a, b, len);
    t[159] = 0;
    SetWindowTextW(e->info, t);
}

static LRESULT CALLBACK ed_tl_proc(HWND h, UINT m, WPARAM w, LPARAM l)
{
    Ed *e = (Ed *)GetWindowLongPtrW(GetParent(h), GWLP_USERDATA);
    if (!e) return DefWindowProcW(h, m, w, l);
    RECT tr = ed_track(h);
    if (m == WM_PAINT) {
        PAINTSTRUCT ps; HDC dc0 = BeginPaint(h, &ps); RECT cr; GetClientRect(h, &cr);
        HDC dc = CreateCompatibleDC(dc0); HBITMAP bb = CreateCompatibleBitmap(dc0, cr.right, cr.bottom); HGDIOBJ obb = SelectObject(dc, bb);
        HBRUSH bg = CreateSolidBrush(RGB(16, 14, 20)); FillRect(dc, &cr, bg); DeleteObject(bg);
        /* kadrchalar */
        if (e->thumbs) {
            HDC tdc = CreateCompatibleDC(dc); HGDIOBJ ot = SelectObject(tdc, e->thumbs);
            SetStretchBltMode(dc, HALFTONE);
            StretchBlt(dc, tr.left, tr.top, tr.right - tr.left, tr.bottom - tr.top, tdc, 0, 0, ED_TW * ED_THUMBS, ED_TH, SRCCOPY);
            SelectObject(tdc, ot); DeleteDC(tdc);
        } else { HBRUSH b = CreateSolidBrush(RGB(40, 34, 44)); FillRect(dc, &tr, b); DeleteObject(b); }
        /* tanlanmagan qismlar - qoraytirilgan */
        int xa = ed_x(e, &tr, e->a), xb = ed_x(e, &tr, e->b), xp = ed_x(e, &tr, e->pos);
        BLENDFUNCTION bf = { AC_SRC_OVER, 0, 170, 0 };
        HDC sh = CreateCompatibleDC(dc); HBITMAP sb = CreateCompatibleBitmap(dc, 1, 1); HGDIOBJ os = SelectObject(sh, sb); SetPixel(sh, 0, 0, RGB(0, 0, 0));
        if (xa > tr.left) GdiAlphaBlend(dc, tr.left, tr.top, xa - tr.left, tr.bottom - tr.top, sh, 0, 0, 1, 1, bf);
        if (xb < tr.right) GdiAlphaBlend(dc, xb, tr.top, tr.right - xb, tr.bottom - tr.top, sh, 0, 0, 1, 1, bf);
        SelectObject(sh, os); DeleteObject(sb); DeleteDC(sh);
        /* sariq ramka va tutqichlar */
        HBRUSH yb = CreateSolidBrush(RGB(255, 176, 32));
        RECT r1 = { xa, tr.top - 2, xb, tr.top + 1 }, r2 = { xa, tr.bottom - 1, xb, tr.bottom + 2 };
        FillRect(dc, &r1, yb); FillRect(dc, &r2, yb);
        RECT ha = { xa - 7, tr.top - 2, xa + 1, tr.bottom + 2 }, hb = { xb - 1, tr.top - 2, xb + 7, tr.bottom + 2 };
        FillRect(dc, &ha, yb); FillRect(dc, &hb, yb);
        DeleteObject(yb);
        /* hozirgi joy */
        HBRUSH wb = CreateSolidBrush(RGB(255, 255, 255));
        RECT rp = { xp - 1, tr.top - 14, xp + 2, tr.bottom + 4 }; FillRect(dc, &rp, wb); DeleteObject(wb);
        /* soniya belgilari */
        SetBkMode(dc, TRANSPARENT); SetTextColor(dc, RGB(150, 140, 155));
        HGDIOBJ of = SelectObject(dc, e->font);
        if (e->dur > 0) {
            unsigned total = (unsigned)(e->dur / 10000000), step = total <= 20 ? 2 : total <= 60 ? 5 : total <= 180 ? 15 : total <= 600 ? 60 : 120;
            for (unsigned s = 0; s <= total; s += step) {
                int x = ed_x(e, &tr, (LONGLONG)s * 10000000);
                wchar_t lb[16]; _snwprintf(lb, 16, L"%02u:%02u", s / 60, s % 60); lb[15] = 0;
                RECT lr = { x - 30, 2, x + 30, 18 };
                DrawTextW(dc, lb, -1, &lr, DT_CENTER | DT_SINGLELINE | DT_NOPREFIX);
            }
        }
        SelectObject(dc, of);
        BitBlt(dc0, 0, 0, cr.right, cr.bottom, dc, 0, 0, SRCCOPY);
        SelectObject(dc, obb); DeleteObject(bb); DeleteDC(dc);
        EndPaint(h, &ps);
        return 0;
    }
    if (m == WM_ERASEBKGND) return 1;
    if (m == WM_LBUTTONDOWN && e->dur > 0) {
        int x = (short)LOWORD(l);
        int xa = ed_x(e, &tr, e->a), xb = ed_x(e, &tr, e->b);
        e->drag = abs(x - xa) <= 9 ? 1 : abs(x - xb) <= 9 ? 2 : 3;
        SetCapture(h);
    }
    if ((m == WM_MOUSEMOVE && e->drag) || m == WM_LBUTTONDOWN) {
        if (!e->drag || e->dur <= 0) return 0;
        LONGLONG t = ed_t(e, &tr, (short)LOWORD(l)), minlen = 10000000;   /* eng qisqa qism - 1 soniya */
        if (e->drag == 1) { e->a = t > e->b - minlen ? e->b - minlen : t; if (e->a < 0) e->a = 0; ed_seek(e, e->a); }
        else if (e->drag == 2) { e->b = t < e->a + minlen ? e->a + minlen : t; if (e->b > e->dur) e->b = e->dur; ed_seek(e, e->b); }
        else ed_seek(e, t);
        ed_info(e);
        InvalidateRect(h, NULL, FALSE);
        return 0;
    }
    if (m == WM_LBUTTONUP) { e->drag = 0; ReleaseCapture(); return 0; }
    if (m == WM_SETCURSOR) {
        POINT p; GetCursorPos(&p); ScreenToClient(h, &p);
        int xa = ed_x(e, &tr, e->a), xb = ed_x(e, &tr, e->b);
        SetCursor(LoadCursor(NULL, (abs(p.x - xa) <= 9 || abs(p.x - xb) <= 9) ? IDC_SIZEWE : IDC_HAND));
        return TRUE;
    }
    return DefWindowProcW(h, m, w, l);
}

static void ed_toggle(Ed *e)
{
    if (!e->mp) return;
    if (e->playing) { IMFPMediaPlayer_Pause(e->mp); e->playing = FALSE; }
    else { if (e->pos >= e->b - 200000 || e->pos < e->a) ed_seek(e, e->a); IMFPMediaPlayer_Play(e->mp); e->playing = TRUE; }
    InvalidateRect(e->play, NULL, FALSE);
}

static DWORD WINAPI ed_save_thread(LPVOID p)
{
    Ed *e = (Ed *)p;
    wchar_t out[MAX_PATH]; const wchar_t *src[1] = { e->path }; LONGLONG dur = 0; BOOL ok = FALSE;
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (SUCCEEDED(rf.MFStartup(0x00020070, 0))) {
        ok = vid_newpath(out) && remux(src, 1, out, e->a, e->b, &dur);
        rf.MFShutdown();
    }
    if (ok) vid_report(out, (unsigned)(dur / 10000000));
    CoUninitialize();
    PostMessageW(e->wnd, WM_APP + 12, ok, 0);
    return 0;
}

static LRESULT CALLBACK ed_proc(HWND h, UINT m, WPARAM w, LPARAM l)
{
    Ed *e = (Ed *)GetWindowLongPtrW(h, GWLP_USERDATA);
    switch (m) {
    case WM_SIZE: {
        if (!e) break;
        int W = LOWORD(l), H = HIWORD(l);
        MoveWindow(e->video, 16, 16, W - 32, H - 210, TRUE);
        MoveWindow(e->play, 16, H - 184, 64, 40, TRUE);
        MoveWindow(e->info, 96, H - 176, W - 112, 26, TRUE);
        MoveWindow(e->tl, 16, H - 136, W - 32, 82, TRUE);
        MoveWindow(e->cancel, W - 300, H - 46, 136, 36, TRUE);
        MoveWindow(e->save, W - 152, H - 46, 136, 36, TRUE);
        if (e->mp) IMFPMediaPlayer_UpdateVideo(e->mp);
        return 0;
    }
    case WM_TIMER:
        if (e && e->mp) {
            PROPVARIANT pv; PropVariantInit(&pv);
            if (e->dur <= 0 && SUCCEEDED(IMFPMediaPlayer_GetDuration(e->mp, &GUID_NULL, &pv)) && pv.vt == VT_UI8 && pv.uhVal.QuadPart) {
                e->dur = (LONGLONG)pv.uhVal.QuadPart; e->a = 0; e->b = e->dur; ed_info(e);
                ThumbJob *j = (ThumbJob *)calloc(1, sizeof(ThumbJob));
                if (j) { j->e = e; lstrcpynW(j->path, e->path, MAX_PATH); j->dur = e->dur; j->wnd = h; HANDLE th = CreateThread(NULL, 0, ed_thumb_thread, j, 0, NULL); if (th) CloseHandle(th); else free(j); }
            }
            PropVariantClear(&pv); PropVariantInit(&pv);
            if (e->playing && !e->drag && SUCCEEDED(IMFPMediaPlayer_GetPosition(e->mp, &GUID_NULL, &pv)) && pv.vt == VT_I8) {
                e->pos = pv.hVal.QuadPart;
                if (e->pos >= e->b) { IMFPMediaPlayer_Pause(e->mp); e->playing = FALSE; InvalidateRect(e->play, NULL, FALSE); ed_seek(e, e->b); }   /* tanlangan qism oxirida to'xtaydi */
            }
            PropVariantClear(&pv);
            InvalidateRect(e->tl, NULL, FALSE);
        }
        return 0;
    case WM_ED_THUMBS:
        if (e) { if (e->thumbs) DeleteObject(e->thumbs); e->thumbs = (HBITMAP)w; InvalidateRect(e->tl, NULL, FALSE); }
        else DeleteObject((HBITMAP)w);
        return 0;
    case WM_COMMAND:
        if (!e) break;
        if ((HWND)l == e->play) ed_toggle(e);
        else if ((HWND)l == e->cancel) DestroyWindow(h);
        else if ((HWND)l == e->save && !e->saving && e->dur > 0) {
            e->saving = TRUE;
            if (e->playing) ed_toggle(e);
            SetWindowTextW(e->save, ed_ru() ? L"Сохраняется..." : L"Saqlanmoqda...");
            EnableWindow(e->save, FALSE);
            HANDLE th = CreateThread(NULL, 0, ed_save_thread, e, 0, NULL);
            if (th) CloseHandle(th); else { e->saving = FALSE; EnableWindow(e->save, TRUE); }
        }
        return 0;
    case WM_APP + 12:
        if (!e) break;
        e->saving = FALSE;
        if (w) { rec_beep(0); MessageBoxW(h, ed_ru() ? L"Готово! Новое видео добавлено в «Мои видео»." : L"Tayyor! Yangi video «Mening videolarim» ga qo‘shildi.", L"X CLIENT", MB_OK | MB_ICONINFORMATION); DestroyWindow(h); }
        else { rec_beep(-1); SetWindowTextW(e->save, ed_ru() ? L"Сохранить" : L"Saqlash"); EnableWindow(e->save, TRUE);
               MessageBoxW(h, ed_ru() ? L"Не удалось сохранить." : L"Saqlab bo‘lmadi.", L"X CLIENT", MB_OK | MB_ICONWARNING); }
        return 0;
    case WM_KEYDOWN:
        if (e && w == VK_SPACE) { ed_toggle(e); return 0; }
        break;
    case WM_CLOSE:
        if (e && e->saving) return 0;                   /* saqlanayotganda yopilmasin */
        break;
    case WM_DRAWITEM: {                         /* tugmalar: to'q fon, "Saqlash" - sariq, o'ynatish - uchburchak / ikki chiziq */
        DRAWITEMSTRUCT *d = (DRAWITEMSTRUCT *)l;
        if (!e || d->CtlType != ODT_BUTTON) break;
        BOOL prim = d->hwndItem == e->save, dis = (d->itemState & ODS_DISABLED) != 0, down = (d->itemState & ODS_SELECTED) != 0;
        COLORREF bgc = prim ? (dis ? RGB(120, 96, 50) : down ? RGB(220, 150, 20) : RGB(255, 176, 32)) : (down ? RGB(30, 26, 34) : RGB(48, 42, 54));
        HBRUSH pb = CreateSolidBrush(RGB(24, 20, 28)); FillRect(d->hDC, &d->rcItem, pb); DeleteObject(pb);
        HBRUSH b = CreateSolidBrush(bgc); HGDIOBJ ob = SelectObject(d->hDC, b); HGDIOBJ op = SelectObject(d->hDC, GetStockObject(NULL_PEN));
        RoundRect(d->hDC, d->rcItem.left, d->rcItem.top, d->rcItem.right + 1, d->rcItem.bottom + 1, 10, 10);
        SelectObject(d->hDC, op); SelectObject(d->hDC, ob); DeleteObject(b);
        if (d->hwndItem == e->play) {
            int cx = (d->rcItem.left + d->rcItem.right) / 2, cy = (d->rcItem.top + d->rcItem.bottom) / 2;
            HBRUSH w2 = CreateSolidBrush(RGB(255, 255, 255)); HGDIOBJ o2 = SelectObject(d->hDC, w2); HGDIOBJ p2 = SelectObject(d->hDC, GetStockObject(NULL_PEN));
            if (e->playing) { RECT r1 = { cx - 8, cy - 9, cx - 3, cy + 9 }, r2 = { cx + 3, cy - 9, cx + 8, cy + 9 }; FillRect(d->hDC, &r1, w2); FillRect(d->hDC, &r2, w2); }
            else { POINT tri[3] = { { cx - 6, cy - 10 }, { cx - 6, cy + 10 }, { cx + 10, cy } }; Polygon(d->hDC, tri, 3); }
            SelectObject(d->hDC, p2); SelectObject(d->hDC, o2); DeleteObject(w2);
        } else {
            wchar_t t[64]; GetWindowTextW(d->hwndItem, t, 64);
            SetBkMode(d->hDC, TRANSPARENT); SetTextColor(d->hDC, prim ? RGB(24, 16, 4) : RGB(235, 225, 230));
            HGDIOBJ of = SelectObject(d->hDC, e->big);
            DrawTextW(d->hDC, t, -1, &d->rcItem, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
            SelectObject(d->hDC, of);
        }
        return TRUE;
    }
    case WM_CTLCOLORSTATIC: {
        HDC dc = (HDC)w; SetTextColor(dc, RGB(235, 225, 230)); SetBkColor(dc, RGB(24, 20, 28));
        static HBRUSH b = NULL; if (!b) b = CreateSolidBrush(RGB(24, 20, 28));
        return (LRESULT)b;
    }
    case WM_ERASEBKGND: {
        RECT r; GetClientRect(h, &r); HBRUSH b = CreateSolidBrush(RGB(24, 20, 28)); FillRect((HDC)w, &r, b); DeleteObject(b);
        return 1;
    }
    case WM_DESTROY:
        if (e) {
            KillTimer(h, 1);
            if (e->mp) { IMFPMediaPlayer_Shutdown(e->mp); SREL(e->mp); }
            if (e->thumbs) DeleteObject(e->thumbs);
            DeleteObject(e->font); DeleteObject(e->big);
            SetWindowLongPtrW(h, GWLP_USERDATA, 0);
            free(e);
        }
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

static LRESULT CALLBACK ed_video_proc(HWND h, UINT m, WPARAM w, LPARAM l)
{
    if (m == WM_PAINT) {
        Ed *e = (Ed *)GetWindowLongPtrW(GetParent(h), GWLP_USERDATA);
        PAINTSTRUCT ps; HDC dc = BeginPaint(h, &ps);
        if (e && e->mp) IMFPMediaPlayer_UpdateVideo(e->mp);
        else { RECT r; GetClientRect(h, &r); FillRect(dc, &r, (HBRUSH)GetStockObject(BLACK_BRUSH)); }
        EndPaint(h, &ps);
        return 0;
    }
    if (m == WM_LBUTTONDOWN) { Ed *e = (Ed *)GetWindowLongPtrW(GetParent(h), GWLP_USERDATA); if (e) ed_toggle(e); return 0; }
    if (m == WM_ERASEBKGND) return 1;
    return DefWindowProcW(h, m, w, l);
}

/* muharrir o'z oqimida (o'z xabarlar navbati bilan) - launcherning boshqa ishlari to'xtamaydi */
static volatile LONG g_ed_open = 0;
static DWORD WINAPI ed_thread(LPVOID p)
{
    wchar_t *path = (wchar_t *)p;
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    HMODULE mp = LoadLibraryW(L"mfplay.dll");
    t_MFPCreateMediaPlayer create = mp ? (t_MFPCreateMediaPlayer)GetProcAddress(mp, "MFPCreateMediaPlayer") : NULL;
    Ed *e = (Ed *)calloc(1, sizeof(Ed));
    if (!create || !e || !rec_load()) { free(e); goto out; }
    lstrcpynW(e->path, path, MAX_PATH);
    HINSTANCE hi = GetModuleHandleW(NULL);
    static BOOL reg = FALSE;
    if (!reg) {
        WNDCLASSW wc = { 0 };
        wc.lpfnWndProc = ed_proc; wc.hInstance = hi; wc.lpszClassName = L"XCEditor"; wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        wc.hIcon = LoadIconW(hi, MAKEINTRESOURCEW(1));
        RegisterClassW(&wc);
        wc.lpfnWndProc = ed_tl_proc; wc.lpszClassName = L"XCEdTimeline"; wc.hIcon = NULL; RegisterClassW(&wc);
        wc.lpfnWndProc = ed_video_proc; wc.lpszClassName = L"XCEdVideo"; RegisterClassW(&wc);
        reg = TRUE;
    }
    e->font = CreateFontW(14, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
    e->big = CreateFontW(18, 0, 0, 0, FW_SEMIBOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
    int W = 1040, H = 720;
    BOOL ru = ed_ru();
    e->wnd = CreateWindowExW(WS_EX_APPWINDOW, L"XCEditor", ru ? L"X CLIENT — редактор видео" : L"X CLIENT — video muharriri",
                             WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, (GetSystemMetrics(SM_CXSCREEN) - W) / 2, (GetSystemMetrics(SM_CYSCREEN) - H) / 2, W, H, NULL, NULL, hi, NULL);
    if (!e->wnd) { DeleteObject(e->font); DeleteObject(e->big); free(e); goto out; }
    SetWindowLongPtrW(e->wnd, GWLP_USERDATA, (LONG_PTR)e);
    e->video = CreateWindowW(L"XCEdVideo", L"", WS_CHILD | WS_VISIBLE, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    e->play = CreateWindowW(L"BUTTON", L"", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    e->info = CreateWindowW(L"STATIC", L"", WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    e->tl = CreateWindowW(L"XCEdTimeline", L"", WS_CHILD | WS_VISIBLE, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    e->cancel = CreateWindowW(L"BUTTON", ru ? L"Отмена" : L"Bekor qilish", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    e->save = CreateWindowW(L"BUTTON", ru ? L"Сохранить" : L"Saqlash", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW, 0, 0, 10, 10, e->wnd, NULL, hi, NULL);
    SendMessageW(e->play, WM_SETFONT, (WPARAM)e->big, TRUE); SendMessageW(e->info, WM_SETFONT, (WPARAM)e->big, TRUE);
    SendMessageW(e->cancel, WM_SETFONT, (WPARAM)e->big, TRUE); SendMessageW(e->save, WM_SETFONT, (WPARAM)e->big, TRUE);
    if (FAILED(create(e->path, FALSE, MFP_OPTION_NONE, NULL, e->video, &e->mp))) e->mp = NULL;
    RECT cr; GetClientRect(e->wnd, &cr); SendMessageW(e->wnd, WM_SIZE, 0, MAKELPARAM(cr.right, cr.bottom));
    SetTimer(e->wnd, 1, 50, NULL);
    ShowWindow(e->wnd, SW_SHOWNORMAL);
    SetForegroundWindow(e->wnd);
    MSG m;
    while (GetMessageW(&m, NULL, 0, 0) > 0) {
        if (m.message == WM_KEYDOWN && m.wParam == VK_SPACE) { HWND top = GetAncestor(m.hwnd, GA_ROOT); SendMessageW(top, WM_KEYDOWN, VK_SPACE, 0); continue; }   /* tugmalar ustida ham */
        TranslateMessage(&m); DispatchMessageW(&m);
    }
out:
    CoUninitialize();
    free(path);
    InterlockedExchange(&g_ed_open, 0);
    return 0;
}

static void editor_open(const wchar_t *file)
{
    if (InterlockedExchange(&g_ed_open, 1)) return;      /* bittadan ortiq oyna emas */
    wchar_t *p = (wchar_t *)malloc(sizeof(wchar_t) * MAX_PATH);
    if (!p) { InterlockedExchange(&g_ed_open, 0); return; }
    lstrcpynW(p, file, MAX_PATH);
    HANDLE th = CreateThread(NULL, 0, ed_thread, p, 0, NULL);
    if (th) CloseHandle(th); else { free(p); InterlockedExchange(&g_ed_open, 0); }
}
