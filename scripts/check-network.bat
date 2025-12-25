@echo off
REM 检查 ansys-speos-task 网络配置

set NETWORK_NAME=ansys-speos-task

echo 检查网络配置...
echo.

REM 检查网络是否存在
docker network ls | findstr /C:"%NETWORK_NAME%" >nul
if %errorlevel% equ 0 (
    echo ✓ 网络 %NETWORK_NAME% 存在
    
    echo.
    echo 网络中的容器：
    for /f "tokens=*" %%i in ('docker network inspect %NETWORK_NAME% --format "{{range .Containers}}{{.Name}} {{end}}" 2^>nul') do (
        if "%%i"=="" (
            echo   无容器
        ) else (
            echo   %%i
        )
    )
    
    echo.
    echo 网络详情：
    docker network inspect %NETWORK_NAME% --format "名称: {{.Name}}^
驱动: {{.Driver}}^
作用域: {{.Scope}}"
) else (
    echo ✗ 网络 %NETWORK_NAME% 不存在
    echo 请运行: scripts\create-network.bat
    exit /b 1
)

