# 包管理器与商店分发

本文档说明如何将 CHM Assistant 通过 GitHub Actions 发布到 **Chocolatey**、**Snap** 等平台，以及实施前需要准备的账号、密钥、仓库结构与分阶段计划。

当前 Release 流水线见 [ci.md](./ci.md)；编译器与许可说明见 [compiler-setup.md](./compiler-setup.md)。

---

## 当前基础（已有）

Release 工作流（[`.github/workflows/release.yml`](../.github/workflows/release.yml)）已具备商店分发最核心的前提：

| 已有能力 | 说明 |
|---------|------|
| 多平台产物 | Windows `.exe`、Linux `.AppImage` / `.deb`、macOS `.dmg` / `.zip` |
| 稳定命名 | `CHM Assistant-v{version}-{os}-{arch}.{ext}` |
| Tag 发版 | `v*` tag 触发构建与 GitHub Release |
| 版本校验 | `node scripts/check-release-version.mjs` |
| 许可文档 | 应用 MIT；内置 GPL-2 `chmcmd` 说明见 [`public/NOTICES.md`](../public/NOTICES.md) |

**Phase 1（Windows）已落地**：Chocolatey + WinGet 包描述、解析脚本与 [`.github/workflows/publish-windows-packages.yml`](../.github/workflows/publish-windows-packages.yml)。

**尚未具备**：Snap 等 Linux 商店分发。

---

## Phase 1：Chocolatey + WinGet（已实现）

| 项 | 路径 / 说明 |
|----|-------------|
| Workflow | [`.github/workflows/publish-windows-packages.yml`](../.github/workflows/publish-windows-packages.yml) |
| 触发 | GitHub Release 状态变为 **released**；或手动 `workflow_dispatch` 填写 tag |
| Chocolatey 包 | [`packaging/chocolatey/`](../packaging/chocolatey/)（ID：`chm-assistant`） |
| WinGet manifest | [`packaging/winget/`](../packaging/winget/)（ID：`TageCode.CHMAssistant`） |
| 解析脚本 | [`scripts/resolve-win-release-asset.mjs`](../scripts/resolve-win-release-asset.mjs) |
| 更新 nuspec | [`scripts/update-chocolatey-package.mjs`](../scripts/update-chocolatey-package.mjs) |

### 发版后流程

1. `release.yml` 创建 GitHub Release（与现有一致）。
2. Release **published** 后，`publish-windows-packages.yml` 自动运行：
   - 从 Release 资产中选取 `*-win-x64.exe`（排除 `elevate.exe` 等）。
   - **Chocolatey**：更新 nuspec → `choco pack` → `choco push`。
   - **WinGet**：[`winget-releaser`](https://github.com/vedantmgoyal9/winget-releaser) 向 `winget-pkgs` 开 PR。

### 仓库 Secrets（必配）

| Secret | 平台 | 说明 |
|--------|------|------|
| `CHOCO_API_KEY` | Chocolatey | 你已获取；在 Settings → Secrets → Actions 中添加 |
| `WINGET_TOKEN` | WinGet | **Classic** PAT，`public_repo` scope；需 fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) |

### WinGet 首次上架（一次性）

自动化 PR **要求 winget-pkgs 中已有至少一个版本**。v0.1.0 请按 [`packaging/winget/README.md`](../packaging/winget/README.md) 手动提首个 PR；合并后后续版本由 CI 自动更新。

### 安装命令（上架后）

```powershell
choco install chm-assistant
winget install TageCode.CHMAssistant
```

---

## 总体架构

不建议把所有商店逻辑塞进现有 `release.yml`（某个商店失败可能拖慢 GitHub Release）。推荐：

```
v0.x.x tag
    → release.yml（构建 + GitHub Release，保持不变）
    → publish-chocolatey.yml（可选，独立 job）
    → publish-snap.yml（可选，独立 job）
    → publish-winget.yml（可选，提 PR）
```

- **主 Release 不变**：继续只负责构建与上传 GitHub Release。
- **新增独立 workflow**：在 Release 成功后触发（`workflow_run` / `repository_dispatch` / 手动 `workflow_dispatch`）。
- **包元数据**：可放在本仓库 `packaging/`，或 Chocolatey 社区常见的独立仓库。

---

## Chocolatey（Windows）

