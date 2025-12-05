@echo off
REM 临时启动脚本（抑制 deprecation 警告）

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
REM Change to project root directory (one level up from scripts\)
cd /d "%SCRIPT_DIR%.."

set NODE_OPTIONS=--no-deprecation
npm run dev -- -H 0.0.0.0

