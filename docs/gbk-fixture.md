# GBK 验收样例备忘

对应 [mvp.md](./mvp.md) §7.1 / RD-08b。记录了 `test/fixtures/gbk/sample.chm` 的来源、生成路径与复现方法，供后续维护与回归参考。

## 样例是什么

- **文件**：`test/fixtures/gbk/sample.chm`（约 12KB，已入库）
- **用途**：解锁 `test:mvp` 的 7.1 自动用例——GBK 样例 CHM 的打开、目录、正文解码、全文搜索（RD-08b 中文命中）。
- **内容**：简体中文（`language: zh-Hans`）GBK 工程，含多级 `.hhc` 目录与可搜索中文正文。

## 样例结构（5 个页面，3 个顶级目录节点）

| 目录节点 | 子页（.md → .html） | 说明 |
|----------|---------------------|------|
| 第一章 入门 | 首页与安装 `docs/index.md` · 快速开始 `docs/quickstart.md` | 默认页 `index.html` |
| 第二章 使用帮助 | 搜索与查找 `docs/search.md` · 编码与中文显示 `docs/encoding.md` | |
| 常见问题 | `docs/faq.md` | 含多处「的帮助」，命中默认搜索词「的」 |

## 生成路径

样例不是手工编的二进制，而是**用产品自己的编译链**（`compileProject`）构造 GBK 工程后编译，与用户实际创作链路一致：

```text
electron/mvp-smoke.ts  generateGbkFixture()          ← 环境变量 CHM_ASSISTANT_GENERATE_GBK_FIXTURE=1 时进入
  └─ compileProject(工程目录, config, …)              ← 产品编译链（chm-build/compile-project.ts）
       └─ resolveCompileEncodingProfile('zh-Hans', windowsViewerCompat=true)
            → 中间文件编码 gb18030 · HHP Charset 936 · HTML <meta charset="GB2312">
       └─ chmcmd 编译（Win ACP 936/950）或 hhc.exe
  └─ 产物复制为 test/fixtures/gbk/sample.chm
```

要点：

- **源 Markdown 是 UTF-8 无 BOM**（CR-01 默认策略）；GBK 由编译链的「兼容 Windows 帮助查看器」选项（`compile.windowsViewerCompat: true`）在中间文件层实现——HTML、`.hhc`、`.hhk` 整包按 GBK/Big5 字节写入。详见 [compiler-setup.md](./compiler-setup.md)「编码策略评估」。
- **平台约束**：生成动作依赖本机编译器。Windows 需 ACP 936/950（或改用 `hhc.exe`），见 `validateLegacyEncodingCompile`（`electron/chm-build/compile-encoding.ts`）。**读取**则无此约束——解码链跨平台，CI（Linux）已验证。

## 复现（重新生成）

```bash
pnpm run fixture:gbk   # 等价于: node scripts/mvp-acceptance/run.mjs -- --no-build --fixture-gbk
```

流程：`run.mjs` 设 `CHM_ASSISTANT_GENERATE_GBK_FIXTURE=1` → vite 打包 `electron/mvp-smoke.ts` → Electron 冒烟进程执行 `generateGbkFixture()` → 编译并复制为 `test/fixtures/gbk/sample.chm`。需已 build（`dist-electron/` 存在）且本机有 `chmcmd`（ACP 936/950）或 `hhc.exe`。

想调整样例内容时，编辑 `generateGbkFixture()` 内的 `toc`/`md` 常量后重跑即可。

## 验证

```bash
pnpm run test:mvp
```

样例入库后 7.1 自动用例应全部 PASS（本机 2026-08-13 实测：`7.1.gbk.open` / `.toc` / `.body` / `.search` ✓，全量 18 通过 / 0 失败 / 1 跳过；Linux CI 17 通过 / 0 失败 / 2 跳过，差异为 `7.5.packaged` 无 `release/` 产物）。报告见 `test-results/mvp-acceptance-report.md`。

## 备选

不想用内置样例时，可覆盖：复制自有 GBK CHM 为 `test/fixtures/gbk/sample.chm`，或设置环境变量 `CHM_ASSISTANT_GBK_SAMPLE=/path/to/your-gbk.chm`。详见 [test/fixtures/README.md](../test/fixtures/README.md)。
