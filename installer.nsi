; X CLIENT o'rnatuvchi (X-Client-Setup.exe). CI: makensis /DSRC=full /DVER=1.0.N installer.nsi
; /DGAME=<boost-top PRO o'rnatuvchisi> berilsa - CS 1.6 ham shu yerning o'zida o'rnatiladi (launcher birinchi ochilishda hech narsa yuklamaydi).
; GAME berilmasa - faqat launcher, o'yinni XCLauncher.exe o'zi yuklab o'rnatadi.
Unicode true
!include "MUI2.nsh"

!ifndef SRC
  !define SRC "full"
!endif
!ifndef VER
  !define VER "1.0"
!endif

Name "X CLIENT"
OutFile "X-Client-Setup.exe"
InstallDir "C:\Games\X CLIENT"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText "X CLIENT ${VER}"
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "X CLIENT"
VIAddVersionKey "FileDescription" "X CLIENT - CS 1.6 launcher"
VIAddVersionKey "FileVersion" "${VER}"
VIAddVersionKey "LegalCopyright" "boost-top.com"

!define MUI_ICON "xclient.ico"
!define MUI_UNICON "xclient.ico"
!define MUI_ABORTWARNING
!define MUI_LANGDLL_ALLLANGUAGES
!define MUI_LANGDLL_WINDOWTITLE "X CLIENT"
!define MUI_LANGDLL_INFO "Tilni tanlang / Выберите язык / Choose language"
; "Ishga tushirish" - administrator huquqisiz (explorer orqali): aks holda launcher va o'yin admin bo'lib ochilib,
; keyin oddiy ochilganda fayllarga yoza olmaydi, menyu va yangilanishlar buziladi
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION RunUnelevated
!define MUI_DIRECTORYPAGE_TEXT_TOP "CS 1.6 kompyuteringizda bor bo'lsa, o'sha papkani tanlang. Yo'q bo'lsa - shu papka qolsin, XCLauncher.exe o'yinni o'zi yuklab o'rnatadi.$\r$\n$\r$\nЕсли CS 1.6 уже установлена - выберите её папку. Если нет - оставьте эту, XCLauncher.exe сам скачает игру."

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
; birinchisi - standart: ruscha. O'rnatish boshida til so'raladi; tanlangan til menyu va o'yinga ham qo'yiladi
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "Uzbek"
!insertmacro MUI_LANGUAGE "English"

Var XLANG    ; ru / uz / en - xclient.ini ga (launcher saytga yuboradi, menyu shu tilda ochiladi)
Var GLANG    ; boost-top o'rnatuvchisi (Inno) uchun: russian / uzbek / english

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Function RunUnelevated
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\XCLauncher.exe"'
FunctionEnd

Function SetLangVars
  StrCpy $XLANG "ru"
  StrCpy $GLANG "russian"
  StrCmp $LANGUAGE ${LANG_UZBEK} 0 +3
    StrCpy $XLANG "uz"
    StrCpy $GLANG "uzbek"
  StrCmp $LANGUAGE ${LANG_ENGLISH} 0 +3
    StrCpy $XLANG "en"
    StrCpy $GLANG "english"
FunctionEnd

!ifdef GAME
; Papkada o'yin yo'q bo'lsa - asl boost-top PRO o'rnatuvchisini jim rejimda shu papkaga o'rnatamiz
Section "CS 1.6"
  Call SetLangVars
  IfFileExists "$INSTDIR\cstrike.exe" game_done 0
  IfFileExists "$INSTDIR\hl.exe" game_done 0
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  SetCompress off
  File "/oname=cs16_setup.exe" "${GAME}"
  SetCompress auto
  DetailPrint "CS 1.6 o'rnatilmoqda / Установка CS 1.6..."
  ExecWait '"$PLUGINSDIR\cs16_setup.exe" /VERYSILENT /SP- /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS="" /LANG=$GLANG /DIR="$INSTDIR"'
  Delete "$PLUGINSDIR\cs16_setup.exe"
  game_done:
SectionEnd
!endif

Section "X CLIENT"
  Call SetLangVars
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  WriteINIStr "$INSTDIR\xclient.ini" "x" "lang" $XLANG
  ; ustidan qayta o'rnatilsa: eski "build" qolsa launcher Setup dagi (eskiroq bo'lishi mumkin) fayllarni yangi deb o'ylardi - qayta tekshirsin
  DeleteINIStr "$INSTDIR\xclient.ini" "x" "build"
!ifdef CHAN
  WriteINIStr "$INSTDIR\xclient.ini" "x" "channel" "${CHAN}"
