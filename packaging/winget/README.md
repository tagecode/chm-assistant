# WinGet：`TageCode.CHMAssistant`

包标识：**`TageCode.CHMAssistant`**

安装：`winget install TageCode.CHMAssistant`

## 首次上架（一次性）

[WinGet Releaser](https://github.com/vedantmgoyal9/winget-releaser) 要求 **winget-pkgs 中已存在至少一个版本**。首次需手动提交：

1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)（与 `tagecode` 组织/账号同名）。
2. 将本目录下 `manifests/t/TageCode/CHMAssistant/` 复制到你的 fork 对应路径。
3. 若新版本 SHA256 / URL 有变，先运行：

```bash
node scripts/resolve-win-release-asset.mjs --tag v0.1.0
```

并更新 `0.1.0/TageCode.CHMAssistant.installer.yaml` 中的 `InstallerUrl` / `InstallerSha256`。

4. 向 `microsoft/winget-pkgs` 提 PR（或使用 Komac）：

```bash
winget install komac
komac token add --token YOUR_CLASSIC_PAT
komac submit --path packaging/winget/manifests/t/TageCode/CHMAssistant --submit
```

Classic PAT 需 **`public_repo`** scope。

## 后续版本（自动化）

配置仓库 Secret **`WINGET_TOKEN`**（同上 Classic PAT）并 fork `winget-pkgs` 后，Release 发布时会由 CI 自动开 PR 更新 manifest。

Workflow：[`.github/workflows/publish-windows-packages.yml`](../../.github/workflows/publish-windows-packages.yml)

## 安装包选择规则

CI 与 `scripts/resolve-win-release-asset.mjs` 会从 Release 资产中选择：

- 文件名以 `-win-x64.exe` 结尾
- 排除 `elevate.exe`、`CHM.Assistant.exe` 等非安装包

当前 v0.1.0 使用：`CHM-Assistant-v0.1.0-win-x64.exe`
