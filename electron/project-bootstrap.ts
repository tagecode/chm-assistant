import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig } from '../src/shared/project'
import { CHMPROJ_FILENAME } from '../src/shared/project'
import { DEFAULT_DOCS_DIR } from './project-docs'
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
  const indexRel = `${DEFAULT_DOCS_DIR}/index.md`
  const indexMd = path.join(rootPath, indexRel)
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
    defaultPage: indexRel,
    language: 'zh-Hans',
    charset: 'utf-8',
    docsDir: DEFAULT_DOCS_DIR,
    toc: [
      {
        id: indexId,
        title,
        mdPath: indexRel,
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
    `# ${title}\n\n> Markdown 源文件位于 \`${DEFAULT_DOCS_DIR}/\` 目录，默认 UTF-8 无 BOM。\n`,
  )
  fs.mkdirSync(path.join(rootPath, 'assets'), { recursive: true })

  return { ok: true }
}
