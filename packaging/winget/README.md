# WinGet：`TageCode.CHMAssistant`

包标识：**`TageCode.CHMAssistant`**

安装：`winget install TageCode.CHMAssistant`

## 首次上架

CI 会检测 `winget-pkgs` 中是否已有该包：

| 状态 | CI 行为 |
|------|---------|
| **尚无**（当前） | 使用 **`komac submit`** 提交仓库内 manifest（非交互，CI 可用） |
| **已有** | 使用 **`winget-releaser`** 自动开后续版本 PR |

前提：

1. 仓库 Secret **`WINGET_TOKEN`**（Classic PAT，`public_repo` scope）
2. 已 fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)（与 `tagecode` 账号同名）

若首次 PR 尚未合并就重复运行 workflow，Komac 可能提示已有进行中的 PR，等待合并即可。

> **说明**：`komac new` 在 CI 非 TTY 环境会交互式失败（`The input device is not a TTY`），因此首次上架改用仓库内 manifest + `komac submit --yes`。

### 本地手动提交（可选）

本目录 `manifests/t/TageCode/CHMAssistant/<version>/` 为 WinGet 提交模板（三文件均在版本目录内）。

```powershell
# 1. 解析 Release 资产
node scripts/resolve-win-release-asset.mjs --tag v0.1.0

# 2. 更新 manifest（URL / SHA256 / ReleaseNotesUrl）
node scripts/update-winget-manifest.mjs `
  --version 0.1.0 --tag v0.1.0 `
  --url "https://github.com/tagecode/chm-assistant/releases/download/v0.1.0/CHM-Assistant-v0.1.0-win-x64.exe" `
  --sha256 "9D751EFD0420FE049D2FAD21B67A74EE6EACBC7C7E09AB25C6F4B065A67AAC99"

# 3. 验证（不提交）
komac submit packaging/winget/manifests/t/TageCode/CHMAssistant/0.1.0 --yes --dry-run

# 4. 提交 PR（需 Classic PAT，public_repo scope）
komac sync --token YOUR_CLASSIC_PAT
komac submit packaging/winget/manifests/t/TageCode/CHMAssistant/0.1.0 --yes --token YOUR_CLASSIC_PAT
```

## 后续版本（自动化）

Release 发布或手动触发 [`.github/workflows/publish-windows-packages.yml`](../../.github/workflows/publish-windows-packages.yml) 后，WinGet job 会自动开 PR。

## 安装包选择规则

CI 与 `scripts/resolve-win-release-asset.mjs` 会从 Release 资产中选择：

- 文件名以 `-win-x64.exe` 结尾
- 排除 `elevate.exe`、`CHM.Assistant.exe` 等非安装包

当前 v0.1.0 使用：`CHM-Assistant-v0.1.0-win-x64.exe`
