#!/bin/bash

echo "[Douyin Auto Sender] Checking environment..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "[Info] 'uv' not found. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source "$HOME/.cargo/env"
else
    echo "[Info] 'uv' is already installed."
fi

echo "[Info] Installing/Syncing dependencies..."
uv sync

echo "[Info] Starting application..."
uv run main.py
