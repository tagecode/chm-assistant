# GitHub Actions 与跨平台打包

## 工作流

| 文件 | 触发 | 作用 |
|------|------|------|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `push` / `pull_request` → `main` | `lint` + `test:mvp` |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | `v*` tag、`workflow_dispatch` | 多架构打包并上传 Release |

## Release 构建矩阵

| Runner | 平台 | 架构 | 说明 |
|--------|------|------|------|
| `macos-latest` | macOS | **arm64** | Apple Silicon 原生构建 |
| `macos-latest` | macOS | **x64** | Intel Mac（同 runner 交叉编译 native + 应用） |
| `windows-latest` | Windows | x64 | NSIS 安装包 |
| `ubuntu-latest` | Linux | x64 | AppImage + deb |
| `ubuntu-24.04-arm` | Linux | **arm64** | AppImage + deb |

CI 入口：`node scripts/ci-package.mjs`（读取 `CI_PLATFORM` / `CI_ARCH`），等价于本地：

```bash
NATIVE_REBUILD_ARCH=arm64 CI_PLATFORM=mac CI_ARCH=arm64 pnpm run dist:ci
```

## 本地与 CI 一致的打包命令

默认 `dist:*` 使用**当前机器**架构：

```bash
pnpm run dist:mac
pnpm run dist:win
pnpm run dist:linux
```

指定架构（与 CI 相同逻辑）：

```bash
NATIVE_REBUILD_ARCH=x64 CI_PLATFORM=mac CI_ARCH=x64 pnpm run dist:ci
NATIVE_REBUILD_ARCH=arm64 CI_PLATFORM=linux CI_ARCH=arm64 pnpm run dist:ci
```

`dist:prepare` 会读取 `NATIVE_REBUILD_ARCH`（未设置则用 `process.arch`）。`compilers:stage` 将 `chmcmd` 复制到 `resources/compilers/{platform}-{arch}/`（Windows 为 `chmcmd.exe`）。

## 应用图标

源图：`resources/icons/icon.png`  
打包资源：`build/`（由 `pnpm run icons:generate` 生成，**需提交到仓库**供全平台 CI 使用）

| 平台 | electron-builder 配置 |
|------|------------------------|
| macOS | `build/icon.icns` |
| Windows | `build/icon.ico` |
| Linux | `build/icons/` 多尺寸 PNG |

更换图标见 [resources/icons/README.md](../resources/icons/README.md)。`ci-package.mjs` 会在打包前检查 `build/` 关键文件是否存在。

## 发版流程

1. 更新 `package.json` 的 `version`（例如 `0.1.0`）
2. 提交并打 tag：**必须与 version 一致**，形如 `v0.1.0`
3. `git push origin v0.1.0` → 触发 Release 工作流（**5 个**构建 job）
4. 或先在 Actions 里 **Run workflow**（`workflow_dispatch`）验证构建

Tag 校验：`node scripts/check-release-version.mjs`

## CI 系统依赖（已自动化）

| 平台 | 脚本 | 内容 |
|------|------|------|
| Linux | `scripts/ci-install-linux-build-deps.sh` | `build-essential`、`python3`、`libfuse2` |
| Linux / macOS | `scripts/ci-install-chmcmd.sh` | Free Pascal (`fpc`) → `chmcmd` |
| Windows | `scripts/ci-install-chmcmd.ps1` | Chocolatey `freepascal` → `chmcmd.exe` |

## 产物

输出目录：`release/`  
命名：`CHM Assistant-v{version}-{os}-{arch}.{ext}`

| 平台 | 架构 | 格式 |
|------|------|------|
| macOS | arm64 / x64 | `.dmg`、`.zip` |
| Windows | x64 | `.exe` (NSIS) |
| Linux | x64 / arm64 | `.AppImage`、`.deb` |

## 代码签名（可选）

当前 CI 设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`，产出**未签名**安装包。正式分发见仓库 Secrets（`CSC_LINK`、`APPLE_ID` 等）。

## 相关文档

- [distribution.md](./distribution.md) — Chocolatey、Snap 等包管理器分发准备
- [compiler-setup.md](./compiler-setup.md)
- [mvp-acceptance-signoff.md](./mvp-acceptance-signoff.md)
