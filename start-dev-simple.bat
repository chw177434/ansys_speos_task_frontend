@echo off
REM Simple wrapper - calls PowerShell script which has the working solution

powershell -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"

if errorlevel 1 (
    pause
)

