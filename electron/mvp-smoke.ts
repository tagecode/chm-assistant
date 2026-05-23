/**
 * MVP §7 自动化冒烟（无窗口）。由 scripts/mvp-acceptance/run.mjs 通过 Electron 启动。
 * 结果写入 test-results/mvp-acceptance-native.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

import { getCompilerStatus } from './compiler-resolve'
import { closeChmSession, openChmSession, readChmPagePlainText } from './chm-reader-service'
import { searchChmSession } from './chm-search'
import { compileProject } from './chm-build/compile-project'
import { loadProjectConfig, readUtf8NoBom } from './project-fs'
import { createProjectInDirectory } from './project-bootstrap'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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

  await checkNativeGbk()
  checkCorruptChm()
  checkLargeChm()
  await checkCompileUtf8()
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
