@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang.
  echo Untuk build lokal, install Node.js LTS terlebih dahulu.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 exit /b 1
call npm run dist
if errorlevel 1 exit /b 1
echo.
echo Build selesai. Cek folder release.
pause
