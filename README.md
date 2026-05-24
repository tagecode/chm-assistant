# CHM 助手

> 一款跨平台 CHM 文件阅读、使用 Markdown 进行创作与一键编译成 CHM 文件的桌面应用

[CI](https://github.com/tagecode/chm-assistant/actions/workflows/ci.yml)
[License: MIT](LICENSE)
[Release](https://github.com/tagecode/chm-assistant/releases)
[Electron](https://www.electronjs.org/)
[pnpm](https://pnpm.io/)

[English](README.en.md) · [安装](#安装) · [功能](#功能) · [开发](#开发) · [文档](#文档) · [贡献](#贡献) · [许可](#许可)

---

## 简介

**CHM 助手**将 CHM 阅读与 Markdown 创作整合在同一款桌面应用中：打开 `.chm` 文件阅读，用 Markdown 维护帮助项目，一键编译并在内置阅读器中预览成品。

**v0.1.0** 为首个公开发布版本，覆盖 MVP 核心能力：CHM 阅读、Markdown 创作、跨平台编译与内置预览。更多规划功能见 [docs/feature.md](docs/feature.md)。

---

## 功能

- **CHM 阅读** — 目录 / 索引导航、前进后退、全文搜索、页内查找、GBK / UTF-8 编码、多主题
- **Markdown 创作** — Monaco 编辑器、项目树、资源管理、实时预览、编译日志行号跳转
- **一键编译** — 生成 `.hhp` / `.hhc` / `.hhk`，调用平台编译器产出 `.chm`，编译完成后在内置阅读器中打开
- **跨平台** — macOS、Windows、Linux 统一体验；安装包内置 `chmcmd`，一般无需额外配置编译器

技术栈：[Electron](https://www.electronjs.org/) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

CHM 解析基于 [CHMLib](https://github.com/jedwing/CHMLib)（LGPL-2.1），通过 Node 原生模块（N-API）封装。

---

## 平台支持


| 平台      | 架构        | 安装包格式             |
| ------- | --------- | ----------------- |
| macOS   | arm64、x64 | `.dmg`、`.zip`     |
| Windows | x64       | NSIS 安装包 (`.exe`) |
| Linux   | x64、arm64 | AppImage、`.deb`   |


---

## 安装

从 [GitHub Releases](https://github.com/tagecode/chm-assistant/releases) 下载对应平台的安装包。

产物命名：`CHM Assistant-v{version}-{os}-{arch}.{ext}`（例如 `CHM Assistant-v0.1.0-win-x64.exe`）。

### 快速上手

1. 安装并启动 CHM 助手
2. **阅读 CHM** — 首页选择「打开 CHM 文件」，或直接拖拽 `.chm` 到窗口
3. **创作与编译** — 新建或打开创作项目，编写 Markdown 后点击编译；成品会在内置阅读器中打开

> **说明**
>
> - 仅阅读 CHM **不需要**安装任何编译器
> - 创作模块编译 CHM 时，官方安装包已内置 `chmcmd`；Windows 用户也可在设置中指定 `hhc.exe`（HTML Help Workshop）
> - macOS 未签名构建首次打开时，需在系统设置中允许运行，详见 [docs/mac-install.md](docs/mac-install.md)

编译器详情：[docs/compiler-setup.md](docs/compiler-setup.md)

---

## 开发

### 环境要求


| 依赖      | 版本 / 说明                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------ |
| Node.js | **24**（与 CI 一致）                                                                                  |
| pnpm    | **9**                                                                                            |
| 原生构建工具  | macOS：Xcode CLT · Windows：VS Build Tools（C++） · Linux：见 `scripts/ci-install-linux-build-deps.sh` |


### 本地运行

```bash
git clone https://github.com/tagecode/chm-assistant.git
cd chm-assistant
pnpm install
pnpm run native:rebuild   # 首次克隆或 native 代码变更后
pnpm run dev
```

### 常用命令


| 命令                    | 说明                        |
| --------------------- | ------------------------- |
| `pnpm run build`      | 类型检查 + 前端 / 主进程构建         |
| `pnpm run lint`       | ESLint                    |
| `pnpm run test:mvp`   | 构建 + 静态检查 + Electron 原生冒烟 |
| `pnpm run dist:mac`   | 打包 macOS 安装包              |
| `pnpm run dist:win`   | 打包 Windows 安装包            |
| `pnpm run dist:linux` | 打包 Linux 安装包              |


打包前会自动执行 `compilers:stage` 将 `chmcmd` 打入安装包。CI 与发版流程见 [docs/ci.md](docs/ci.md)。

发版：更新 `package.json` 中的 `version`，推送同名标签（如 `v0.1.0`）触发 Release 构建。

---

## 文档


| 文档                                                                   | 说明                   |
| -------------------------------------------------------------------- | -------------------- |
| [docs/prd.md](docs/prd.md)                                           | 产品需求（PRD）            |
| [docs/feature.md](docs/feature.md)                                   | 功能规划                 |
| [docs/mvp.md](docs/mvp.md)                                           | MVP 任务清单             |
| [docs/mac-install.md](docs/mac-install.md)                           | macOS 安装与 Gatekeeper 放行 |
| [docs/compiler-setup.md](docs/compiler-setup.md)                     | CHM 编译器安装与许可         |
| [docs/ci.md](docs/ci.md)                                             | GitHub Actions 打包与发版 |
| [docs/mvp-acceptance-checklist.md](docs/mvp-acceptance-checklist.md) | MVP 验收清单             |
| [public/NOTICES.md](public/NOTICES.md)                               | 第三方组件许可              |


---

## 贡献

欢迎通过 [Issue](https://github.com/tagecode/chm-assistant/issues) 反馈问题或讨论功能，通过 Pull Request 提交改进。

1. Fork 本仓库，从 `main` 创建分支
2. 本地运行 `pnpm run lint` 与 `pnpm run test:mvp`
3. 提交 PR 并说明变更内容与测试情况

较大改动请先开 Issue 对齐范围。

---

## 许可


| 组件                                          | 许可                                         |
| ------------------------------------------- | ------------------------------------------ |
| 本仓库应用代码                                     | [MIT](LICENSE) · Copyright © 2026 TageCode |
| [CHMLib](https://github.com/jedwing/CHMLib) | LGPL-2.1                                   |
| 安装包内置 `chmcmd`                              | GPL-2                                      |


完整第三方许可说明见 [public/NOTICES.md](public/NOTICES.md)。