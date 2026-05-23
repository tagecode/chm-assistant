import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

/** HTML Help Workshop 安装包（Internet Archive 镜像；微软官方页已不可用，不可随应用分发 hhc.exe） */
export const HTML_HELP_WORKSHOP_DOWNLOAD_URL =
  'https://web.archive.org/web/20160201063255/http://download.microsoft.com/download/0/A/9/0A939EF6-E31C-430F-A3DF-DFAE7960D564/htmlhelp.exe'

/** 备用镜像（Sandcastle Help File Builder 仓库） */
export const HTML_HELP_WORKSHOP_DOWNLOAD_URL_BACKUP =
  'https://github.com/EWSoftware/SHFB/raw/master/ThirdPartyTools/htmlhelp.exe'

export const HTML_HELP_WORKSHOP_DOWNLOAD_URLS = [
  HTML_HELP_WORKSHOP_DOWNLOAD_URL,
  HTML_HELP_WORKSHOP_DOWNLOAD_URL_BACKUP,
] as const

export type CompilerKind = 'hhc' | 'chmcmd'
export type CompilerSource = 'bundled' | 'settings' | 'system'

export interface ResolvedCompiler {
  cmd: string
  args: string[]
  kind: CompilerKind
  source: CompilerSource
}

export interface CompilerStatus {
  available: boolean
  kind: CompilerKind | null
  source: CompilerSource | null
  path: string | null
  /** 安装包是否已内置 chmcmd */
  bundledIncluded: boolean
  /** Windows 安装包下载链接（主链、备用） */
  installGuideUrls: readonly string[] | null
  messageKey: CompilerMessageKey
}

export type CompilerMessageKey =
  | 'ok.bundled'
  | 'ok.system'
  | 'ok.settings'
  | 'missing.win'
  | 'missing.unix'
  | 'missing.custom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function platformArchKey(): string {
  return `${process.platform}-${process.arch}`
}

function devCompilersRoot(): string {
  return path.join(__dirname, '../resources/compilers', platformArchKey())
}

function packagedCompilersRoot(): string {
  return path.join(process.resourcesPath, 'compilers', platformArchKey())
}

function bundledChmcmdCandidates(): string[] {
  const roots = app.isPackaged
    ? [packagedCompilersRoot()]
    : [devCompilersRoot(), packagedCompilersRoot()]
  const names = ['chmcmd', 'chmcmd.exe']
  const out: string[] = []
  for (const root of roots) {
    for (const name of names) {
      const p = path.join(root, name)
      if (fs.existsSync(p)) {
        out.push(p)
      }
    }
  }
  return out
}

const WIN_HHC_SYSTEM_CANDIDATES = [
  path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'HTML Help Workshop',
    'hhc.exe',
  ),
  path.join(
    process.env.ProgramFiles ?? 'C:\\Program Files',
    'HTML Help Workshop',
    'hhc.exe',
  ),
]

function resolveExistingFile(candidate: string): string | null {
  if (!candidate) {
    return null
  }
  if (path.isAbsolute(candidate) || candidate.includes(path.sep) || candidate.includes('/')) {
    return fs.existsSync(candidate) ? candidate : null
  }
  return candidate
}

function resolveCustomCompiler(customPath: string): ResolvedCompiler | null {
  const p = resolveExistingFile(customPath)
  if (!p) {
    return null
  }
  const base = path.basename(p).toLowerCase()
  if (base === 'chmcmd' || base === 'chmcmd.exe') {
    return { cmd: p, args: [], kind: 'chmcmd', source: 'settings' }
  }
  return { cmd: p, args: [], kind: 'hhc', source: 'settings' }
}

function resolveBundledChmcmd(): ResolvedCompiler | null {
  for (const p of bundledChmcmdCandidates()) {
    return { cmd: p, args: [], kind: 'chmcmd', source: 'bundled' }
  }
  return null
}

