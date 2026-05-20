#!/usr/bin/env bash
# CI 用：Linux 上 node-gyp 原生模块与 AppImage 打包依赖。
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  build-essential \
  python3 \
  libfuse2

echo "[ci] Linux build deps installed"
