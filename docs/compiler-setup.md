# CHM 编译器依赖说明

CHM Assistant 创作模块在「编译 CHM」时需要调用**外部编译器**，将生成的 `.hhp` 工程编译为 `.chm` 文件。阅读 CHM **不需要**编译器。

## 策略总览（与产品实现一致）

| 平台 | 默认编译器 | 安装包是否内置 | 用户侧要求 |
|------|------------|----------------|------------|
| **Windows** | **chmcmd**（Free Pascal） | **是**（发布前执行 `pnpm run compilers:stage`） | 一般无需安装；可选 HTML Help Workshop（`hhc.exe`）或自定义路径 |
| **macOS** | **chmcmd** | **同上** | 一般无需安装 |
| **Linux** | **chmcmd** | **同上** | 一般无需安装 |

解析顺序（所有平台，路径留空时）：

1. **设置 → 自定义编译器路径**（若填写且文件存在）
2. **内置 chmcmd**（`resources/compilers/<platform>-<arch>/chmcmd[.exe]`）
3. **系统 chmcmd**（PATH 或常见安装路径）
4. **Windows 额外**：系统 `hhc.exe`（HTML Help Workshop 常见路径）

---

## 内置 chmcmd（全平台）

### 许可说明

`chmcmd` 来自 [Free Pascal](https://www.freepascal.org/) 生态，为 **GPL-2**。本应用以**独立进程**调用内置或系统 `chmcmd`，并在 `public/NOTICES.md` 中提供许可与源码说明。

**不包含**微软 `hhc.exe`（HTML Help EULA 不允许再分发编译器）。

### 最终用户（使用官方安装包）

若安装包已内置 `chmcmd`，**无需额外安装**。设置页应显示「使用应用内置 chmcmd」。

### 从源码构建 / 开发机准备 chmcmd

**Windows（Free Pascal 安装包）**

1. 从 [Free Pascal 下载页](https://www.freepascal.org/download.html) 安装，或使用 `choco install freepascal`
2. 确认存在 `chmcmd.exe`（常见路径：`C:\FPC\3.2.2\bin\i386-win32\chmcmd.exe`）
3. 32 位 `chmcmd.exe` 可在 64 位 Windows 上通过 WOW64 运行

**macOS（Homebrew 示例）**

```bash
brew install free-pascal
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
# Windows:
dir resources\compilers\win32-x64\chmcmd.exe
# macOS / Linux:
ls -la resources/compilers/$(node -p "process.platform + '-' + process.arch")/chmcmd
pnpm run dist:win   # 或 dist:mac / dist:linux
```

---

## Windows 可选：HTML Help Workshop（hhc.exe）

当未内置、未找到系统 `chmcmd` 时，应用会回退到已安装的 **HTML Help Workshop** `hhc.exe`。

### 许可说明

根据 [HTML Help 最终用户许可协议](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/htmlhelp/html-help-end-user-license-agreement)：

- 可再分发的是 **`hhupd.exe`**（帮助**查看**运行时），不是 `hhc.exe` 编译器。
- HTML Help Workshop 授权用于在**开发机**上设计、开发、测试帮助系统。

因此 **CHM Assistant 安装包不包含 `hhc.exe`**。需要 `hhc` 时，用户须自行安装；应用在未检测到任何编译器时可引导下载 Workshop 安装包（Internet Archive 镜像）。

### 安装步骤

1. 下载 HTML Help Workshop 安装包（`htmlhelp.exe`，任选其一）：
   - [Internet Archive 镜像](https://web.archive.org/web/20160201063255/http://download.microsoft.com/download/0/A/9/0A939EF6-E31C-430F-A3DF-DFAE7960D564/htmlhelp.exe)
   - [备用：SHFB 仓库镜像](https://github.com/EWSoftware/SHFB/raw/master/ThirdPartyTools/htmlhelp.exe)
2. 运行安装程序，安装 **HTML Help Workshop**（含 `hhc.exe`）
3. 默认路径示例：`C:\Program Files (x86)\HTML Help Workshop\hhc.exe`
4. 在 **设置 → CHM 编译器** 中确认状态，或手动浏览选择 `hhc.exe`

### 常见问题

- **HHC6003 / HHC5003 / 注册错误**：在**管理员**命令提示符中执行：
  ```bat
  regsvr32 "C:\Program Files (x86)\HTML Help Workshop\itcc.dll"
  ```
  若仍失败，请重新安装 Workshop，或在设置中指定 **chmcmd.exe**（Free Pascal）。
- **弹窗提示找不到 `项目根目录\toc.hhc`**：旧版构建脚本的路径问题；更新应用后 `.hhp` 会使用 `.chm-build/toc.hhc`。
- **32 位**：`hhc` 与 FPC 的 `chmcmd.exe` 多为 32 位，在 64 位 Windows 上通常仍可正常使用。

---

## 设置项说明

路径：**设置 → CHM 编译器**

- **自动检测**（路径留空）：按上表顺序查找。
- **自定义路径**：指向 `chmcmd` / `chmcmd.exe` 或 `hhc.exe`。
- **打开安装说明**（Windows）：在未检测到任何编译器时，可选下载 HTML Help Workshop 作为 `hhc` 备选。

---

## 与 PRD / MVP 的对应

- PRD §4、`CR-06`：编译链调用平台编译器；各平台默认 **chmcmd**，Windows 可回退 **hhc.exe**。
- PRD §12.1：须在文档中说明外部依赖与许可 — 本文档与 `NOTICES.md` 即为其落地。
- `docs/mvp.md` §6.7：外部编译器失败时需人类可读错误 — 应用内通过设置状态与编译前检测实现。

---

## 相关文件（实现参考）

| 文件 | 作用 |
|------|------|
| `electron/compiler-resolve.ts` | 编译器路径解析与状态 |
| `electron/chm-build/compiler.ts` | 调用 `spawn` 执行编译器 |
| `resources/compilers/` | 内置 chmcmd 存放目录 |
| `scripts/stage-compilers.mjs` | 发布前复制本机 chmcmd |
| `scripts/ci-install-chmcmd.ps1` | Windows CI 安装 Free Pascal |
