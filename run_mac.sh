#!/bin/bash

echo "[INFO] 正在检查运行环境..."

if ! command -v uv &> /dev/null; then
    echo "[WARN] 未检测到 uv，正在尝试自动安装..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    # 尝试添加环境变量
    export PATH="$HOME/.local/bin:$PATH"
    export PATH="$HOME/.cargo/bin:$PATH"
    
    if ! command -v uv &> /dev/null; then
        echo "[ERROR] uv 安装后仍无法识别。请重启终端或手动安装 uv。"
        exit 1
    fi
else
    echo "[INFO] 环境检测通过 (uv 已安装)。"
fi

echo "[INFO] 正在启动抖音直播自动助手..."
echo "[INFO] 首次运行需要下载依赖，请耐心等待..."
echo "-------------------------------------------------------"

# 确保脚本所在目录是当前工作目录
cd "$(dirname "$0")"

uv run main.py
