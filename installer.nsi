; X CLIENT o'rnatuvchi (X-Client-Setup.exe). CI: makensis /DSRC=full /DVER=1.0.N installer.nsi
; Faqat launcher (XCLauncher.exe + xc_theme) o'rnatiladi; CS 1.6 o'yin yo'q bo'lsa XCLauncher.exe uni o'zi yuklab o'rnatadi.
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
RequestExecutionLevel user
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
!define MUI_FINISHPAGE_RUN "$INSTDIR\XCLauncher.exe"
!define MUI_DIRECTORYPAGE_TEXT_TOP "CS 1.6 kompyuteringizda bor bo'lsa, o'sha papkani tanlang. Yo'q bo'lsa - shu papka qolsin, XCLauncher.exe o'yinni o'zi yuklab o'rnatadi.$\r$\n$\r$\nЕсли CS 1.6 уже установлена - выберите её папку. Если нет - оставьте эту, XCLauncher.exe сам скачает игру."

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Russian"

Section "X CLIENT"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
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

; O'chirish: faqat launcher va yorliqlar. O'yin fayllari (cstrike va h.k.) va sozlamalar qoladi.
Section "Uninstall"
  Delete "$DESKTOP\X CLIENT.lnk"
  RMDir /r "$SMPROGRAMS\X CLIENT"
  Delete "$INSTDIR\XCLauncher.exe"
  Delete "$INSTDIR\XClient.exe"
  Delete "$INSTDIR\bt_build.txt"
  Delete "$INSTDIR\xclient_version.txt"
  RMDir /r "$INSTDIR\xc_theme"
  Delete "$INSTDIR\XClient-Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient"
SectionEnd
