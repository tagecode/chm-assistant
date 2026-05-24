#!/usr/bin/env bash
# CI 用：安装 chmcmd（Free Pascal），供 compilers:stage 打入 Unix 安装包。
# 环境变量 CI_ARCH：x64 | arm64（与 release 矩阵一致）
set -euo pipefail

TARGET_ARCH="${CI_ARCH:-$(uname -m)}"
case "$TARGET_ARCH" in
  x86_64 | amd64) TARGET_ARCH=x64 ;;
  aarch64 | arm64) TARGET_ARCH=arm64 ;;
esac

HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  x86_64 | amd64) HOST_ARCH=x64 ;;
  aarch64 | arm64) HOST_ARCH=arm64 ;;
esac

if command -v chmcmd >/dev/null 2>&1; then
  if [ "$(uname -s)" != Darwin ] || [ "$HOST_ARCH" != arm64 ] || [ "$TARGET_ARCH" != x64 ]; then
    echo "[ci] chmcmd already available: $(command -v chmcmd)"
    exit 0
  fi
  if arch -x86_64 command -v chmcmd >/dev/null 2>&1; then
    echo "[ci] x64 chmcmd already available: $(arch -x86_64 command -v chmcmd)"
    exit 0
  fi
fi

case "$(uname -s)" in
  Darwin)
    if ! command -v brew >/dev/null 2>&1; then
      echo "[ci] Homebrew not found on macOS runner"
      exit 1
    fi
    if [ "$HOST_ARCH" = arm64 ] && [ "$TARGET_ARCH" = x64 ]; then
      echo "[ci] Installing x64 Free Pascal (Rosetta) for macOS x64 package..."
      arch -x86_64 brew install fpc
      CHM="$(arch -x86_64 command -v chmcmd || true)"
    else
      brew install fpc
      CHM="$(command -v chmcmd || true)"
    fi
    if [ -z "${CHM:-}" ]; then
      echo "[ci] chmcmd not found after install (target=$TARGET_ARCH host=$HOST_ARCH)"
      exit 1
    fi
    echo "[ci] chmcmd: $CHM"
    ;;
  Linux)
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends \
      fp-compiler fp-utils 2>/dev/null ||
      sudo apt-get install -y --no-install-recommends fpc ||
      sudo apt-get install -y --no-install-recommends fp-compiler-3.2.2 fp-utils-3.2.2
    command -v chmcmd
    ;;
  *)
    echo "[ci] Unsupported OS for chmcmd install: $(uname -s)"
    exit 1
    ;;
esac
