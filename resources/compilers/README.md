# 捆绑 CHM 编译器（仅 macOS / Linux）

本目录用于存放 **chmcmd** 二进制，随 CHM Assistant 安装包分发（GPL-2，见 `public/NOTICES.md`）。

## 目录结构

```
resources/compilers/
  darwin-arm64/chmcmd
  darwin-x64/chmcmd
  linux-arm64/chmcmd
  linux-x64/chmcmd
  ...
```

Windows **不**在此放置 `hhc.exe`（微软 HTML Help EULA 仅允许再分发 `hhupd.exe` 运行时，不允许再分发编译器）。

## 发布前准备

```bash
pnpm run compilers:stage   # 从本机 PATH 复制 chmcmd 到对应平台目录
pnpm run dist:mac        # 或 dist:linux
```

若 `compilers:stage` 失败，请先在本机安装 chmcmd，参见 [docs/compiler-setup.md](../../docs/compiler-setup.md)。

开发模式（`pnpm run dev`）会从本仓库 `resources/compilers/<platform>-<arch>/chmcmd` 读取；若不存在则回退到系统 PATH。
