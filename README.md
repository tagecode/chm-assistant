# CHM Assistant

跨平台桌面应用：打开与阅读 CHM、Markdown 创作项目、一键编译并在内置阅读器中预览成品。

技术栈：Electron、React、TypeScript、Vite、Tailwind CSS、shadcn/ui；CHM 解析基于 [CHMLib](https://github.com/jedwing/CHMLib)（LGPL-2.1）。

## 功能概览

- **阅读器**：目录/索引、前进后退、全文搜索、中文编码（GBK/UTF-8 等）、多主题
- **创作器**：Monaco 编辑、项目树、资源导入、Markdown 实时预览、编译日志行号跳转
- **编译 CHM**：生成 `.hhp/.hhc/.hhk` 并调用平台编译器

## 开发

```bash
pnpm install
pnpm run native:rebuild   # 首次或 native 变更后
pnpm run dev
```

```bash
pnpm run build          # 类型检查 + 前端/主进程构建
pnpm run lint
```

## MVP 验收（§7）

```bash
pnpm run test:mvp          # 构建 + 静态检查 + Electron 原生冒烟
pnpm run test:mvp:static   # 仅静态（需已 build）
```

人工 UI 步骤见 [docs/mvp-acceptance-checklist.md](docs/mvp-acceptance-checklist.md)。GBK 样例 CHM 可放在 `test/fixtures/gbk/sample.chm` 或设置环境变量 `CHM_ASSISTANT_GBK_SAMPLE`。

## CHM 编译器（重要）

| 平台 | 策略 |
|------|------|
| **Windows** | 不捆绑 `hhc.exe`；需用户安装 [HTML Help Workshop](https://www.microsoft.com/en-us/download/details.aspx?id=21138)，应用内检测常见路径并可在设置中指定 |
| **macOS / Linux** | 发布包可内置 **chmcmd**（Free Pascal，GPL-2）；开发/打包前执行 `pnpm run compilers:stage` |

完整说明（许可、路径解析顺序、维护者流程）：**[docs/compiler-setup.md](docs/compiler-setup.md)**

## 发布

```bash
pnpm run dist:mac   # 或 dist:win / dist:linux（含 native:rebuild；Unix 含 compilers:stage）
```

**GitHub Actions** 跨平台打包（macOS x64/arm64、Linux x64/arm64、Windows x64）见 **[docs/ci.md](docs/ci.md)**。发版前请 bump `package.json` 的 `version` 并打同名 tag（如 `v0.1.0`）。

```bash
# 本地完整流程（与 CI 一致）
pnpm run dist:mac
```

## 文档

- [产品需求（PRD）](docs/prd.md)
- [MVP 任务清单](docs/mvp.md)
- [CI / GitHub Actions 打包](docs/ci.md)
- [编译器安装与打包](docs/compiler-setup.md)
- 第三方许可：应用内「关于」及 [public/NOTICES.md](public/NOTICES.md)

## 许可

应用代码以项目仓库许可为准。CHMLib 为 LGPL-2.1；若安装包内含 **chmcmd**，其遵循 **GPL-2**，详见 NOTICES。
