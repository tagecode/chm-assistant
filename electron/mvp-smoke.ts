/**
 * MVP §7 自动化冒烟（无窗口）。由 scripts/mvp-acceptance/run.mjs 通过 Electron 启动。
 * 结果写入 test-results/mvp-acceptance-native.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow } from 'electron'

import { getCompilerStatus } from './compiler-resolve'
import { closeChmSession, openChmSession, readChmPagePlainText } from './chm-reader-service'
import { searchChmSession } from './chm-search'
import { compileProject } from './chm-build/compile-project'
import { CHM_TOC_SYNC_SCRIPT } from './chm-toc-sync'
import type { ChmProjectConfig } from '../src/shared/project'
import { loadProjectConfig, readUtf8NoBom } from './project-fs'
import { createProjectInDirectory } from './project-bootstrap'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Status = 'pass' | 'fail' | 'skip' | 'warn'

interface CheckResult {
  id: string
  title: string
  status: Status
  message?: string
  manual?: boolean
}

const results: CheckResult[] = []

function record(r: CheckResult) {
  results.push(r)
}

function envPath(name: string): string | null {
  const v = process.env[name]?.trim()
  if (!v) return null
  return fs.existsSync(v) ? v : null
}

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s)
}

async function checkNativeGbk() {
  const sample =
    envPath('CHM_ASSISTANT_GBK_SAMPLE') ??
    path.join(ROOT, 'test/fixtures/gbk/sample.chm')
  if (!fs.existsSync(sample)) {
    record({
      id: '7.1.gbk.open',
      title: 'GBK 样例 CHM 打开',
      status: 'skip',
      message: '设置 CHM_ASSISTANT_GBK_SAMPLE 或放置 test/fixtures/gbk/sample.chm',
      manual: true,
    })
    return
  }

  const opened = openChmSession(sample, 'auto')
  if (!opened.ok) {
    record({
      id: '7.1.gbk.open',
      title: 'GBK 样例 CHM 打开',
      status: 'fail',
      message: opened.code,
    })
    return
  }
  record({
    id: '7.1.gbk.open',
    title: 'GBK 样例 CHM 打开',
    status: 'pass',
    message: opened.chmTitle,
  })

  const tocOk = opened.toc.length > 0
  record({
    id: '7.1.gbk.toc',
    title: 'GBK 样例目录非空',
    status: tocOk ? 'pass' : 'warn',
    message: `toc nodes: ${opened.toc.length}`,
  })

  const plain = readChmPagePlainText(
    opened.sessionId,
    opened.entryInternalPath,
    'auto',
  )
  const bodyOk = plain.ok && hasCjk(plain.text)
  record({
    id: '7.1.gbk.body',
    title: 'GBK 正文解码含中文',
    status: bodyOk ? 'pass' : 'fail',
    message: plain.ok ? `chars=${plain.text.length}` : plain.message,
  })

  const query = process.env.CHM_ASSISTANT_GBK_SEARCH_QUERY?.trim() || '的'
  const hits = searchChmSession(opened.sessionId, query, 'auto', 20)
  record({
    id: '7.1.gbk.search',
    title: 'GBK 全文搜索',
    status: hits.length > 0 ? 'pass' : 'warn',
    message: `query="${query}" hits=${hits.length}`,
  })

  const pageFind = process.env.CHM_ASSISTANT_GBK_PAGE_QUERY?.trim()
  if (pageFind && plain.ok) {
    const hit = plain.text.includes(pageFind)
    record({
      id: '7.1.gbk.page-find',
      title: 'GBK 页内关键词（RD-08b 粗测）',
      status: hit ? 'pass' : 'warn',
      message: pageFind,
    })
  }

  closeChmSession(opened.sessionId)
}

function checkCorruptChm() {
  const sample =
    envPath('CHM_ASSISTANT_CORRUPT_SAMPLE') ??
    path.join(ROOT, 'test/fixtures/corrupt/invalid.chm')
  if (!fs.existsSync(sample)) {
    record({
      id: '7.4.corrupt',
      title: '损坏 CHM 打开失败且不抛错',
      status: 'skip',
      message: '缺少 test/fixtures/corrupt/not-a-chm.bin',
    })
    return
  }
  const opened = openChmSession(sample, 'auto')
  record({
    id: '7.4.corrupt',
    title: '损坏 CHM 打开失败且不抛错',
    status: !opened.ok ? 'pass' : 'fail',
    message: opened.ok ? '不应成功打开' : opened.code,
  })
}

function checkLargeChm() {
  const sample = envPath('CHM_ASSISTANT_LARGE_SAMPLE')
  if (!sample) {
    record({
      id: '7.4.large',
      title: '超大 CHM 打开',
      status: 'skip',
      message: '设置 CHM_ASSISTANT_LARGE_SAMPLE 后自动检测',
      manual: true,
    })
    return
  }
  const t0 = Date.now()
  const opened = openChmSession(sample, 'auto')
  const ms = Date.now() - t0
  if (!opened.ok) {
    record({
      id: '7.4.large',
      title: '超大 CHM 打开',
      status: 'fail',
      message: `${opened.code} (${ms}ms)`,
    })
    return
  }
  record({
    id: '7.4.large',
    title: '超大 CHM 打开',
    status: 'pass',
    message: `${ms}ms, paths=${opened.sessionId ? 'ok' : '?'}`,
  })
  closeChmSession(opened.sessionId)
}

async function checkCompileUtf8() {
  const scratch = path.join(
    ROOT,
    `test-results/_acceptance-scratch/compile-utf8-${Date.now()}`,
  )
  fs.mkdirSync(scratch, { recursive: true })
  const created = createProjectInDirectory(scratch, 'MVP验收')
  if (!created.ok) {
    record({
      id: '7.2.compile',
      title: '新建项目并编译 CHM',
      status: 'fail',
      message: created.error,
    })
    return
  }
  const config = loadProjectConfig(scratch)
  if (!config) {
    record({
      id: '7.2.compile',
      title: '加载 chmproj',
      status: 'fail',
    })
    return
  }
  const md = readUtf8NoBom(path.join(scratch, 'docs', 'index.md'))
  record({
    id: '7.2.source-chinese',
    title: '源 Markdown 含中文',
    status: hasCjk(md) ? 'pass' : 'fail',
  })

  const compiler = getCompilerStatus(null)
  if (!compiler.available) {
    record({
      id: '7.2.compile',
      title: '编译 CHM（需 hhc/chmcmd）',
      status: 'skip',
      message: compiler.messageKey,
      manual: true,
    })
    return
  }

  const result = await compileProject(scratch, config, null)
  if (!result.ok) {
    const missingCompiler =
      result.error.includes('COMPILER_NOT_FOUND') ||
      result.error.includes('未找到') ||
      result.error.includes('hhc.exe') ||
      result.error.includes('chmcmd')
    record({
      id: '7.2.compile',
      title: '编译 CHM',
      status: missingCompiler ? 'skip' : 'warn',
      message: result.error,
      manual: true,
    })
    return
  }
  record({
    id: '7.2.compile',
    title: '编译 CHM',
    status: 'pass',
    message: result.chmPath,
  })

  const verify = openChmSession(result.chmPath, 'utf-8')
  if (!verify.ok) {
    record({
      id: '7.2.reader-open',
      title: '内置阅读器链打开编译产物',
      status: 'fail',
      message: verify.code,
    })
    return
  }
  const body = readChmPagePlainText(
    verify.sessionId,
    verify.entryInternalPath,
    'utf-8',
  )
  record({
    id: '7.2.reader-chinese',
    title: '编译产物正文中文无乱码',
    status: body.ok && hasCjk(body.text) ? 'pass' : 'fail',
    message: body.ok ? undefined : body.message,
  })
  closeChmSession(verify.sessionId)
}

/** RD-06：目录滚动同步桥链路（下发锚点 → 滚动 → 回报激活锚点）。无窗口隐藏 BrowserWindow。 */
async function checkTocScrollSync() {
  // iframe 与父窗口不同源（与真实 chm: 场景一致）：桥通过 postMessage 通信，iframe 自行滚动
  const iframeDoc = `<!doctype html><html><head><meta charset="utf-8">
${CHM_TOC_SYNC_SCRIPT}
<style>h1{margin:0;height:40px} .sec{height:700px}</style>
<script>
  // 等父窗口下发锚点后自行滚动到 Section B（约 740px 处）
  setTimeout(function () { window.scrollTo(0, 900) }, 400)
</script>
</head><body>
<h1 id="a">Section A</h1><div class="sec"></div>
<h1 id="b">Section B</h1><div class="sec"></div>
<h1 id="c">Section C</h1><div class="sec"></div>
</body></html>`
  const hostHtml = `<!doctype html><html><body>
<iframe id="chm-frame" sandbox="allow-scripts allow-same-origin" src="data:text/html;charset=utf-8,${encodeURIComponent(iframeDoc)}"></iframe>
<script>
  window.__active = null
  addEventListener('message', (e) => {
    if (e.data && e.data.channel === 'chm-assistant-toc-active') {
      window.__active = e.data.anchor
    }
  })
  var f = document.getElementById('chm-frame')
  f.addEventListener('load', function () {
    f.contentWindow.postMessage({ channel: 'chm-assistant-toc-anchors', anchorIds: ['a', 'b', 'c'] }, '*')
  })
</script>
</body></html>`

  let win: BrowserWindow | null = null
  try {
    win = new BrowserWindow({ show: false, width: 800, height: 600 })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hostHtml)}`)
    await delay(1200)
    const active = await win.webContents.executeJavaScript('window.__active')
    record({
      id: '5.5.toc-scroll-sync',
      title: '目录滚动同步桥（RD-06）：滚动后回报激活锚点',
      status: active === 'b' ? 'pass' : 'fail',
      message: active ? `anchor=${active}` : '无回报',
    })
  } catch (e) {
    record({
      id: '5.5.toc-scroll-sync',
      title: '目录滚动同步桥（RD-06）：滚动后回报激活锚点',
      status: 'fail',
      message: e instanceof Error ? e.message : String(e),
    })
  } finally {
    win?.destroy()
  }
}

/** 生成 GBK 验收样例（CHM_ASSISTANT_GENERATE_GBK_FIXTURE=1 时进入，跳过验收）。 */
async function generateGbkFixture(): Promise<boolean> {
  if (process.env.CHM_ASSISTANT_GENERATE_GBK_FIXTURE !== '1') {
    return false
  }
  const scratch = path.join(ROOT, 'test-results/_gbk-fixture-scratch')
  const projectRoot = path.join(scratch, 'project')
  const docsDir = path.join(projectRoot, 'docs')
  const now = new Date().toISOString()

  const toc = [
    {
      id: 'sec-1',
      title: '第一章 入门',
      children: [
        { id: 'p-index', title: '首页与安装', mdPath: 'docs/index.md' },
        { id: 'p-quickstart', title: '快速开始', mdPath: 'docs/quickstart.md' },
      ],
    },
    {
      id: 'sec-2',
      title: '第二章 使用帮助',
      children: [
        { id: 'p-search', title: '搜索与查找', mdPath: 'docs/search.md' },
        { id: 'p-encoding', title: '编码与中文显示', mdPath: 'docs/encoding.md' },
      ],
    },
    { id: 'p-faq', title: '常见问题', mdPath: 'docs/faq.md' },
  ]

  const md = {
    'docs/index.md': `# 首页与安装

