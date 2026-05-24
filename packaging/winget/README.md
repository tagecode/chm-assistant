# WinGet：`TageCode.CHMAssistant`

包标识：**`TageCode.CHMAssistant`**

安装：`winget install TageCode.CHMAssistant`

## 首次上架

CI 会检测 `winget-pkgs` 中是否已有该包：

| 状态 | CI 行为 |
|------|---------|
| **尚无**（当前） | 使用 **`komac new`** 自动向你的 `winget-pkgs` fork 开首个 PR |
| **已有** | 使用 **`winget-releaser`** 自动开后续版本 PR |

前提：

1. 仓库 Secret **`WINGET_TOKEN`**（Classic PAT，`public_repo` scope）
2. 已 fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)（与 `tagecode` 账号同名）

若首次 PR 尚未合并就重复运行 workflow，Komac 可能提示已有进行中的 PR，等待合并即可。

### 本地手动提交（可选）

本目录 `manifests/t/TageCode/CHMAssistant/` 为参考模板。也可本地运行：

```bash
node scripts/resolve-win-release-asset.mjs --tag v0.1.0
winget install komac
komac token add --token YOUR_CLASSIC_PAT
komac new TageCode.CHMAssistant --version 0.1.0 --urls "INSTALLER_URL" --submit
```

## 后续版本（自动化）

Release 发布或手动触发 [`.github/workflows/publish-windows-packages.yml`](../../.github/workflows/publish-windows-packages.yml) 后，WinGet job 会自动开 PR。

## 安装包选择规则

CI 与 `scripts/resolve-win-release-asset.mjs` 会从 Release 资产中选择：

- 文件名以 `-win-x64.exe` 结尾
- 排除 `elevate.exe`、`CHM.Assistant.exe` 等非安装包

当前 v0.1.0 使用：`CHM-Assistant-v0.1.0-win-x64.exe`
