import path from 'node:path'

import type { ChmProjectConfig } from '../../src/shared/project'

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

export function generateHhp(
  config: ChmProjectConfig,
  opts: {
    compiledFile: string
    contentsFile: string
    indexFile: string
    defaultTopicHtml: string
    htmlFiles: string[]
    buildDir: string
  },
): string {
  const lines: string[] = [
    '[OPTIONS]',
    'Compatibility=1.1',
    `Compiled file=${opts.compiledFile}`,
    `Contents file=${opts.contentsFile}`,
    `Index file=${opts.indexFile}`,
    `Default Topic=${opts.defaultTopicHtml}`,
    `Title=${config.title}`,
    `Language=${languageCode(config.language)}`,
    'Charset=65001',
    'Display compile progress=Yes',
    '',
    '[FILES]',
    ...opts.htmlFiles.map((f) => path.posix.join('.', f.replace(/\\/g, '/'))),
    '',
  ]
  return `${lines.join('\r\n')}\r\n`
}
