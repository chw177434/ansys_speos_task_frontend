@echo off
REM 创建 ansys-speos-task Docker 网络

set NETWORK_NAME=ansys-speos-task

echo 检查网络 %NETWORK_NAME% 是否存在...

docker network ls | findstr /C:"%NETWORK_NAME%" >nul
if %errorlevel% equ 0 (
    echo ✓ 网络 %NETWORK_NAME% 已存在
) else (
    echo 创建网络 %NETWORK_NAME%...
    docker network create %NETWORK_NAME%
    if %errorlevel% equ 0 (
        echo ✓ 网络 %NETWORK_NAME% 创建成功
    ) else (
        echo ✗ 网络创建失败
        exit /b 1
    )
)

echo.
echo 网络信息：
docker network inspect %NETWORK_NAME% --format "{{.Name}}: {{.Driver}}"

