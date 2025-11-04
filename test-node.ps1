# Diagnostic script to test Node.js setup
Write-Host "Diagnosing Node.js setup..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js path
$nodejsPath = "C:\Program Files\nodejs"
Write-Host "Checking Node.js path: $nodejsPath" -ForegroundColor Cyan
if (Test-Path "$nodejsPath\node.exe") {
    Write-Host "  [OK] Node.js found" -ForegroundColor Green
    $nodeExe = "$nodejsPath\node.exe"
    $version = & $nodeExe --version 2>&1
    Write-Host "  [OK] Node.js version: $version" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Node.js not found" -ForegroundColor Red
}

# Check npm
Write-Host ""
Write-Host "Checking npm..." -ForegroundColor Cyan
$npmExe = "$nodejsPath\npm.cmd"
if (Test-Path $npmExe) {
    Write-Host "  [OK] npm found" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] npm not found" -ForegroundColor Red
}

# Check PATH
Write-Host ""
Write-Host "Checking PATH environment variable..." -ForegroundColor Cyan
$pathParts = $env:PATH -split ';'
$hpcPackPaths = $pathParts | Where-Object { $_ -like '*HPC Pack*' }
$nodejsInPath = $pathParts | Where-Object { $_ -like '*nodejs*' }

if ($hpcPackPaths) {
    Write-Host "  [WARNING] Found HPC Pack paths in PATH:" -ForegroundColor Yellow
    $hpcPackPaths | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
} else {
    Write-Host "  [OK] No HPC Pack paths found in PATH" -ForegroundColor Green
}

if ($nodejsInPath) {
    Write-Host "  [OK] Node.js paths in PATH:" -ForegroundColor Green
    $nodejsInPath | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
} else {
    Write-Host "  [WARNING] Node.js not in PATH" -ForegroundColor Yellow
}

# Check which node
Write-Host ""
Write-Host "Checking 'where node' command..." -ForegroundColor Cyan
try {
    $whichNode = where.exe node 2>&1 | Select-Object -First 1
    Write-Host "  Result: $whichNode" -ForegroundColor Cyan
    if ($whichNode -like "*HPC Pack*") {
        Write-Host "  [ERROR] Using HPC Pack node.exe!" -ForegroundColor Red
    } else {
        Write-Host "  [OK] Using correct Node.js" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Cannot check 'where node'" -ForegroundColor Red
}

# Test direct execution
Write-Host ""
Write-Host "Testing direct npm execution..." -ForegroundColor Cyan
try {
    & "$nodejsPath\npm.cmd" --version 2>&1 | Out-Null
    Write-Host "  [OK] Can execute npm directly" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Cannot execute npm: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Diagnosis complete!" -ForegroundColor Cyan

