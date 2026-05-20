#!/usr/bin/env bash
# 从 resources/icons/icon.png 生成 electron-builder 所需的 build/ 图标资源。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/resources/icons/icon.png"
BUILD="$ROOT/build"
ICONSET="$BUILD/icon.iconset"
ICONS="$BUILD/icons"

if [ ! -f "$SRC" ]; then
  echo "[icons] 缺少源图: $SRC"
  exit 1
fi

mkdir -p "$ICONSET" "$ICONS"

echo "[icons] 源图: $SRC"

# 主图标 1024×1024（electron-builder 回退）
sips -z 1024 1024 "$SRC" --out "$BUILD/icon.png" >/dev/null

# Linux：build/icons/{size}x{size}.png
for size in 16 32 48 64 128 256 512; do
  sips -z "$size" "$size" "$SRC" --out "$ICONS/${size}x${size}.png" >/dev/null
done

# Windows ICO 用多尺寸 PNG
ICO_DIR="$BUILD/_ico-src"
rm -rf "$ICO_DIR"
mkdir -p "$ICO_DIR"
for size in 16 32 48 64 128 256; do
  sips -z "$size" "$size" "$SRC" --out "$ICO_DIR/${size}.png" >/dev/null
done

# macOS .icns（iconutil 仅 macOS）
if command -v iconutil >/dev/null 2>&1; then
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  sips -z 16 16 "$SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32 "$SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64 "$SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256 "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512 "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
  iconutil -c icns "$ICONSET" -o "$BUILD/icon.icns"
  rm -rf "$ICONSET"
  echo "[icons] build/icon.icns"
else
  echo "[icons] 跳过 icon.icns（非 macOS，请在本机运行或提交已生成的 build/icon.icns）"
fi

# Windows .ico
if npx --yes png-to-ico "$ICO_DIR"/*.png > "$BUILD/icon.ico" 2>/dev/null; then
  echo "[icons] build/icon.ico"
else
  echo "[icons] png-to-ico 失败，打包 Windows 时 electron-builder 会尝试从 icon.png 生成"
fi
rm -rf "$ICO_DIR"

echo "[icons] build/icon.png + build/icons/* 已生成"
