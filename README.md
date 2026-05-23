# CHM Assistant

[![CI](https://github.com/tagecode/chm-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/tagecode/chm-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/tagecode/chm-assistant?label=release)](https://github.com/tagecode/chm-assistant/releases)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

一款跨平台桌面应用：打开与阅读 CHM、用 Markdown 管理创作项目、一键编译并在内置阅读器中预览成品。

[English summary](#english) · [功能](#功能) · [下载](#下载) · [从源码构建](#从源码构建) · [文档](#文档) · [参与贡献](#参与贡献) · [许可](#许可)

---

## 预览

![CHM Assistant 主界面](docs/images/chm-assistant-01-home.png)

---

## 功能

| 模块 | 能力 |
|------|------|
| **阅读器** | 目录 / 索引、前进后退、全文搜索、中文编码（GBK / UTF-8 等）、多主题 |
| **创作器** | Monaco 编辑、项目树、资源导入、Markdown 实时预览、编译日志行号跳转 |
| **编译 CHM** | 生成 `.hhp` / `.hhc` / `.hhk` 并调用平台编译器产出 `.chm` |

技术栈：[Electron](https://www.electronjs.org/) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

CHM 解析基于 [CHMLib](https://github.com/jedwing/CHMLib)（LGPL-2.1），通过 Node 原生模块封装。

---

## 下载

在 [GitHub Releases](https://github.com/tagecode/chm-assistant/releases) 获取各平台安装包（由 CI 在推送 `v*` 标签时自动构建）：

| 平台 | 格式 |
|------|------|
| macOS (Intel / Apple Silicon) | `.dmg`、`.zip` |
| Windows (x64) | NSIS 安装包 |
| Linux (x64 / arm64) | AppImage、`.deb` |

> **编译 CHM 的额外依赖**见下文 [CHM 编译器](#chm-编译器)。仅阅读 CHM 无需安装编译器。

---

## 从源码构建

### 环境要求

- [Node.js](https://nodejs.org/) **24**（与 CI 一致）
- [pnpm](https://pnpm.io/) **9**
- 平台原生构建工具（用于编译 `chm_addon` Node 模块）：
  - **macOS**：Xcode Command Line Tools
  - **Windows**：Visual Studio Build Tools（C++ 工作负载）
  - **Linux**：`build-essential` 等（参见 `scripts/ci-install-linux-build-deps.sh`）

### 开发

```bash
git clone https://github.com/tagecode/chm-assistant.git
cd chm-assistant
pnpm install
pnpm run native:rebuild   # 首次克隆或 native 代码变更后
pnpm run dev
```

常用命令：

```bash
pnpm run build          # 类型检查 + 前端 / 主进程构建
pnpm run lint
pnpm run test:mvp       # 构建 + 静态检查 + Electron 原生冒烟
```

人工 UI 验收步骤见 [docs/mvp-acceptance-checklist.md](docs/mvp-acceptance-checklist.md)。GBK 样例 CHM 可放在 `test/fixtures/gbk/sample.chm`，或设置环境变量 `CHM_ASSISTANT_GBK_SAMPLE`。

### 本地打包

```bash
pnpm run dist:mac      # macOS
pnpm run dist:win      # Windows（含 compilers:stage 内置 chmcmd）
pnpm run dist:linux    # Linux（含 compilers:stage）
```

各平台打包前会执行 `pnpm run compilers:stage` 以内置 **chmcmd**。跨平台 CI 与发版流程见 [docs/ci.md](docs/ci.md)。

发版前请更新 `package.json` 中的 `version` 并推送同名标签（例如 `v0.1.0`）。

---

## CHM 编译器

创作模块「编译 CHM」需要外部编译器；**阅读 CHM 不需要**。

| 平台 | 编译器 | 安装包是否内置 |
|------|--------|----------------|
| **Windows** | **chmcmd**（Free Pascal，GPL-2）；可选回退 **hhc.exe** | 是（`pnpm run compilers:stage` 后打入发布包） |
| **macOS / Linux** | **chmcmd** | 同上 |

完整说明（许可、路径解析、维护者流程）：[docs/compiler-setup.md](docs/compiler-setup.md)

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/prd.md](docs/prd.md) | 产品需求（PRD） |
| [docs/mvp.md](docs/mvp.md) | MVP 任务清单 |
| [docs/ci.md](docs/ci.md) | GitHub Actions 打包与发版 |
| [docs/compiler-setup.md](docs/compiler-setup.md) | 编译器安装与打包 |
| [docs/mvp-acceptance-checklist.md](docs/mvp-acceptance-checklist.md) | MVP 人工验收清单 |
| [public/NOTICES.md](public/NOTICES.md) | 第三方组件许可（应用内「关于」亦会展示） |

---

## 参与贡献

欢迎通过 [Issue](https://github.com/tagecode/chm-assistant/issues) 反馈问题或讨论功能，通过 Pull Request 提交改进。

建议流程：

1. Fork 本仓库并从 `main` 创建分支
2. 本地运行 `pnpm run lint` 与 `pnpm run test:mvp`
3. 提交 PR 并简要说明变更与测试情况

较大改动请先开 Issue 对齐范围，避免重复劳动。

---

## 许可

- 本仓库应用代码：[MIT License](LICENSE) · Copyright © 2026 TageCode
- [CHMLib](https://github.com/jedwing/CHMLib)：**LGPL-2.1**
- 若安装包内含 **chmcmd**：**GPL-2**（详见 [public/NOTICES.md](public/NOTICES.md)）

---

## English

**CHM Assistant** is a cross-platform desktop app for reading CHM files, authoring help projects from Markdown, and compiling preview builds in a built-in reader.

- **Stack**: Electron, React, TypeScript, Vite, Tailwind CSS, shadcn/ui; CHM parsing via CHMLib (LGPL-2.1).
- **Install**: [Releases](https://github.com/tagecode/chm-assistant/releases) · **Build**: `pnpm install && pnpm run native:rebuild && pnpm run dev`
- **License**: MIT for application code; see [NOTICES](public/NOTICES.md) for bundled third-party licenses.

---

<p align="center">
  <sub>如有问题或建议，欢迎 <a href="https://github.com/tagecode/chm-assistant/issues">提交 Issue</a>。</sub>
</p>
