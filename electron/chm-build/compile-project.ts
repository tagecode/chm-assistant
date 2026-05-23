import fs from 'node:fs'
import path from 'node:path'

import type {
  ChmProjectConfig,
  CompileLogLine,
  CompileProjectResult,
  ProjectTocNode,
} from '../../src/shared/project'
import {
  listAllMdPaths,
  readUtf8NoBom,
  resolveMdPath,
} from '../project-fs'
import { generateHhc } from './hhc-generator'
import { generateHhk } from './hhk-generator'
import {
  formatNavLocalPath,
  generateHhp,
  resolveChmCompilerPathProfile,
} from './hhp-generator'
import {
  defaultFontForCharset,
  encodingLabel,
  resolveCompileEncodingProfile,
  resolveHhpCharset,
  validateLegacyEncodingCompile,
  writeCompileTextFile,
} from './compile-encoding'
import { markdownToCompileHtmlBody, wrapHtmlDocument } from './md-to-html'
import { parseCompilerLogLine } from './parse-compiler-log'
import {
  compilerOutputIndicatesFailure,
  pickCompilerErrorLine,
} from './compiler-output'
import { getCompilerStatus, resolveChmCompilerForBuild, runChmCompiler } from './compiler'
import {
  buildMdToBuildHtmlMap,
  copyResourcesToBuild,
  gatherAllProjectResources,
} from '../project-resources'
import { closeChmSessionsForPath } from '../chm-reader-service'

const CHMCMD_BUILD_DIR_NAME = '.chm-build'
const HHC_BUILD_DIR_NAME = 'chm-build-hhc'
const HHC_NAME = 'toc.hhc'
const HHK_NAME = 'index.hhk'
const HHP_NAME = 'project.hhp'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function resolveProjectChmOutputPath(
  rootPath: string,
  config: ChmProjectConfig,
): string {
  const outputName =
    config.compile?.outputFile?.trim() ||
    `${config.title.replace(/[<>:"/\\|?*]/g, '_') || 'output'}.chm`
  return path.join(rootPath, 'dist', outputName)
}

/** 释放输出 CHM 路径：关闭阅读会话并删除旧文件（含重试）。 */
export async function releaseChmOutputFile(
  chmPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  closeChmSessionsForPath(chmPath)
  if (!fs.existsSync(chmPath)) {
    return { ok: true }
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      fs.unlinkSync(chmPath)
      return { ok: true }
    } catch {
      closeChmSessionsForPath(chmPath)
      if (attempt < 9) {
        await delay(120)
      }
    }
  }
  return {
    ok: false,
    message: `无法写入 ${chmPath}：文件正被占用。请关闭本应用中该 CHM 的阅读标签、Windows 帮助查看器（hh.exe）或其他程序后重试。`,
  }
}

function formatCompileFailureMessage(
  code: number,
  detail: string,
  kind: 'hhc' | 'chmcmd',
): string {
  if (/EFCreateError|Unable to create file/i.test(detail)) {
    const fileMatch = detail.match(/"([^"]+\.chm)"/i)
    const file = fileMatch?.[1] ?? '输出 CHM 文件'
    return (
      `编译失败（退出码 ${code}）：无法创建 ${file}。\n` +
      '该文件可能正被本应用阅读器、Windows 帮助查看器（hh.exe）或其他程序占用，请关闭后重新编译。'
    )
  }
  if (/HHC6003/i.test(detail)) {
    return (
      `编译失败（退出码 ${code}）：${detail}\n` +
      '请以管理员身份运行：regsvr32 "C:\\Program Files (x86)\\HTML Help Workshop\\itcc.dll"'
    )
  }
  if (/HHC5003/i.test(detail) && kind === 'hhc') {
    return (
      `编译失败（退出码 ${code}）：${detail}\n` +
      'HTML Help 组件可能未正确注册或已损坏。请以管理员身份注册 itcc.dll，或在设置中改用 chmcmd。'
    )
  }
  return `编译失败（退出码 ${code}）：${detail}`
}

function mdPathToHtmlRel(mdPath: string): string {
  const norm = mdPath.replace(/\\/g, '/')
  return norm.replace(/\.md$/i, '.html')
}

function buildDirNameForCompiler(kind: 'hhc' | 'chmcmd'): string {
  return kind === 'hhc' ? HHC_BUILD_DIR_NAME : CHMCMD_BUILD_DIR_NAME
}

function findTocTitle(nodes: ProjectTocNode[], mdRel: string): string | null {
  for (const n of nodes) {
    if (n.mdPath?.replace(/\\/g, '/') === mdRel) {
      return n.title
    }
    if (n.children?.length) {
      const t = findTocTitle(n.children, mdRel)
      if (t) return t
    }
  }
  return null
}