!endif
  WriteUninstaller "$INSTDIR\XClient-Uninstall.exe"
  CreateShortcut "$DESKTOP\X CLIENT.lnk" "$INSTDIR\XCLauncher.exe" "" "$INSTDIR\XCLauncher.exe" 0
  CreateDirectory "$SMPROGRAMS\X CLIENT"
  CreateShortcut "$SMPROGRAMS\X CLIENT\X CLIENT.lnk" "$INSTDIR\XCLauncher.exe" "" "$INSTDIR\XCLauncher.exe" 0
  CreateShortcut "$SMPROGRAMS\X CLIENT\Uninstall.lnk" "$INSTDIR\XClient-Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "DisplayName" "X CLIENT"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "DisplayIcon" "$INSTDIR\XCLauncher.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "Publisher" "boost-top.com"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "UninstallString" "$\"$INSTDIR\XClient-Uninstall.exe$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient" "NoModify" 1
SectionEnd

; O'chirish: launcher, yorliqlar va launcher yaratgan/o'zgartirgan narsalar. O'yin fayllari (cstrike va h.k.), o'yin sozlamalari va F10 videolari qoladi.
Section "Uninstall"
  ; "Nega o'chiryapsiz?" - qisqa so'rovnoma brauzerda ochiladi (javoblar admin panelda ko'rinadi)
  ReadINIStr $0 "$INSTDIR\xclient.ini" "x" "id"
  IfSilent +2
    ExecShell "open" "http://mmb.boost-top.com/bye.php?d=$0"
  Delete "$DESKTOP\X CLIENT.lnk"
  RMDir /r "$SMPROGRAMS\X CLIENT"
  Delete "$INSTDIR\XCLauncher.exe"
  Delete "$INSTDIR\XClient.exe"
  Delete "$INSTDIR\bt_build.txt"
  Delete "$INSTDIR\xclient_version.txt"
  RMDir /r "$INSTDIR\xc_theme"
  ; o'yin bosh menyusi manzilini asl holiga qaytaramiz (launcher X CLIENT menyusiga - xc.html ga - o'zgartirgan)
  IfFileExists "$INSTDIR\platform\mmb_home_page.orig" 0 +3
    Delete "$INSTDIR\platform\mmb_home_page.html"
    Rename "$INSTDIR\platform\mmb_home_page.orig" "$INSTDIR\platform\mmb_home_page.html"
  ; launcher o'zgartirgan HUD rasmlari va paketlar almashtirgan fayllarning asl nusxalari qaytariladi
  IfFileExists "$INSTDIR\xc_backup\*.*" 0 no_backup
    IfFileExists "$INSTDIR\xc_backup\hud\*.*" 0 +2
      CopyFiles /SILENT "$INSTDIR\xc_backup\hud\*.*" "$INSTDIR"
    RMDir /r "$INSTDIR\xc_backup\hud"
    FindFirst $1 $2 "$INSTDIR\xc_backup\*.*"
    pk_loop:
      StrCmp $2 "" pk_done
      StrCmp $2 "." pk_next
      StrCmp $2 ".." pk_next
      CopyFiles /SILENT "$INSTDIR\xc_backup\$2\*.*" "$INSTDIR"
    pk_next:
      FindNext $1 $2
      Goto pk_loop
    pk_done:
    FindClose $1
    RMDir /r "$INSTDIR\xc_backup"
  no_backup:
  ; launcher yaratgan fayllar
  Delete "$INSTDIR\xclient.ini"
  Delete "$INSTDIR\cstrike\xclient_launcher.cfg"
  Delete "$INSTDIR\cstrike\xclient_master.cfg"
  Delete "$INSTDIR\cstrike\tempdecal.xcdl"
  Delete "$INSTDIR\cstrike\xc_*.dem"
  SetFileAttributes "$INSTDIR\cstrike\tempdecal.wad" NORMAL   ; spray "faqat o'qish" qilingan edi - o'yin yana o'zgartira olsin
  ; Windows bilan ishga tushish va "O'yinni tezlashtirish" belgisi (faqat o'zimizniki bo'lsa)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "X CLIENT"
  ReadRegStr $1 HKCU "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" "$INSTDIR\cstrike.exe"
  StrCmp $1 "~ DISABLEDXMAXIMIZEDWINDOWEDMODE" 0 +2
    DeleteRegValue HKCU "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" "$INSTDIR\cstrike.exe"
  ReadRegStr $1 HKCU "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" "$INSTDIR\hl.exe"
  StrCmp $1 "~ DISABLEDXMAXIMIZEDWINDOWEDMODE" 0 +2
    DeleteRegValue HKCU "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" "$INSTDIR\hl.exe"
  Delete "$INSTDIR\XClient-Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient"
SectionEnd
