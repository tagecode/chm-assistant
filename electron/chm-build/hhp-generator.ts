import path from 'node:path'

import type { ChmProjectConfig } from '../../src/shared/project'

export type HhpCompilerKind = 'hhc' | 'chmcmd'

/** hhc 与 chmcmd 对 .hhp、导航 Local、cwd、分隔符的要求不同。 */
export type ChmCompilerPathProfile = {
  kind: HhpCompilerKind
  /** .hhp 内 Contents/Index/Default Topic/[FILES] 的相对路径基准。 */
  hhpPathBaseDir: string
  /** .hhc/.hhk 内 Local 的相对路径基准。 */
  navLocalBaseDir: string
  /** 调用外部编译器时的工作目录。 */
  compilerWorkingDir: string
  pathStyle: 'posix' | 'win32'
}

function languageCode(lang: string): string {
  const l = lang.toLowerCase()
  if (l.startsWith('zh-hant') || l === 'zh-tw' || l === 'zh-hk') {
    return '0x404'
  }
  if (l.startsWith('zh')) {
    return '0x804'
  }
  return '0x409'
}

export function resolveChmCompilerPathProfile(
  _rootPath: string,
  buildDir: string,
  compilerKind: HhpCompilerKind,
): ChmCompilerPathProfile {
  if (compilerKind === 'hhc') {
    return {
      kind: 'hhc',
      hhpPathBaseDir: buildDir,
      navLocalBaseDir: buildDir,
      compilerWorkingDir: buildDir,
      pathStyle: process.platform === 'win32' ? 'win32' : 'posix',
    }
  }
  return {
    kind: 'chmcmd',
    hhpPathBaseDir: buildDir,
    navLocalBaseDir: buildDir,
    compilerWorkingDir: buildDir,
    pathStyle: 'posix',
  }
}

/** 调用外部编译器时的工作目录。 */
export function resolveCompilerWorkingDir(
  profile: ChmCompilerPathProfile,
): string {
  return profile.compilerWorkingDir
}

function formatCompilerRelPath(rel: string, pathStyle: 'posix' | 'win32'): string {
  if (pathStyle === 'win32') {
    return rel.replace(/\//g, '\\')
  }
  return rel.replace(/\\/g, '/')
}

function formatCompilerPath(filePath: string, pathStyle: 'posix' | 'win32'): string {
  if (pathStyle === 'win32') {
    return filePath.replace(/\//g, '\\')
  }
  return filePath.replace(/\\/g, '/')
}

/** 将 buildDir 下的绝对/相对路径转为相对指定编译器基准目录的路径。 */
function toCompilerRelPath(
  buildDir: string,
  baseDir: string,
  absOrRel: string,
  pathStyle: 'posix' | 'win32',
): string {
  const resolved = path.isAbsolute(absOrRel)
    ? absOrRel
    : path.join(buildDir, absOrRel)
  const rel = path.relative(baseDir, resolved)
  return formatCompilerRelPath(rel, pathStyle)
}

export function formatHhpInputPath(
  profile: ChmCompilerPathProfile,
  buildDir: string,
  absOrRel: string,
): string {
  return toCompilerRelPath(buildDir, profile.hhpPathBaseDir, absOrRel, profile.pathStyle)
}

export function formatNavLocalPath(
  profile: ChmCompilerPathProfile,
  buildDir: string,
  absOrRel: string,
): string {
  return toCompilerRelPath(buildDir, profile.navLocalBaseDir, absOrRel, profile.pathStyle)
}

export function formatCompilerProjectArg(
  profile: ChmCompilerPathProfile,
  hhpPath: string,
): string {
  return toCompilerRelPath(
    path.dirname(hhpPath),
    profile.compilerWorkingDir,
    hhpPath,
    profile.pathStyle,
  )
}

export function generateHhp(
  config: ChmProjectConfig,
  opts: {
    buildDir: string
    /** 输出 .chm 的绝对路径 */
    compiledFile: string
    contentsFile: string
    indexFile: string
    defaultTopicHtml: string
    htmlFiles: string[]
    profile: ChmCompilerPathProfile
    /** 仅 chmcmd：HHP Charset=… */
    hhpCharset?: string
    /** 简体中文 134 / 繁体 136 等（hhc 兼容模式） */
    defaultFont?: string
  },
): string {
  const rel = (p: string) => formatHhpInputPath(opts.profile, opts.buildDir, p)
  const lines: string[] = [
    '[OPTIONS]',
    'Compatibility=1.1',
    `Compiled file=${formatCompilerPath(opts.compiledFile, opts.profile.pathStyle)}`,
    `Contents file=${rel(opts.contentsFile)}`,
    `Index file=${rel(opts.indexFile)}`,
    `Default Topic=${rel(opts.defaultTopicHtml)}`,
    `Title=${config.title}`,
    `Language=${languageCode(config.language)}`,
    'Display compile progress=Yes',
    '',
    '[FILES]',
    ...opts.htmlFiles.map((f) => rel(f)),
    '',
  ]
  let insertAt = 8
  if (opts.hhpCharset) {
    lines.splice(insertAt, 0, `Charset=${opts.hhpCharset}`)
    insertAt++
  }
  if (opts.defaultFont) {
    lines.splice(insertAt, 0, `Default Font=${opts.defaultFont}`)
  }
  return `${lines.join('\r\n')}\r\n`
}
