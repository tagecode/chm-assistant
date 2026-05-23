import fs from 'node:fs'
import path from 'node:path'

import iconv from 'iconv-lite'
import { execSync } from 'node:child_process'

export type CompileTextEncoding = 'utf-8' | 'gb18030' | 'cp950'

export type CompileEncodingProfile = {
  encoding: CompileTextEncoding
  /** HHP [OPTIONS] Charset */
  charset: string
  htmlMetaCharset: string
  htmlLang: string
}

/**
 * 读取 Windows 系统 ANSI 代码页（ACP，即 Win32 GetACP）。
 * 936 = 简体中文 GBK；950 = 繁体 Big5；65001 = 「Beta: UTF-8 全球语言」已开启。
 */
export function detectWindowsAnsiCodePage(): number | null {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[System.Text.Encoding]::Default.CodePage"',
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    )
    const cp = Number.parseInt(out.trim(), 10)
    return Number.isFinite(cp) && cp > 0 ? cp : null
  } catch {
    return null
  }
}

/** 根据项目选项解析编译中间文件编码（整包一致：HTML + .hhc/.hhk/.hhp）。 */
export function resolveCompileEncodingProfile(
  language: string,
  windowsViewerCompat: boolean,
): CompileEncodingProfile {
  if (!windowsViewerCompat) {
    return {
      encoding: 'utf-8',
      charset: '65001',
      htmlMetaCharset: 'UTF-8',
      htmlLang: languageToHtmlLang(language),
    }
  }
  const l = language.toLowerCase()
  if (l.startsWith('zh-hant') || l === 'zh-tw' || l === 'zh-hk') {
    return {
      encoding: 'cp950',
      charset: '950',
      htmlMetaCharset: 'Big5',
      htmlLang: 'zh-TW',
    }
  }
  if (l.startsWith('zh')) {
    return {
      encoding: 'gb18030',
      charset: '936',
      htmlMetaCharset: 'GB2312',
      htmlLang: 'zh-CN',
    }
  }
  return {
    encoding: 'utf-8',
    charset: '65001',
    htmlMetaCharset: 'UTF-8',
    htmlLang: languageToHtmlLang(language),
  }
}

function languageToHtmlLang(language: string): string {
  const l = language.toLowerCase()
  if (l.startsWith('zh-hant') || l === 'zh-tw' || l === 'zh-hk') {
    return 'zh-TW'
  }
  if (l.startsWith('zh')) {
    return 'zh-CN'
  }
  if (l.startsWith('en')) {
    return 'en'
  }
  return language.replace('_', '-')
}

/** .hhp 中是否写入 Charset（仅 chmcmd 支持；hhc.exe 不识别该选项）。 */
export function resolveHhpCharset(
  profile: CompileEncodingProfile,
  compilerKind: 'hhc' | 'chmcmd',
): string | undefined {
  if (compilerKind === 'hhc') {
    return undefined
  }
  if (profile.encoding !== 'utf-8') {
    return profile.charset
  }
  return '65001'
}

export function writeCompileTextFile(
  filePath: string,
  content: string,
  encoding: CompileTextEncoding,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (encoding === 'utf-8') {
    fs.writeFileSync(filePath, content, { encoding: 'utf8' })
    return
  }
  fs.writeFileSync(filePath, iconv.encode(content, encoding))
}

export function encodingLabel(profile: CompileEncodingProfile): string {
  if (profile.encoding === 'gb18030') {
    return 'GBK (936)'
  }
  if (profile.encoding === 'cp950') {
    return 'Big5 (950)'
  }
  return 'UTF-8 (65001)'
}

export type ResolvedCompilerKind = 'hhc' | 'chmcmd'

/** Windows 查看器兼容（GBK/Big5 工程）与编译器组合校验。 */
export function validateLegacyEncodingCompile(
  profile: CompileEncodingProfile,
  compilerKind: ResolvedCompilerKind,
): { ok: true } | { ok: false; message: string } {
  if (profile.encoding === 'utf-8') {
    return { ok: true }
  }
  if (compilerKind === 'hhc') {
    return { ok: true }
  }
  if (process.platform !== 'win32') {
    return {
      ok: false,
      message:
        'Windows 查看器兼容模式（GBK/Big5）目前仅支持在 Windows 上使用 hhc.exe 编译。请在本机安装 HTML Help Workshop，或在 Windows 设置中指定 hhc.exe 路径。',
    }
  }
  const acp = detectWindowsAnsiCodePage()
  if (acp === 65001) {
    return {
      ok: false,
      message:
        '当前 Windows 已启用 UTF-8 (ACP 65001)，内置 chmcmd 无法正确编译 GBK 工程（会导致 CHM 损坏）。请安装 HTML Help Workshop 并在设置中指定 hhc.exe，或关闭「兼容 Windows 帮助查看器」后使用默认 UTF-8 编译。',
    }
  }
  if (acp === 936 || acp === 950) {
    return { ok: true }
  }
  return {
    ok: false,
    message:
      'Windows 查看器兼容模式需要 hhc.exe，或系统代码页为简体中文 (936) / 繁体 (950) 且使用 chmcmd。请安装 HTML Help Workshop 或在设置中指定 hhc.exe。',
  }
}

export function defaultFontForCharset(charset: string | undefined): string | undefined {
  if (charset === '936') {
    return 'Microsoft YaHei,9,134'
  }
  if (charset === '950') {
    return 'Microsoft JhengHei,9,136'
  }
  return undefined
}
