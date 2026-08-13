#!/usr/bin/env node
/**
 * MVP §7 验收脚本入口
 *
 * 用法:
 *   pnpm run test:mvp              # 静态检查 + Electron 原生冒烟（需先 build）
 *   pnpm run test:mvp -- --static-only
 *   pnpm run test:mvp -- --no-build
 *
 * 环境变量（可选）:
 *   CHM_ASSISTANT_GBK_SAMPLE       GBK 样例 .chm
 *   CHM_ASSISTANT_GBK_SEARCH_QUERY 全文搜索关键字（默认「的」）
 *   CHM_ASSISTANT_GBK_PAGE_QUERY    页内中文检索关键字（RD-08b）
 *   CHM_ASSISTANT_CORRUPT_SAMPLE    损坏样例
 *   CHM_ASSISTANT_LARGE_SAMPLE      超大样例
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runStaticChecks } from './checks/static.mjs'
import { colors, formatResult, summarize } from './lib/util.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')

const args = new Set(process.argv.slice(2))
const staticOnly = args.has('--static-only')
const noBuild = args.has('--no-build')
const fixtureGbk = args.has('--fixture-gbk')

function runBuild() {
  console.log(`${colors.dim}▶ npm run build${colors.reset}`)
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function runSmokeBundle() {
  console.log(`${colors.dim}▶ vite build mvp-smoke${colors.reset}`)
  const r = spawnSync(
    'npx',
    ['vite', 'build', '--config', 'scripts/mvp-acceptance/vite.smoke.config.ts'],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  )
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function runElectronSmoke() {
  const smokeJs = path.join(ROOT, 'dist-electron/mvp-smoke.js')
  const nativeResultJson = path.join(ROOT, 'test-results/mvp-acceptance-native.json')
  if (!fs.existsSync(smokeJs)) {
    console.error(`${colors.red}缺少 ${smokeJs}，请先完整运行 test:mvp${colors.reset}`)
    process.exit(1)
  }
  fs.rmSync(nativeResultJson, { force: true })
  const electronBin =
    process.platform === 'win32'
      ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
      : path.join(ROOT, 'node_modules', '.bin', 'electron')
  const bin = fs.existsSync(electronBin) ? electronBin : 'electron'
  const electronArgs = process.platform === 'linux' && process.env.CI ? ['--no-sandbox', smokeJs] : [smokeJs]
  const command = process.platform === 'linux' && process.env.CI ? 'xvfb-run' : bin
  const args = command === 'xvfb-run' ? ['-a', bin, ...electronArgs] : electronArgs
  console.log(`${colors.dim}▶ ${command} ${args.join(' ')}${colors.reset}`)
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  if (fixtureGbk) {
    env.CHM_ASSISTANT_GENERATE_GBK_FIXTURE = '1'
  }
  const r = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  })
  if (r.error) {
    console.error(`${colors.red}${r.error.message}${colors.reset}`)
  }
  return r.status ?? 1
}

function loadNativeResults() {
  const fp = path.join(ROOT, 'test-results/mvp-acceptance-native.json')
  if (!fs.existsSync(fp)) {
    return []
  }
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'))
    return Array.isArray(data.results) ? data.results : []
  } catch {
    return []
  }
}

function writeReport(staticResults, nativeResults) {
  const all = [...staticResults, ...nativeResults]
  const summary = summarize(all)
  const outDir = path.join(ROOT, 'test-results')
  fs.mkdirSync(outDir, { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    summary,
    results: all,
  }
  const jsonPath = path.join(outDir, 'mvp-acceptance-report.json')
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)

  const mdPath = path.join(outDir, 'mvp-acceptance-report.md')
  const lines = [
    '# MVP §7 验收报告',
    '',
    `生成时间: ${report.generatedAt}`,
    `平台: ${report.platform}`,
    '',
    `| 通过 | 失败 | 跳过 | 警告 | 人工项 |`,
    `|------|------|------|------|--------|`,
    `| ${summary.pass} | ${summary.fail} | ${summary.skip} | ${summary.warn} | ${summary.manual} |`,
    '',
    '## 明细',
    '',
  ]
  for (const r of all) {
    const mark = r.status.toUpperCase()
    const man = r.manual ? ' (人工)' : ''
    lines.push(`- **${mark}** \`${r.id}\`${man}: ${r.title}${r.message ? ` — ${r.message}` : ''}`)
  }
  lines.push('', '---', '人工 UI 清单见 [docs/mvp-acceptance-checklist.md](../docs/mvp-acceptance-checklist.md)', '')
  fs.writeFileSync(mdPath, lines.join('\n'))

  return { jsonPath, mdPath, summary, all }
}

function main() {
  console.log(`\n${colors.dim}CHM Assistant — MVP §7 验收${colors.reset}\n`)

  if (!noBuild) {
    runBuild()
    if (!staticOnly) {
      runSmokeBundle()
    }
  }

  // 仅生成 GBK 样例：不打报告，冒烟进程输出即结果
  if (fixtureGbk) {
    const smokeExit = runElectronSmoke()
    process.exit(smokeExit)
  }

  const staticResults = runStaticChecks()
  let exitCode = 0

  console.log(`\n${colors.dim}── 静态检查 ──${colors.reset}\n`)
  for (const r of staticResults) {
    console.log(formatResult(r))
    if (r.status === 'fail') exitCode = 1
  }

  let nativeResults = []
  if (!staticOnly) {
    const smokeExit = runElectronSmoke()
    nativeResults = loadNativeResults()
    console.log(`\n${colors.dim}── Electron / 原生冒烟 ──${colors.reset}\n`)
    if (nativeResults.length === 0) {
      console.log(`${colors.yellow}未读到 native 结果 JSON${colors.reset}`)
      exitCode = smokeExit !== 0 ? smokeExit : 1
    } else {
      for (const r of nativeResults) {
        console.log(formatResult(r))
        if (r.status === 'fail') exitCode = 1
      }
      if (smokeExit !== 0) exitCode = smokeExit
    }
  }

  const { jsonPath, mdPath, summary } = writeReport(staticResults, nativeResults)
  console.log(
    `\n${colors.dim}合计: ${summary.pass} 通过, ${summary.fail} 失败, ${summary.skip} 跳过, ${summary.warn} 警告${colors.reset}`,
  )
  console.log(`${colors.dim}报告: ${mdPath}${colors.reset}`)
  console.log(`${colors.dim}      ${jsonPath}${colors.reset}\n`)

  if (summary.fail > 0) {
    process.exit(1)
  }
  process.exit(exitCode)
}

main()
