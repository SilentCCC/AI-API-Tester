@echo off
setlocal EnableExtensions
title AI API Tester
cd /d "%~dp0"

echo ========================================
echo          AI API Tester Launcher
echo ========================================
echo.
echo [1/4] Checking project directory...

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Current directory: %CD%
  echo.
  pause
  exit /b 1
)

echo [2/4] Checking Node.js...
where.exe node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 18 or newer from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo [ERROR] Could not read the Node.js version.
  echo.
  pause
  exit /b 1
)

if %NODE_MAJOR% LSS 18 (
  echo [ERROR] Node.js 18 or newer is required.
  echo Installed version:
  node --version
  echo.
  pause
  exit /b 1
)

echo       Node.js version:
node --version
echo.
echo [3/4] Checking dependencies...

if not exist "node_modules\express\package.json" (
  echo       Installing dependencies. Please wait...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Check your network and npm configuration, then try again.
    echo.
    pause
    exit /b 1
  )
) else (
  echo       Dependencies are ready.
)

echo.
echo [4/4] Starting the local server...
echo.
echo Open this address in your browser:
echo http://localhost:3000
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

call npm.cmd start
set "START_RESULT=%ERRORLEVEL%"

echo.
if not "%START_RESULT%"=="0" (
  echo [ERROR] The server stopped with exit code %START_RESULT%.
) else (
  echo The server has stopped.
)
echo.
pause
exit /b %START_RESULT%
