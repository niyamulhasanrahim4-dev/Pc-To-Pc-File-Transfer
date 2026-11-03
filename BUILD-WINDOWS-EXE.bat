@echo off
title WiFi LAN File Drop - Windows Desktop EXE Builder
color 0B

echo ===============================================================================
echo       WiFi LAN File Drop - Windows Desktop (.EXE) Software Builder
echo ===============================================================================
echo.
echo [*] Starting builder process...
echo.

:: 0. Ensure port 3000 is open in Windows Firewall for Wi-Fi LAN file transfer
netsh advfirewall firewall add rule name="WiFi LAN File Drop (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private,domain >nul 2>&1

:: 1. Launch PowerShell script which has 100% native support for Bengali and Unicode paths
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1"
if %ERRORLEVEL% equ 0 goto done

:: 2. Fallback to direct CMD build if PowerShell is disabled on the machine
echo.
echo [NOTICE] Running fallback build via standard CMD...
cd /d "%~dp0" 2>nul

echo [*] Checking dependencies...
if not exist "node_modules\" (
    call npm install --legacy-peer-deps
)

echo [*] Compiling frontend & server...
call npm run build

echo [*] Building Windows executable into release folder...
call npx electron-builder --win

if exist "release\" (
    echo.
    echo [SUCCESS] Windows executable built in release folder!
    start explorer "release"
)

:done
echo.
echo ===============================================================================
echo Press any key to exit this window...
echo ===============================================================================
pause >nul
