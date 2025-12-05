# Next.js Development Server Startup Script
# This is the working solution - clean PATH and run npm

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Change to project root directory (one level up from scripts/)
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Next.js Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clean PATH: Remove HPC Pack paths and put Node.js first
# This is the method that worked before
$nodejsPath = "C:\Program Files\nodejs"
$pathParts = $env:PATH -split ';'
$cleanedParts = $pathParts | Where-Object { $_ -notlike '*Microsoft HPC Pack*' }
$env:PATH = "$nodejsPath;" + ($cleanedParts -join ';')

Write-Host "Node.js path: $nodejsPath" -ForegroundColor Green
Write-Host "PATH cleaned (HPC Pack removed)" -ForegroundColor Green
Write-Host ""

# Verify node
try {
    $nodeVersion = & "$nodejsPath\node.exe" --version 2>&1
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Cannot execute Node.js" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Dev Server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clear PowerShell command cache
if (Get-Command node -ErrorAction SilentlyContinue) {
    Remove-Item function:node -ErrorAction SilentlyContinue
}
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Remove-Item function:npm -ErrorAction SilentlyContinue
}

# Run npm with cleaned PATH
npm run dev