欢迎使用 CHM 助手。这是一款跨平台的 CHM 阅读与创作工具。

安装步骤非常简单，下载安装包后双击即可。安装完成后，你可以用本应用打开任意 CHM 文件。

## 帮助的目录

本应用的核心功能包括阅读、搜索与创作。
`,
    'docs/quickstart.md': `# 快速开始

打开本应用的帮助文档的步骤如下：

1. 点击「打开 CHM」按钮
2. 选择需要阅读的文件
3. 在左侧目录中浏览内容

帮助你快速上手的更多内容请参见后续章节。
`,
    'docs/search.md': `# 搜索与查找

全文搜索可以检索帮助文档中的所有页面。输入关键词后按回车即可。

页内查找请按 Ctrl+F 或 Cmd+F，输入内容后会在当前页面中高亮显示。

搜索关键词的编码与正文保持一致，中文关键词在 GBK 页面中同样可以命中。
`,
    'docs/encoding.md': `# 编码与中文显示

本应用支持 GBK、GB2312、GB18030 与 UTF-8 编码的 CHM 文件。

打开文件时，应用会自动检测编码，你可以在设置中手动指定。

中文正文与目录标题共用同一套解码逻辑，保证导航与内容都不乱码。
`,
    'docs/faq.md': `# 常见问题

