@echo off
chcp 65001 >nul
echo [INFO] 正在检查运行环境...

where uv >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] 未检测到 uv，正在尝试自动安装...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    
    echo [INFO] uv 安装完成。
    
    REM 尝试将常见的 uv 安装路径添加到临时环境变量中，以便立即使用
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
    set "PATH=%LOCALAPPDATA%\uv;%PATH%"
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
) else (
    echo [INFO] 环境检测通过 (uv 已安装)。
)

echo [INFO] 正在启动抖音直播自动助手...
echo [INFO] 首次运行需要下载依赖，请耐心等待...
echo -------------------------------------------------------
uv run main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] 程序运行出错！
    echo 可能原因：
    echo 1. 未安装 Python (uv 通常会自动管理，但部分系统可能需要)
    echo 2. 网络问题导致依赖下载失败
    echo 3. 如果提示找不到 uv，请尝试重启电脑后再运行此脚本
    pause
)

echo [INFO] 程序已结束。
pause
