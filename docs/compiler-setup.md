# CHM 编译器依赖说明

CHM Assistant 创作模块在「编译 CHM」时需要调用**外部编译器**，将生成的 `.hhp` 工程编译为 `.chm` 文件。阅读 CHM **不需要**编译器。

## 策略总览（与产品实现一致）

| 平台 | 编译器 | 安装包是否内置 | 用户侧要求 |
|------|--------|----------------|------------|
| **Windows** | `hhc.exe`（HTML Help Workshop） | **否** | 需自行安装 Workshop；可在设置中指定 `hhc.exe` 路径 |
| **macOS** | `chmcmd`（Free Pascal） | **是**（若发布前已执行 `pnpm run compilers:stage`） | 一般无需安装；可选手动指定路径或系统 PATH |
| **Linux** | `chmcmd` | **同上** | 同上 |

解析顺序（所有平台）：

1. **设置 → 自定义编译器路径**（若填写且文件存在）
2. **内置 chmcmd**（仅 macOS/Linux 安装包内 `resources/compilers/<platform>-<arch>/chmcmd`）
3. **系统**：Windows 常见 Workshop 安装路径；Unix 的 `chmcmd` / Homebrew 路径

---

## Windows：HTML Help Workshop

### 许可说明

根据 [HTML Help 最终用户许可协议](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/htmlhelp/html-help-end-user-license-agreement)：

- 可再分发的是 **`hhupd.exe`**（帮助**查看**运行时），不是 `hhc.exe` 编译器。
- HTML Help Workshop 授权用于在**开发机**上设计、开发、测试帮助系统。

因此 **CHM Assistant 安装包不包含 `hhc.exe`**。首次编译失败时，应用会引导打开微软官方下载页。

### 安装步骤

1. 打开 [Microsoft HTML Help Downloads](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/htmlhelp/microsoft-html-help-downloads)
2. 安装 **HTML Help Workshop**（含 `hhc.exe`）
3. 默认路径示例：`C:\Program Files (x86)\HTML Help Workshop\hhc.exe`
4. 在 CHM Assistant **设置 → CHM 编译器** 中确认状态为「已检测到」，或手动浏览选择 `hhc.exe`

### 常见问题

- **HHC6003 / 注册错误**：在管理员命令行执行 Workshop 目录下的 `regsvr32 itcc.dll`（参见 Workshop 文档）。
- **32 位**：`hhc` 多为 32 位，在 64 位 Windows 上通常仍可正常使用。

---

## macOS / Linux：chmcmd

### 许可说明

`chmcmd` 来自 [Free Pascal](https://www.freepascal.org/) 生态，一般为 **GPL-2**。本应用在 Unix 平台以**独立进程**调用内置或系统 `chmcmd`，并在 `public/NOTICES.md` 中提供许可与源码说明。

### 最终用户（使用官方安装包）

若安装包已内置 `chmcmd`，**无需额外安装**。设置页应显示类似「使用应用内置 chmcmd」。

### 从源码构建 / 开发机准备 chmcmd

**macOS（Homebrew 示例）**

```bash
brew install free-pascal
# 或 MacPorts: sudo port install chmcmd-fpc
which chmcmd
```

**Ubuntu / Debian 示例**

```bash
sudo apt update
sudo apt install fp-compiler fp-utils-3.2.2
which chmcmd
```

**打入安装包（维护者）**

```bash
pnpm run compilers:stage
ls -la resources/compilers/$(node -p "process.platform + '-' + process.arch")/chmcmd
pnpm run dist:mac   # 或 dist:linux
```

---

## 设置项说明

路径：**设置 → CHM 编译器**

- **自动检测**（路径留空）：按上表顺序查找。
- **自定义路径**：指向 `hhc.exe` 或 `chmcmd` 可执行文件。
- **打开安装说明**：仅 Windows 在未检测到编译器时可用，打开微软 HTML Help 下载页。

---

## 与 PRD / MVP 的对应

- PRD §4、`CR-06`：编译链调用平台编译器；Windows 为 `hhc.exe`，Unix 为 `chmcmd`。
- PRD §12.1：须在文档中说明外部依赖与许可 — 本文档与 `NOTICES.md` 即为其落地。
- `docs/mvp.md` §6.7：外部编译器失败时需人类可读错误 — 应用内通过设置状态与编译前检测实现。

---

## 相关文件（实现参考）

| 文件 | 作用 |
|------|------|
| `electron/compiler-resolve.ts` | 编译器路径解析与状态 |
| `electron/chm-build/compiler.ts` | 调用 `spawn` 执行编译器 |
| `resources/compilers/` | Unix 内置 chmcmd 存放目录 |
| `scripts/stage-compilers.mjs` | 发布前复制本机 chmcmd |
