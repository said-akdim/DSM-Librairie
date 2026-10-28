@echo off
REM ══════════════════════════════════════
REM  BORNE DE PRIX DSM — demarrage Windows 10
REM  Lance le serveur local puis Chrome en mode kiosque.
REM  A placer dans le dossier Demarrage de Windows :
REM    Win+R  ->  shell:startup  ->  y creer un raccourci vers ce fichier
REM ══════════════════════════════════════

REM --- Reglages de la borne -------------------------------------------
set ODOO_CIBLE=http://94.130.90.253:9069
set PORT=8080
set RACINE=%~dp0..\dist
REM --------------------------------------------------------------------

cd /d "%~dp0"

REM Serveur local (application + relais Odoo), sans fenetre visible
start "" /min node "%~dp0serveur-borne.js"

REM Laisser le serveur demarrer
timeout /t 3 /nobreak >nul

REM Chrome en plein ecran, sans barre d'adresse ni boite de dialogue
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

start "" %CHROME% ^
 --kiosk ^
 --no-first-run ^
 --noerrdialogs ^
 --disable-session-crashed-bubble ^
 --disable-infobars ^
 --disable-pinch ^
 --overscroll-history-navigation=0 ^
 --disable-features=TranslateUI ^
 --user-data-dir="%LOCALAPPDATA%\BorneDSM" ^
 "http://localhost:%PORT%/borne"