### 账号与权限

- 在 [community.chocolatey.org](https://community.chocolatey.org/) 注册账号。
- 生成 **API Key**（用于 `choco push`）。
- 首次提交需经过**社区审核**（通常数天）。

### 建议目录结构

```
packaging/chocolatey/
  chm-assistant.nuspec
  tools/
    chocolateyinstall.ps1
    chocolateyuninstall.ps1   # 可选
    VERIFICATION.txt          # 可选，审核用
```

`chocolateyinstall.ps1` 典型逻辑：

1. 从 GitHub Release 下载 `CHM Assistant-v{version}-win-x64.exe`。
2. 校验 **SHA256**。
3. 静默安装：`Start-Process ... -ArgumentList '/S'`（electron-builder NSIS 支持 `/S`）。

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `CHOCO_API_KEY` | `choco push` 推送到社区源 |

### CI 注意点

- 可在任意 runner 上执行 PowerShell 脚本，**无需重新打包**。
- 产物 URL 含空格（`CHM Assistant-v...`），下载时需正确编码。
- 建议安装后冒烟：Chocolatey AU 模块的 `Test-Package`，或安装后验证应用可启动。

### 与本项目相关的特殊点

- 官方安装包已内置 **GPL-2 chmcmd**，nuspec 的 `licenseUrl` / 描述应链接 [`NOTICES.md`](../public/NOTICES.md)。
- 用户侧**不需要**再安装 `freepascal`（与 [compiler-setup.md](./compiler-setup.md) 一致）。

---

## Snap（Linux）

### 账号与权限

- 在 [snapcraft.io](https://snapcraft.io/) 注册账号。
- **注册 snap 名称**（建议 `chm-assistant`，与 `appId` `com.tagecode.chm-assistant` 一致）。
- Store **人工审核**（首次通常较慢）。

### 两种实现路径

**路径 A：electron-builder 直接打 snap（推荐先试）**

在 `package.json` 的 `linux.target` 增加 `snap`，并配置 `build.snap`，例如：

```json
"snap": {
  "confinement": "strict",
  "grade": "stable",
  "summary": "跨平台 CHM 阅读与 Markdown 创作工具",
  "plugs": ["default", "removable-media"]
}
```

CHM 助手需读写用户文件；默认 plugs 对主目录通常够用。若需从 U 盘等外置介质打开 CHM，建议加 `removable-media`。

**路径 B：用现有 `.deb` 转 snap**

CI 已产出 `.deb`，也可用 `snapcraft.yaml` + deb 插件打包，维护成本通常更高。

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `SNAPCRAFT_STORE_CREDENTIALS` | 由 `snapcraft export-login` 导出（**不是**用户名密码） |

本地生成（一次性）：

```bash
snapcraft export-login exported.txt
# 将 exported.txt 全文存为 GitHub Secret
```

Workflow 中通过环境变量传给 action：

```yaml
env:
  SNAPCRAFT_STORE_CREDENTIALS: ${{ secrets.SNAPCRAFT_STORE_CREDENTIALS }}
```

常用 action 组合：`snapcore/action-build` + `snapcore/action-publish`。

### CI 注意点

- 需在 **Ubuntu runner** 上安装 snapcraft / LXD。
- **架构**：已有 Linux x64 与 arm64 构建，Snap 也需分别发布（或先只发 amd64）。
- **渠道**：CI 自动推到 `edge`，稳定版再手动 promote 到 `stable`。
- electron-builder 的 snap 目标默认会尝试推 Store；若只想产出 `.snap` 不上传，可使用 `-c.snap.publish=github` 或 `--publish never`。

### 与本项目相关的特殊点

- bundled GPL-2 二进制：Store 描述与源码链接需写清楚。
- `strict` confinement 下文件访问受限，需实测：打开 CHM、编译项目、选择目录等全流程。

---

## 其它常见平台（可选）

| 平台 | 自动化难度 | 主要准备 |
|------|-----------|---------|
| **Winget** | 中（PR 制，无 push API） | 向 [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) 提 manifest；可用 **Komac** 从 Release 自动生成 PR |
| **Homebrew Cask** | 中（PR 制） | 向 [homebrew-cask](https://github.com/Homebrew/homebrew-cask) 提 cask，使用 `.dmg` 或 `.zip` |
| **Flathub** | 高（独立仓库 + 审核） | 单独 manifest 仓库，在 Flathub CI 构建 |
| **Scoop** | 低 | 维护 bucket manifest，指向 GitHub Release |
| **AUR** | 低（多为社区维护） | PKGBUILD，通常不由官方 CI 直推 |

若目标是「GitHub Actions 尽量覆盖多平台」，实际优先级建议：

**Winget + Chocolatey（Windows）→ Snap（Linux）→ Homebrew Cask（macOS）**

### Winget 补充说明

- 无需专用 API Key；使用 `GITHUB_TOKEN` 向 `winget-pkgs` 提 PR 即可。
- Manifest 需包含：安装包 URL、SHA256、静默安装参数（NSIS 一般为 `/S`）、Publisher、ProductCode 等。
- 可用 [Komac](https://github.com/russellbanks/Komac) 或类似工具在 Release 后自动开 PR。

---

## GitHub Secrets 汇总

| Secret | 平台 | 是否必须 |
|--------|------|---------|
| `GITHUB_TOKEN` | GitHub Release | 已有（workflow 默认） |
| `CHOCO_API_KEY` | Chocolatey | 是（推送时） |
| `SNAPCRAFT_STORE_CREDENTIALS` | Snap | 是（上传时） |
| `WINGET_TOKEN` | WinGet | 是（Classic PAT，`public_repo`） |
| `CSC_LINK`、`APPLE_ID` 等 | 代码签名 | 非必须；企业/商店环境更友好 |

代码签名现状见 [ci.md](./ci.md#代码签名可选)：`CSC_IDENTITY_AUTO_DISCOVERY=false`，当前为未签名构建。

---

## 仓库内文件（Windows 已完成）

| 类别 | 路径 |
|------|------|
| Chocolatey | [`packaging/chocolatey/`](../packaging/chocolatey/) |
| WinGet | [`packaging/winget/`](../packaging/winget/) |
| Workflow | [`.github/workflows/publish-windows-packages.yml`](../.github/workflows/publish-windows-packages.yml) |
| 脚本 | `scripts/resolve-win-release-asset.mjs`、`scripts/update-chocolatey-package.mjs` |
| Snap（待做） | `packaging/snap/*` 或 `snapcraft.yaml` |

---

## 发版流程（目标状态）

1. 更新 `package.json` 的 `version` → 打 tag（如 `v0.1.1`）→ 推送。
2. `release.yml` 构建并发布 **GitHub Release**（现状不变）。
3. 独立 publish workflow 读取 tag / version，引用 Release 资产 URL 或下载 artifact。
4. **Chocolatey**：更新 nuspec → `choco push`。
5. **Snap**：构建 `.snap` → 上传 Store → 发布到 `edge`（再 promote 到 `stable`）。
6. **Winget（可选）**：Komac 等工具向 `winget-pkgs` 开 PR。

Tag 与版本一致性的要求见 [ci.md](./ci.md#发版流程)。

---

## 分阶段实施建议

| 阶段 | 目标 | 工作量 |
|------|------|--------|
| **Phase 1** | Winget + Chocolatey（Windows，复用现有 NSIS `.exe`） | **已完成** |
| **Phase 2** | Snap amd64（扩展 Linux 构建或独立 job） | 中 |
| **Phase 3** | Snap arm64、Homebrew Cask、Flathub | 中～大 |

---

## 实施前检查清单（非代码）

1. 注册 **Chocolatey** 账号并生成 API Key。
2. 注册 **Snapcraft** 账号并 **claim** 应用名 `chm-assistant`（或最终确定的名称）。
3. 确认 Release 资产命名长期稳定（文件名含空格，脚本与 URL 需编码）。
4. 准备商店用**简短描述、截图、官网 / GitHub 链接**（审核常用）。
5. 确认 **GPL-2 chmcmd** 在商店页面的许可表述（链接 [`NOTICES.md`](../public/NOTICES.md) 与 [compiler-setup.md](./compiler-setup.md)）。

---

## 相关文档

- [ci.md](./ci.md) — GitHub Actions 与跨平台打包
- [compiler-setup.md](./compiler-setup.md) — 编译器依赖与 GPL 说明
- [README.md](../README.md) — 用户安装与 Release 下载
