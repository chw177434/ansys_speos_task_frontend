@echo off
REM Next.js Development Server Startup Script
REM Calls PowerShell script which has the working solution

powershell -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start dev server
    pause
)
