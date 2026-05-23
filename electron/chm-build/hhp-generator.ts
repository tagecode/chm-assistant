import path from 'node:path'

import type { ChmProjectConfig } from '../../src/shared/project'
import type { CompilerKind } from '../compiler-resolve'

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

/** .hhp 与中间产物同在 buildDir；hhc 按 .hhp 所在目录解析相对路径。 */
function toHhpBuildRelPath(buildDir: string, absOrRel: string): string {
  const resolved = path.isAbsolute(absOrRel)
    ? absOrRel
    : path.join(buildDir, absOrRel)
  return path.relative(buildDir, resolved).replace(/\\/g, '/')
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
    compilerKind: CompilerKind
  },
): string {
  const lines: string[] = [
    '[OPTIONS]',
    'Compatibility=1.1',
    `Compiled file=${opts.compiledFile}`,
    `Contents file=${toHhpBuildRelPath(opts.buildDir, opts.contentsFile)}`,
    `Index file=${toHhpBuildRelPath(opts.buildDir, opts.indexFile)}`,
    `Default Topic=${toHhpBuildRelPath(opts.buildDir, opts.defaultTopicHtml)}`,
    `Title=${config.title}`,
    `Language=${languageCode(config.language)}`,
    'Display compile progress=Yes',
    '',
    '[FILES]',
    ...opts.htmlFiles.map((f) => toHhpBuildRelPath(opts.buildDir, f)),
    '',
  ]
  if (opts.compilerKind === 'chmcmd') {
    lines.splice(8, 0, 'Charset=65001')
  }
  return `${lines.join('\r\n')}\r\n`
}
