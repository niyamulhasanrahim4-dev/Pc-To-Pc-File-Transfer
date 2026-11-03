[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "WiFi LAN File Drop - Windows Desktop Builder"

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "       WiFi LAN File Drop - Windows Desktop (.EXE) Software Builder" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan

# Resolve project root safely
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location -LiteralPath $ProjectRoot

Write-Host "Project Directory: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# 0. Allow Port 3000 in Windows Firewall for Wi-Fi LAN transfer
try {
    cmd.exe /c "netsh advfirewall firewall add rule name=`"WiFi LAN File Drop (Port 3000)`" dir=in action=allow protocol=TCP localport=3000 profile=private,domain" >$null 2>&1
} catch {}

# 1. Check Node.js
try {
    $nodeVersion = node -v 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    Write-Host "[OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is NOT installed or NOT found in PATH!" -ForegroundColor Red
    Write-Host "Please download and install Node.js (LTS version) from:" -ForegroundColor Yellow
    Write-Host "   https://nodejs.org/" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Check npm
try {
    $npmVersion = npm -v 2>$null
    Write-Host "[OK] npm is installed:     $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm is NOT found!" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}
Write-Host ""

# 3. Check node_modules
if (-not (Test-Path -LiteralPath "$ProjectRoot\node_modules")) {
    Write-Host "[*] Step 1/3: Installing project dependencies (npm install)..." -ForegroundColor Cyan
    cmd.exe /c "npm install --legacy-peer-deps"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[NOTICE] Retrying with --force flag..." -ForegroundColor Yellow
        cmd.exe /c "npm install --force"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed. Please check your internet connection." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
    Write-Host "[OK] Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies are already present." -ForegroundColor Green
}
Write-Host ""

# 4. Build Vite Frontend & Bundle Embedded Server
Write-Host "[*] Step 2/3: Compiling React UI & Embedded Server..." -ForegroundColor Cyan
cmd.exe /c "npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build step failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}
Write-Host "[OK] Frontend and Server bundled successfully!" -ForegroundColor Green
Write-Host ""

# 5. Build Windows Executable (.exe)
Write-Host "[*] Step 3/3: Packaging Windows Desktop Software into 'release' folder..." -ForegroundColor Cyan
Write-Host "Please wait, electron-builder is creating your Windows .exe..." -ForegroundColor Yellow

cmd.exe /c "npx electron-builder --win"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[NOTICE] Retrying build with portable target..." -ForegroundColor Yellow
    cmd.exe /c "npx electron-builder --win portable"
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
if (Test-Path -LiteralPath "$ProjectRoot\release") {
    Write-Host "       SUCCESS! Software created successfully inside 'release' folder!" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Generated software location:" -ForegroundColor White
    Write-Host "   $ProjectRoot\release" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor White
    Get-ChildItem -LiteralPath "$ProjectRoot\release" | ForEach-Object {
        Write-Host " - $($_.Name)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Opening 'release' folder in Windows Explorer..." -ForegroundColor Cyan
    Start-Process explorer.exe -ArgumentList "`"$ProjectRoot\release`""
} else {
    Write-Host "[WARNING] Build finished but 'release' folder was not detected." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit this window..."
