@echo off
rem X CLIENT sprey diagnostikasi: ikki marta bosing. Natija ish stolida xclient-sprey.txt ga yoziladi.
chcp 65001 >nul
set OUT=%USERPROFILE%\Desktop\xclient-sprey.txt
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$want='DC9587EF483AA1659E1AEA3A2C4521497F5B370F99069244F4DD2ECBC2716A3D'; $o=@();" ^
 "$d=@('C:\Games\X CLIENT');" ^
 "$r=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\XClient' -EA 0; if($r -and $r.DisplayIcon){$d+=Split-Path ($r.DisplayIcon.Trim([char]34))};" ^
 "Get-Process hl,cstrike,XCLauncher -EA 0|%%{ try{ $d+=Split-Path $_.Path }catch{} };" ^
 "$d=$d|?{Test-Path $_}|Sort -Unique;" ^
 "if(!$d){$o+='O''yin papkasi topilmadi'};" ^
 "foreach($g in $d){ $o+='=== '+$g;" ^
 " Get-ChildItem $g -Directory -EA 0|%%{ $o+='  papka: '+$_.Name };" ^
 " Get-ChildItem $g -Recurse -Depth 2 -Filter tempdecal.wad -EA 0|%%{ $h=(Get-FileHash $_.FullName -Algorithm SHA256).Hash; $o+=('  {0}  {1} bayt  {2}  {3}  {4}' -f $_.FullName.Substring($g.Length),$_.Length,$_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'),$(if($_.IsReadOnly){'faqat-oqish'}else{'yoziladi'}),$(if($h -eq $want){'X CLIENT - TO''G''RI'}else{'BOSHQA RASM'})) };" ^
 " $i=Join-Path $g 'xclient.ini'; if(Test-Path $i){ $o+='  [xclient.ini]'; Get-Content $i|?{$_ -notmatch '^key='}|%%{$o+='    '+$_} };" ^
 " foreach($f in 'cstrike\config.cfg','cstrike\userconfig.cfg','cstrike_russian\config.cfg'){ $p=Join-Path $g $f; if(Test-Path $p){ $o+='  ['+$f+']'; Get-Content $p|Select-String -Pattern '^(cl_logofile|cl_logocolor|cl_allowupload|cl_allowdownload|cl_dlmax)\b'|%%{$o+='    '+$_.Line} } };" ^
 " $v=Join-Path $g 'xclient_version.txt'; if(Test-Path $v){$o+='  versiya: '+(Get-Content $v -Raw).Trim()} };" ^
 "$o|Out-File -Encoding utf8 '%OUT%'"
echo.
echo Tayyor: %OUT%
echo Shu faylni (yoki ichidagi matnni) adminga yuboring.
pause
