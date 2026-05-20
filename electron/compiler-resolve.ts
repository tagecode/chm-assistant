import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

/** 微软 HTML Help Workshop 下载（仅用于引导用户安装 hhc，不可随应用分发 hhc.exe） */
export const HTML_HELP_WORKSHOP_DOWNLOAD_URL =
  'https://learn.microsoft.com/en-us/previous-versions/windows/desktop/htmlhelp/microsoft-html-help-downloads'

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
  /** 是否为本平台预期的内置编译器（Unix 为 chmcmd） */
  bundledIncluded: boolean
  /** Windows 安装指引链接 */
  installGuideUrl: string | null
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

function resolveWindowsHhc(customPath: string | null): ResolvedCompiler | null {
  if (customPath) {
    const p = resolveExistingFile(customPath)
    if (p) {
      return { cmd: p, args: [], kind: 'hhc', source: 'settings' }
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

function resolveUnixChmcmd(customPath: string | null): ResolvedCompiler | null {
  if (customPath) {
    const p = resolveExistingFile(customPath)
    if (p) {
      return { cmd: p, args: [], kind: 'chmcmd', source: 'settings' }
    }
    return null
  }
  for (const p of bundledChmcmdCandidates()) {
    return { cmd: p, args: [], kind: 'chmcmd', source: 'bundled' }
  }
  const systemNames = ['chmcmd', '/usr/local/bin/chmcmd', '/opt/homebrew/bin/chmcmd']
  for (const name of systemNames) {
    const p = resolveExistingFile(name)
    if (p) {
      return { cmd: p, args: [], kind: 'chmcmd', source: 'system' }
    }
  }
  return null
}

/** 解析顺序：用户设置路径 → 内置 chmcmd（仅 Unix）→ 系统 PATH / 常见路径 */
export function resolveChmCompiler(customPath: string | null): ResolvedCompiler | null {
  const trimmed = customPath?.trim() || null
  if (process.platform === 'win32') {
    return resolveWindowsHhc(trimmed)
  }
  return resolveUnixChmcmd(trimmed)
}

export function getCompilerStatus(customPath: string | null): CompilerStatus {
  const trimmed = customPath?.trim() || null
  const resolved = resolveChmCompiler(trimmed)

  if (process.platform === 'win32') {
    if (resolved) {
      return {
        available: true,
        kind: 'hhc',
        source: resolved.source,
        path: resolved.cmd,
        bundledIncluded: false,
        installGuideUrl: null,
        messageKey:
          resolved.source === 'settings' ? 'ok.settings' : 'ok.system',
      }
    }
    return {
      available: false,
      kind: null,
      source: trimmed ? null : null,
      path: trimmed,
      bundledIncluded: false,
      installGuideUrl: HTML_HELP_WORKSHOP_DOWNLOAD_URL,
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
      installGuideUrl: null,
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
    installGuideUrl: null,
    messageKey: trimmed ? 'missing.custom' : 'missing.unix',
  }
}