function resolveSystemChmcmd(): ResolvedCompiler | null {
  const systemNames =
    process.platform === 'win32'
      ? ['chmcmd.exe', 'chmcmd']
      : ['chmcmd', '/usr/local/bin/chmcmd', '/opt/homebrew/bin/chmcmd']
  for (const name of systemNames) {
    const p = resolveExistingFile(name)
    if (p) {
      return { cmd: p, args: [], kind: 'chmcmd', source: 'system' }
    }
  }
  return null
}

function resolveChmcmd(customPath: string | null): ResolvedCompiler | null {
  if (customPath) {
    return resolveCustomCompiler(customPath)
  }
  return resolveBundledChmcmd() ?? resolveSystemChmcmd()
}

function resolveWindowsHhc(customPath: string | null): ResolvedCompiler | null {
  if (customPath) {
    const custom = resolveCustomCompiler(customPath)
    if (custom?.kind === 'hhc') {
      return custom
    }
    return null
  }
  for (const p of WIN_HHC_SYSTEM_CANDIDATES) {
    if (fs.existsSync(p)) {
      return { cmd: p, args: [], kind: 'hhc', source: 'system' }
    }
  }
  return null
}

/** 解析顺序：自定义路径 → 内置 chmcmd → 系统 chmcmd → Windows: 系统 hhc */
export function resolveChmCompiler(customPath: string | null): ResolvedCompiler | null {
  const trimmed = customPath?.trim() || null
  if (trimmed) {
    return resolveCustomCompiler(trimmed)
  }
  if (process.platform === 'win32') {
    return (
      resolveBundledChmcmd() ??
      resolveSystemChmcmd() ??
      resolveWindowsHhc(null)
    )
  }
  return resolveChmcmd(null)
}

/**
 * 编译时解析编译器。legacyAnsiEncoding 为 true 时（Windows 查看器兼容 / GBK 工程），
 * 未指定自定义路径则优先 hhc.exe，避免 UTF-8 系统上的 chmcmd 误读 GBK 中间文件。
 */
export function resolveChmCompilerForBuild(
  customPath: string | null,
  opts?: { legacyAnsiEncoding?: boolean },
): ResolvedCompiler | null {
  const trimmed = customPath?.trim() || null
  if (trimmed) {
    return resolveCustomCompiler(trimmed)
  }
  if (opts?.legacyAnsiEncoding && process.platform === 'win32') {
    const hhc = resolveWindowsHhc(null)
    if (hhc) {
      return hhc
    }
  }
  return resolveChmCompiler(null)
}

export function getCompilerStatus(customPath: string | null): CompilerStatus {
  const trimmed = customPath?.trim() || null
  const resolved = resolveChmCompiler(trimmed)

  if (process.platform === 'win32') {
    if (resolved) {
      return {
        available: true,
        kind: resolved.kind,
        source: resolved.source,
        path: resolved.cmd,
        bundledIncluded: bundledChmcmdCandidates().length > 0,
        installGuideUrls: null,
        messageKey:
          resolved.source === 'settings'
            ? 'ok.settings'
            : resolved.kind === 'chmcmd'
              ? resolved.source === 'bundled'
                ? 'ok.bundled'
                : 'ok.system'
              : 'ok.system',
      }
    }
    return {
      available: false,
      kind: null,
      source: trimmed ? null : null,
      path: trimmed,
      bundledIncluded: bundledChmcmdCandidates().length > 0,
      installGuideUrls: HTML_HELP_WORKSHOP_DOWNLOAD_URLS,
      messageKey: trimmed ? 'missing.custom' : 'missing.win',
    }
  }

  const hasBundled = bundledChmcmdCandidates().length > 0
  if (resolved) {
    return {
      available: true,
      kind: 'chmcmd',
      source: resolved.source,
      path: resolved.cmd,
      bundledIncluded: hasBundled,
      installGuideUrls: null,
      messageKey:
        resolved.source === 'bundled'
          ? 'ok.bundled'
          : resolved.source === 'settings'
            ? 'ok.settings'
            : 'ok.system',
    }
  }
  return {
    available: false,
    kind: null,
    source: null,
    path: trimmed,
    bundledIncluded: hasBundled,
    installGuideUrls: null,
    messageKey: trimmed ? 'missing.custom' : 'missing.unix',
  }
}