export async function compileProject(
  rootPath: string,
  config: ChmProjectConfig,
  customCompilerPath: string | null,
  onProgress?: (line: CompileLogLine) => void,
): Promise<CompileProjectResult> {
  const logs: CompileLogLine[] = []
  const emit = (line: CompileLogLine) => {
    logs.push(line)
    onProgress?.(line)
  }

  if (!getCompilerStatus(customCompilerPath).available) {
    const err = 'COMPILER_NOT_FOUND'
    emit({ level: 'error', message: err })
    return { ok: false, error: err, logs }
  }

  const mdPaths = listAllMdPaths(config.toc)

  const { all: resourcePaths, missingByMd } = gatherAllProjectResources(
    rootPath,
    config,
    mdPaths,
  )
  for (const miss of missingByMd) {
    for (const ref of miss.refs) {
      emit({
        level: 'error',
        message: `缺少资源「${ref}」（在 ${miss.mdPath} 中引用）`,
        sourcePath: miss.mdPath,
      })
    }
  }
  if (missingByMd.some((m) => m.refs.length > 0)) {
    return {
      ok: false,
      error: '存在缺失的静态资源，请导入或修正 Markdown 中的路径',
      logs,
    }
  }

  if (mdPaths.length === 0) {
    const err = '项目中没有可编译的 Markdown 页面（请检查目录树）'
    emit({ level: 'error', message: err })
    return { ok: false, error: err, logs }
  }

  const windowsViewerCompat = config.compile?.windowsViewerCompat === true
  const encProfile = resolveCompileEncodingProfile(config.language, windowsViewerCompat)
  const legacyAnsi = encProfile.encoding !== 'utf-8'
  const compiler = resolveChmCompilerForBuild(customCompilerPath, {
    legacyAnsiEncoding: legacyAnsi,
  })
  if (!compiler) {
    const err = 'COMPILER_NOT_FOUND'
    emit({ level: 'error', message: err })
    return { ok: false, error: err, logs }
  }

  if (windowsViewerCompat) {
    emit({
      level: 'info',
      message: `已启用 Windows 查看器兼容模式，中间文件编码：${encodingLabel(encProfile)}`,
    })
    if (compiler.kind === 'hhc') {
      emit({ level: 'info', message: `使用 hhc.exe 编译：${compiler.cmd}` })
    }
    const legacyCheck = validateLegacyEncodingCompile(encProfile, compiler.kind)
    if (!legacyCheck.ok) {
      emit({ level: 'error', message: legacyCheck.message })
      return { ok: false, error: legacyCheck.message, logs }
    }
  }

  const buildDir = path.join(rootPath, buildDirNameForCompiler(compiler.kind))
  const logCtx = { rootPath, buildDir }
  const distDir = path.join(rootPath, 'dist')
  fs.rmSync(buildDir, { recursive: true, force: true })
  fs.mkdirSync(buildDir, { recursive: true })
  fs.mkdirSync(distDir, { recursive: true })

  let resourcePathMap = new Map<string, string>()
  if (resourcePaths.length > 0) {
    emit({ level: 'info', message: `正在复制 ${resourcePaths.length} 个资源文件…` })
    const { copied, pathMap } = copyResourcesToBuild(rootPath, buildDir, resourcePaths)
    resourcePathMap = pathMap
    for (const rel of copied) {
      emit({ level: 'info', message: `已复制资源 ${rel}` })
    }
  }

  emit({ level: 'info', message: '正在将 Markdown 转换为 HTML…' })

  const mdToBuildHtml = buildMdToBuildHtmlMap(mdPaths)
  const compilePathMap = new Map<string, string>(resourcePathMap)
  for (const [md, html] of mdToBuildHtml) {
    compilePathMap.set(md, html)
  }

  const htmlFiles: string[] = []
  for (const mdRel of mdPaths) {
    const absMd = resolveMdPath(rootPath, mdRel)
    if (!fs.existsSync(absMd)) {
      emit({
        level: 'error',
        message: `找不到源文件：${mdRel}`,
        sourcePath: mdRel,
      })
      return { ok: false, error: `缺少源文件 ${mdRel}`, logs }
    }
    let source: string
    try {
      source = readUtf8NoBom(absMd)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      emit({ level: 'error', message: `读取失败：${msg}`, sourcePath: mdRel })
      return { ok: false, error: msg, logs }
    }
    const mdNorm = mdRel.replace(/\\/g, '/')
    const htmlRel = mdToBuildHtml.get(mdNorm) ?? mdPathToHtmlRel(mdNorm)
    const absHtml = path.join(buildDir, htmlRel.replace(/\//g, path.sep))
    const title =
      findTocTitle(config.toc, mdNorm) ??
      path.basename(mdRel, '.md')

    const body = markdownToCompileHtmlBody(
      source,
      rootPath,
      mdNorm,
      compilePathMap,
    )
    const doc = wrapHtmlDocument(title, body, {
      metaCharset: encProfile.htmlMetaCharset,
      lang: encProfile.htmlLang,
    })
    writeCompileTextFile(absHtml, doc, encProfile.encoding)
    htmlFiles.push(htmlRel)
    emit({ level: 'info', message: `已生成 ${htmlRel}`, sourcePath: mdRel })
  }

  const mdToHtml = (mdPath: string) =>
    mdToBuildHtml.get(mdPath.replace(/\\/g, '/')) ??
    mdPathToHtmlRel(mdPath.replace(/\\/g, '/'))
  const compilerPathProfile = resolveChmCompilerPathProfile(
    rootPath,
    buildDir,
    compiler.kind,
  )
  const mdToNavHtml = (mdPath: string) =>
    formatNavLocalPath(
      compilerPathProfile,
      buildDir,
      mdToHtml(mdPath),
    )
  const defaultMd = config.defaultPage || 'index.md'
  const defaultHtml = mdToHtml(defaultMd.replace(/\\/g, '/'))
  if (!htmlFiles.includes(defaultHtml)) {
    emit({
      level: 'warn',
      message: `默认页 ${defaultMd} 不在目录树中，将使用第一个页面`,
    })
  }
  const defaultTopicHtml = htmlFiles.includes(defaultHtml)
    ? defaultHtml
    : (htmlFiles[0] ?? 'index.html')

  const buildResourceFiles = [...resourcePathMap.values()]
  for (const rel of buildResourceFiles) {
    if (!htmlFiles.includes(rel)) {
      htmlFiles.push(rel)
    }
  }

  emit({ level: 'info', message: '正在生成 .hhc / .hhk / .hhp…' })
  const navMeta = encProfile.htmlMetaCharset
  writeCompileTextFile(
    path.join(buildDir, HHC_NAME),
    generateHhc(config.toc, mdToNavHtml, { metaCharset: navMeta }),
    encProfile.encoding,
  )
  writeCompileTextFile(
    path.join(buildDir, HHK_NAME),
    generateHhk(config.toc, mdToNavHtml, { metaCharset: navMeta }),
    encProfile.encoding,
  )

  const chmPath = resolveProjectChmOutputPath(rootPath, config)
  const hhpCharset = resolveHhpCharset(encProfile, compiler.kind)
  const hhp = generateHhp(config, {
    buildDir,
    compiledFile: chmPath,
    contentsFile: path.join(buildDir, HHC_NAME),
    indexFile: path.join(buildDir, HHK_NAME),
    defaultTopicHtml: path.join(buildDir, defaultTopicHtml),
    htmlFiles: [
      ...htmlFiles.map((rel) => path.join(buildDir, rel)),
      path.join(buildDir, HHC_NAME),
      path.join(buildDir, HHK_NAME),
    ],
    profile: compilerPathProfile,
    hhpCharset,
    defaultFont:
      compiler.kind === 'hhc' && legacyAnsi
        ? defaultFontForCharset(encProfile.charset)
        : defaultFontForCharset(hhpCharset),
  })
  const hhpPath = path.join(buildDir, HHP_NAME)
  writeCompileTextFile(hhpPath, hhp, encProfile.encoding)

  const released = await releaseChmOutputFile(chmPath)
  if (!released.ok) {
    emit({ level: 'error', message: released.message })
    return { ok: false, error: released.message, logs }
  }

  emit({ level: 'info', message: '正在调用外部 CHM 编译器…' })
  const { code, stdout, stderr } = await runChmCompiler(
    hhpPath,
    compilerPathProfile,
    customCompilerPath,
    compiler,
  )
  const emitCompilerLine = (line: string) => {
    const parsed = parseCompilerLogLine(line, logCtx)
    emit(parsed)
  }
  if (stdout.trim()) {
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      emitCompilerLine(line)
    }
  }
  if (stderr.trim()) {
    for (const line of stderr.split(/\r?\n/).filter(Boolean)) {
      emitCompilerLine(line)
    }
  }

  const compilerReportedFailure = compilerOutputIndicatesFailure(stdout, stderr)
  const chmCreated = fs.existsSync(chmPath)
  const exitCodeIndicatesFailure = code !== 0 && compiler.kind !== 'hhc'
  if (exitCodeIndicatesFailure || !chmCreated || compilerReportedFailure) {
    const hhcDetail = pickCompilerErrorLine(stdout, stderr)
    const err =
      code === 127 || stderr === 'COMPILER_NOT_FOUND'
        ? 'COMPILER_NOT_FOUND'
        : hhcDetail
          ? formatCompileFailureMessage(code, hhcDetail, compiler.kind)
          : `编译失败（退出码 ${code}）。请确认编译器可用（内置 chmcmd、系统 chmcmd 或 hhc.exe）。`
    emit({ level: 'error', message: err })
    return { ok: false, error: err, logs }
  }

  emit({ level: 'info', message: `编译成功：${chmPath}` })
  return { ok: true, chmPath, logs }
}
