@echo off
title Maai Ka Thekuaa - Website Server
color 0E
cd /d "%~dp0"

echo.
echo  =====================================================
echo     MAAI KA THEKUAA  -  Starting your website
echo  =====================================================
echo.

REM ---- 1. Check that Node.js is installed -------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js was not found on this computer.
  echo.
  echo      Please install Node.js first ^(free^):
  echo      https://nodejs.org/en/download
  echo.
  echo      Install the "LTS" version, then double-click START.bat again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
echo  [OK] Node.js %NODEV% found.

REM ---- 2. Install dependencies only if they are missing ------------------
if not exist "node_modules\sql.js\package.json" (
  echo.
  echo  [..] Installing dependencies for the first time, please wait...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [X] Dependency installation failed. Check your internet connection
    echo      and run START.bat again.
    pause
    exit /b 1
  )
)
echo  [OK] Dependencies ready.

REM ---- 3. Quick pre-flight check ----------------------------------------
node server\selftest.js
if errorlevel 1 (
  echo.
  echo  [X] Pre-flight check failed. Fix the items marked [FAIL] above.
  pause
  exit /b 1
)

REM ---- 4. Open the website in the default browser ------------------------
echo  [..] Opening http://localhost:3000 in your browser...
start "" http://localhost:3000

echo.
echo  -----------------------------------------------------
echo   Website     :  http://localhost:3000
echo   Admin Panel :  http://localhost:3000/admin
echo   Admin login :  admin@maaikathekuaa.com  /  admin123
echo  -----------------------------------------------------
echo   Keep this window open while using the website.
echo   Press Ctrl + C (or close this window) to stop.
echo.

REM ---- 5. Run the server ------------------------------------------------
node server\server.js

echo.
echo  Server stopped.
pause
