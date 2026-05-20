# 应用图标

## 源文件

- `icon.png` — 主图标源图（建议 ≥1024×1024，正方形）

## 生成各平台资源

在 macOS 上运行（可生成 `.icns`）：

```bash
pnpm run icons:generate
```

输出到仓库根目录 `build/`（electron-builder 的 `buildResources`）：

| 文件 | 用途 |
|------|------|
| `build/icon.png` | 通用回退、开发窗口图标 |
| `build/icon.icns` | macOS `.app` / `.dmg` |
| `build/icon.ico` | Windows NSIS 安装包 |
| `build/icons/*.png` | Linux AppImage / deb |

在 Linux / Windows 上也可运行脚本（会生成 `.png`、`.ico` 与 `build/icons/`，但**无法**生成 `.icns`）。CI 依赖已提交的 `build/` 目录，请勿只保留源图而不提交生成结果。

## 更换图标后

1. 替换 `resources/icons/icon.png`
2. 执行 `pnpm run icons:generate`
3. 将 `build/` 下变更一并提交
