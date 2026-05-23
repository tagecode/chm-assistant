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
- **弹窗提示找不到 `项目根目录\toc.hhc`**：旧版构建脚本的路径问题；更新应用后会按编译器拆分路径策略：`chmcmd` 使用 `.chm-build`，`hhc.exe` 使用不以点开头的 `chm-build-hhc`（HTML Help Compiler 对 `.chm-build` 这类点目录兼容性很差）。
- **32 位**：`hhc` 与 FPC 的 `chmcmd.exe` 多为 32 位，在 64 位 Windows 上通常仍可正常使用。
- **中文路径 / 文件名**：`chmcmd`（以及部分环境下的 `hhc.exe`）在打开 `.hhp` 所列文件时，对 **非 ASCII 路径**（如 `docs/指南/说明.md`）支持很差，常表现为「无法打开文件」或编译失败。应用会在编译时把 `.chm-build` 内的 HTML 与资源复制为 **ASCII 安全文件名**（按哈希重命名），**项目 `docs/` 下仍可使用中文文件夹与文件名**；侧栏标题与 CHM 内显示名不受影响。
- **Windows 自带查看器目录/索引乱码**：HTML Help 1.x 的目录（`.hhc`）与索引（`.hhk`）在 `hh.exe` 中仍按 **传统 ANSI 代码页**（简体中文多为 **936**）解释，而默认编译链产出 **UTF-8** 中间文件（`Charset=65001`，适配 **chmcmd** 与本应用阅读器）。因此在「系统已开启 UTF-8 Beta（ACP 65001）」的现代 Windows 上，**无法靠「检测系统代码页 → 统一改成 GBK」** 同时保证本应用与 `hh.exe` 均正常——强行改 GBK 会导致 chmcmd 与 UTF-8 正文/HTML 不一致，产物损坏。可选方向见下文「编码策略评估」。

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

## 编码策略评估（本应用 vs Windows hh.exe）

### 为何不能「按项目语言一律 GBK」

| 环节 | 期望编码 | 说明 |
|------|----------|------|
| **chmcmd**（FPC） | 与 **系统 ACP** 一致 | 在 Win10「UTF-8 Beta」开启时 ACP=**65001**，按 UTF-8 读 `.hhp/.hhc/.hhk`；若磁盘是 GBK 而正文 HTML 是 UTF-8，易产出 **损坏的 CHM** |
| **本应用阅读器** | UTF-8 或 GBK 均可解码 | 有启发式解码链；UTF-8 产物已验证 |
| **Windows hh.exe 目录/索引** | 简体中文多为 **936 (GBK)** | 与 UTF-8 中间文件不兼容；**正文 HTML** 仍可因 `<meta charset=UTF-8>` 正常显示 |

因此：**检测系统代码页后统一改成 GBK** 在 ACP=65001 的机器上会破坏 chmcmd 编译；在 ACP=936 上若只改目录文件、正文仍 UTF-8，同样可能不一致。

### 检测系统代码页是否有用？

**有用，但只能作决策输入，不能单独决定编码。**

Windows 上可通过 `[System.Text.Encoding]::Default.CodePage`（即 GetACP）读取：

- **936**：传统简体中文 Windows
- **950**：繁体
- **65001**：已启用「Beta: 使用 Unicode UTF-8 提供全球语言支持」

注意：

- `chcp` 反映的是 **控制台** OEM 页，可能被 `chcp 65001` 临时改掉，**不应**用作编译依据。
- 代码页只描述 **本机**；分发给其他 Windows 用户的 CHM 仍可能在其机器上表现不同。

### 推荐产品策略（CR-08）

1. **默认**：UTF-8 中间文件 + `Charset=65001`（chmcmd）→ **本应用优先**，`hh.exe` 侧栏中文可能乱码。
2. **项目元数据 →「兼容 Windows 帮助查看器」**（已实现）：整包 **GBK/Big5**（HTML + `.hhc/.hhk` 以 GBK/Big5 字节写入）。**chmcmd** 时在 `.hhp` 写 `Charset=936/950`，并使用 `.chm-build`；**hhc.exe** 不识别 `Charset=`，改用 `Language=` + `Default Font=`，并使用 `chm-build-hhc` 普通目录，避免 HTML Help Compiler 在点目录下把所有输入文件判为未编译。编译日志在 ACP=65001 时会提示改用 **hhc.exe**。
3. **自动策略（未做）**：编译器 × 系统 ACP × 用户目标 三维判断。

实现：`electron/chm-build/compile-encoding.ts`（`resolveCompileEncodingProfile`、`writeCompileTextFile`）；选项字段 `compile.windowsViewerCompat`。

---

## 相关文件（实现参考）

| 文件 | 作用 |
|------|------|
| `electron/compiler-resolve.ts` | 编译器路径解析与状态 |
| `electron/chm-build/compiler.ts` | 调用 `spawn` 执行编译器 |
| `resources/compilers/` | 内置 chmcmd 存放目录 |
| `scripts/stage-compilers.mjs` | 发布前复制本机 chmcmd |
| `scripts/ci-install-chmcmd.ps1` | Windows CI 安装 Free Pascal |
