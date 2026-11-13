@echo off
REM ==========================================================================
REM  Crown Tea Hub - Billing launcher with SILENT receipt printing
REM
REM  Opens the billing app in its own Chrome (or Edge) window with
REM  --kiosk-printing, so receipts go straight to the DEFAULT Windows printer
REM  without the print dialog.
REM
REM  One-time setup on the billing PC:
REM    1. Set BILLING_URL below to your billing website address.
REM    2. Install the receipt printer driver and make it the Windows DEFAULT
REM       printer (Settings > Bluetooth & devices > Printers & scanners >
REM       turn OFF "Let Windows manage my default printer", then pick the
REM       receipt printer > Set as default).
REM    3. Close all Chrome windows, then double-click this file.
REM       (It uses a separate Chrome profile, so log in to the app once.)
REM    4. Print one test bill normally, and in the print preview set
REM       Margins = None, Scale = 100 (Chrome remembers this).
REM    5. On the receipt, tick "Auto-print every bill".
REM  Tip: copy this file to the Desktop / Startup folder for one-click start.
REM ==========================================================================

set "BILLING_URL=https://YOUR-BILLING-SITE-HERE"

set "PROFILE_DIR=%LOCALAPPDATA%\CrownBillingKiosk"

set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"      set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"     set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"      set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER (
  echo Google Chrome or Microsoft Edge was not found on this PC.
  pause
  exit /b 1
)

start "" "%BROWSER%" --kiosk-printing --user-data-dir="%PROFILE_DIR%" --app="%BILLING_URL%/billing" --start-maximized