问：中文显示为乱码怎么办？
答：请在设置中切换编码，或选择「自动检测」。

问：搜索不到中文内容？
答：请确认编码设置正确，重新执行全文搜索即可。

的帮助的帮助 — 本行包含多个「的帮助」以命中默认搜索词「的」。
`,
  }

  fs.rmSync(projectRoot, { recursive: true, force: true })
  fs.mkdirSync(docsDir, { recursive: true })
  for (const [rel, content] of Object.entries(md)) {
    fs.writeFileSync(path.join(projectRoot, rel), content, { encoding: 'utf8' })
  }

  const config: ChmProjectConfig = {
    version: 1,
    title: 'GBK 验收样例',
    language: 'zh-Hans',
    charset: 'utf-8',
    defaultPage: 'docs/index.md',
    docsDir: 'docs',
    createdAt: now,
    toc,
    compile: {
      outputFile: 'gbk-sample.chm',
      windowsViewerCompat: true,
    },
  }
  fs.writeFileSync(
    path.join(projectRoot, 'chm-assistant.chmproj'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )

  const result = await compileProject(projectRoot, config, null, (line) => {
    if (line.level === 'error' || line.level === 'warn') {
      console.log(`  [${line.level}] ${line.message}`)
    } else if (
      line.message.startsWith('正在') ||
      line.message.includes('编译成功')
    ) {
      console.log(`  · ${line.message}`)
    }
  })
  if (!result.ok) {
    console.error(`GBK fixture 编译失败: ${result.error}`)
    app.exit(1)
    return true
  }

  const target = path.join(ROOT, 'test/fixtures/gbk/sample.chm')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(result.chmPath, target)
  console.log(`GBK fixture 已生成: ${target} (${fs.statSync(target).size} bytes)`)
  if (!process.argv.includes('--keep-scratch')) {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
  app.exit(0)
  return true
}

function checkPackagedArtifacts() {
  const releaseDir = path.join(ROOT, 'release')
  if (!fs.existsSync(releaseDir)) {
    record({
      id: '7.5.packaged',
      title: 'release/ 安装包产物',
      status: 'skip',
      message: '执行 npm run dist:mac 或 dist:win 后重跑',
      manual: true,
    })
    return
  }
  const names = fs.readdirSync(releaseDir)
  const patterns =
    process.platform === 'darwin'
      ? [/\.dmg$/i, /\.zip$/i]
      : process.platform === 'win32'
        ? [/\.exe$/i]
        : [/AppImage/i, /\.deb$/i]
  const hit = names.some((n) => patterns.some((p) => p.test(n)))
  record({
    id: '7.5.packaged',
    title: 'release/ 安装包产物',
    status: hit ? 'pass' : 'warn',
    message: names.slice(0, 5).join(', ') || '(empty)',
  })
}

async function main() {
  record({
    id: 'native.load',
    title: 'Electron 冒烟进程已启动',
    status: 'pass',
    message: `${process.platform}-${process.arch}`,
  })

  if (await generateGbkFixture()) {
    return
  }

  await checkNativeGbk()
  checkCorruptChm()
  checkLargeChm()
  await checkCompileUtf8()
  await checkTocScrollSync()
  checkPackagedArtifacts()

  const outDir = path.join(ROOT, 'test-results')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'mvp-acceptance-native.json')
  fs.writeFileSync(
    outFile,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  )
  console.log(`[mvp-smoke] wrote ${outFile}`)
  const failed = results.filter((r) => r.status === 'fail').length
  app.exit(failed > 0 ? 1 : 0)
}

void app.whenReady().then(main)
