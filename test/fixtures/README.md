# MVP 验收样例文件

本目录供 `pnpm run test:mvp` 与 [docs/mvp-acceptance-checklist.md](../../docs/mvp-acceptance-checklist.md) 使用。

## 目录

| 路径 | 说明 |
|------|------|
| `corrupt/invalid.chm` | 内置损坏样例（扩展名为 .chm 但内容非法），用于 7.4 自动化 |
| `gbk/sample.chm` | **可选**：GBK 编码 CHM，放入后无需设置环境变量 |

## GBK 样例（7.1）

**已内置** `gbk/sample.chm`（用产品编译链生成的 GBK 工程，含多级 `.hhc` 目录与可搜索中文），`test:mvp` 自动覆盖打开、目录、正文、全文搜索。

重新生成（例如调整样例内容后）：

```bash
pnpm run fixture:gbk   # 需已 build；本机有 chmcmd（ACP 936/950）或 hhc.exe
```

样例的页面结构、生成路径与验证方法见 [docs/gbk-fixture.md](../../docs/gbk-fixture.md)。

或使用自有样例：复制为 `test/fixtures/gbk/sample.chm`，或设置环境变量 `CHM_ASSISTANT_GBK_SAMPLE=/path/to/your-gbk.chm`。

建议样例含：多级 `.hhc` 目录、正文中文、可被「的」或专有名词命中的页面。

可选：

```bash
export CHM_ASSISTANT_GBK_SEARCH_QUERY=帮助
export CHM_ASSISTANT_GBK_PAGE_QUERY=安装
```

## 超大 CHM（7.4）

```bash
export CHM_ASSISTANT_LARGE_SAMPLE=/path/to/large.chm
```

人工验收时关注：打开耗时、界面是否仍可操作、关闭标签是否生效。

## 许可

请勿将受版权保护的 CHM 提交到仓库；大文件与 GBK 样例应保留在本地或 CI 密钥卷中。
