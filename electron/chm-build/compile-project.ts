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
  writeUtf8NoBom,
} from '../project-fs'
import { generateHhc } from './hhc-generator'
import { generateHhk } from './hhk-generator'
import { generateHhp } from './hhp-generator'
import { markdownToHtmlBody, wrapHtmlDocument } from './md-to-html'
import { parseCompilerLogLine } from './parse-compiler-log'
import { getCompilerStatus, runChmCompiler } from './compiler'
import {
  copyResourcesToBuild,
  gatherAllProjectResources,
} from '../project-resources'

const BUILD_DIR_NAME = '.chm-build'
const HHC_NAME = 'toc.hhc'
const HHK_NAME = 'index.hhk'
const HHP_NAME = 'project.hhp'

function mdPathToHtmlRel(mdPath: string): string {
  const norm = mdPath.replace(/\\/g, '/')
  return norm.replace(/\.md$/i, '.html')
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
  const logCtx = { rootPath, buildDir: path.join(rootPath, BUILD_DIR_NAME) }

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

  const buildDir = logCtx.buildDir
  const distDir = path.join(rootPath, 'dist')
  fs.rmSync(buildDir, { recursive: true, force: true })
  fs.mkdirSync(buildDir, { recursive: true })
  fs.mkdirSync(distDir, { recursive: true })

  emit({ level: 'info', message: '正在将 Markdown 转换为 HTML…' })

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
    const htmlRel = mdPathToHtmlRel(mdRel)
    const absHtml = path.join(buildDir, htmlRel)
    const title =
      findTocTitle(config.toc, mdRel.replace(/\\/g, '/')) ??
      path.basename(mdRel, '.md')

    const body = markdownToHtmlBody(source)
    const doc = wrapHtmlDocument(title, body)
    writeUtf8NoBom(absHtml, doc)
    htmlFiles.push(htmlRel.replace(/\\/g, '/'))
    emit({ level: 'info', message: `已生成 ${htmlRel}`, sourcePath: mdRel })
  }

  const mdToHtml = mdPathToHtmlRel
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

  if (resourcePaths.length > 0) {
    emit({ level: 'info', message: `正在复制 ${resourcePaths.length} 个资源文件…` })
    const copied = copyResourcesToBuild(rootPath, buildDir, resourcePaths)
    for (const rel of copied) {
      htmlFiles.push(rel)
      emit({ level: 'info', message: `已复制资源 ${rel}` })
    }
  }

  emit({ level: 'info', message: '正在生成 .hhc / .hhk / .hhp…' })
  writeUtf8NoBom(path.join(buildDir, HHC_NAME), generateHhc(config.toc, mdToHtml))
  writeUtf8NoBom(path.join(buildDir, HHK_NAME), generateHhk(config.toc, mdToHtml))

  const outputName =
    config.compile?.outputFile?.trim() ||
    `${config.title.replace(/[<>:"/\\|?*]/g, '_') || 'output'}.chm`
  const compiledFile = path.join('..', 'dist', outputName).replace(/\\/g, '/')

  const hhp = generateHhp(config, {
    compiledFile,
    contentsFile: HHC_NAME,
    indexFile: HHK_NAME,
    defaultTopicHtml,
    htmlFiles: [...htmlFiles, HHC_NAME, HHK_NAME],
    buildDir,
  })
  const hhpPath = path.join(buildDir, HHP_NAME)
  writeUtf8NoBom(hhpPath, hhp)

  emit({ level: 'info', message: '正在调用外部 CHM 编译器…' })
  const { code, stdout, stderr } = await runChmCompiler(
    hhpPath,
    buildDir,
    customCompilerPath,
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

  const chmPath = path.join(distDir, outputName)
  if (code !== 0 || !fs.existsSync(chmPath)) {
    const err =
      code === 127 || stderr === 'COMPILER_NOT_FOUND'
        ? 'COMPILER_NOT_FOUND'
        : `编译失败（退出码 ${code}）。请确认已安装 hhc.exe 或 chmcmd。`
    emit({ level: 'error', message: err })
    return { ok: false, error: err, logs }
  }

  emit({ level: 'info', message: `编译成功：${chmPath}` })
  return { ok: true, chmPath, logs }
}
