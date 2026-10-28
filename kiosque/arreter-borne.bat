@echo off
REM Arrete la borne : Chrome puis le serveur local.
taskkill /IM chrome.exe /F >nul 2>&1
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| find "PID:"') do taskkill /PID %%p /F >nul 2>&1
echo Borne arretee.
