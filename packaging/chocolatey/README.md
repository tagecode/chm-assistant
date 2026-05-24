# Chocolatey：`chm-assistant`

社区包 ID：**`chm-assistant`**（`choco install chm-assistant`）

## 本地验证

1. 解析 Release 资产（需网络）：

```powershell
node scripts/resolve-win-release-asset.mjs --tag v0.1.0
```

2. 更新 nuspec / install 脚本并打包：

```powershell
node scripts/update-chocolatey-package.mjs `
  --version 0.1.0 `
  --url "https://github.com/tagecode/chm-assistant/releases/download/v0.1.0/CHM-Assistant-v0.1.0-win-x64.exe" `
  --sha256 9D751EFD0420FE049D2FAD21B67A74EE6EACBC7C7E09AB25C6F4B065A67AAC99

choco pack packaging/chocolatey/chm-assistant.nuspec --out=packaging/chocolatey
choco install packaging/chocolatey/chm-assistant.0.1.0.nupkg -y --source="'$PWD\packaging\chocolatey'"
```

3. 推送（需 API Key）：

```powershell
choco push packaging/chocolatey/chm-assistant.0.1.0.nupkg --source https://push.chocolatey.org/ --key YOUR_API_KEY
```

## CI

Release **published** 后由 [`.github/workflows/publish-windows-packages.yml`](../../.github/workflows/publish-windows-packages.yml) 自动 `choco pack` + `choco push`。

仓库 Secret：**`CHOCO_API_KEY`**

## 说明

- 安装包来自 GitHub Release 上的 `*-win-x64.exe`（排除 `elevate.exe` 等辅助文件）。
- 静默安装参数：`/S`（NSIS）。
- 新包首次推送会进入 Chocolatey **社区审核**队列。
