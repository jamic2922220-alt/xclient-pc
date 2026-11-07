@echo off
rem X CLIENT diagnostika: qotayotgan kompyuterda ikki marta bosing. Natija ish stolida xclient-diagnostika.txt ga yoziladi.
chcp 65001 >nul
set OUT=%USERPROFILE%\Desktop\xclient-diagnostika.txt
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$o=@();" ^
 "$c=Get-CimInstance Win32_Processor|Select -First 1; $o+='CPU: '+$c.Name+' ('+$c.NumberOfLogicalProcessors+' oqim)';" ^
 "$o+='RAM: '+[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)+' GB';" ^
 "Get-CimInstance Win32_VideoController|%%{$o+='GPU: '+$_.Name+' | drayver '+$_.DriverVersion+' | '+$_.CurrentHorizontalResolution+'x'+$_.CurrentVerticalResolution+' @ '+$_.CurrentRefreshRate+' Hz'};" ^
 "$o+='Windows: '+(Get-CimInstance Win32_OperatingSystem).Caption;" ^
 "$o+='Quvvat rejimi: '+((powercfg /getactivescheme) -join ' ');" ^
 "$b=Get-CimInstance Win32_Battery -EA 0; if($b){$o+='Noutbuk: ha, quvvat '+$b.EstimatedChargeRemaining+'%%'};" ^
 "$o+=''; $o+='--- Eng ko''p CPU ishlatayotgan dasturlar ---';" ^
 "Get-Process|Sort CPU -Desc|Select -First 12|%%{$o+=('{0,-28} CPU {1,8:N0}s  RAM {2,6:N0} MB' -f $_.ProcessName,$_.CPU,($_.WorkingSet64/1MB))};" ^
 "$o+=''; $o+='--- O''yin sozlamalari ---';" ^
 "$d=@('C:\Games\X CLIENT')+(Get-ChildItem 'C:\Games','D:\Games','C:\Program Files (x86)','D:\' -Directory -EA 0|%%{$_.FullName});" ^
 "foreach($g in $d){ foreach($f in 'cstrike\config.cfg','cstrike\userconfig.cfg','cstrike_russian\config.cfg'){ $p=Join-Path $g $f; if(Test-Path $p){ $o+='['+$p+']'; Get-Content $p|Select-String -Pattern '^(fps_max|fps_override|gl_vsync|rate|cl_updaterate|cl_cmdrate|ex_interp|_snd_mixahead|hisound|m_rawinput|r_dynamic|gl_picmip|cl_showfps|developer|net_graph)\b'|%%{$o+='  '+$_.Line} } }; $i=Join-Path $g 'xclient.ini'; if(Test-Path $i){$o+='['+$i+']'; Get-Content $i|%%{$o+='  '+$_}} };" ^
 "$o|Out-File -Encoding utf8 '%OUT%'"
echo.
echo Tayyor: %OUT%
echo Shu faylni (yoki ichidagi matnni) adminga yuboring.
pause
