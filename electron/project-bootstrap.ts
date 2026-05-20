import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig } from '../src/shared/project'
import { CHMPROJ_FILENAME } from '../src/shared/project'
import { writeUtf8NoBom } from './project-fs'

const CHMPROJ_VERSION = 1 as const

export function createProjectInDirectory(
  rootPath: string,
  title: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const st = fs.statSync(rootPath)
    if (!st.isDirectory()) {
      return { ok: false, error: '请选择目录' }
    }
  } catch {
    return { ok: false, error: '无法访问目录' }
  }

  const projFile = path.join(rootPath, CHMPROJ_FILENAME)
  const indexMd = path.join(rootPath, 'index.md')
  if (fs.existsSync(projFile)) {
    return { ok: false, error: '目录中已存在 chm-assistant.chmproj' }
  }

  const now = new Date().toISOString()
  const indexId = crypto.randomUUID()
  const config: ChmProjectConfig = {
    version: CHMPROJ_VERSION,
    title,
    author: '',
    createdAt: now,
    defaultPage: 'index.md',
    language: 'zh-Hans',
    charset: 'utf-8',
    toc: [
      {
        id: indexId,
        title,
        mdPath: 'index.md',
      },
    ],
    assetsDir: 'assets',
    compile: {
      openAfterCompile: true,
    },
  }

  writeUtf8NoBom(projFile, `${JSON.stringify(config, null, 2)}\n`)
  writeUtf8NoBom(
    indexMd,
    `# ${title}\n\n> Markdown 源文件，默认 UTF-8 无 BOM。\n`,
  )
  fs.mkdirSync(path.join(rootPath, 'assets'), { recursive: true })

  return { ok: true }
}
