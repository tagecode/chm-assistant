import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig } from '../src/shared/project'

export const DEFAULT_DOCS_DIR = 'docs'

export function projectDocsDir(config: ChmProjectConfig): string {
  return config.docsDir?.replace(/\\/g, '/') || DEFAULT_DOCS_DIR
}

export function defaultIndexMdPath(config: ChmProjectConfig): string {
  return `${projectDocsDir(config)}/index.md`
}

/** 列出项目内 Markdown 相对路径（优先 docs 目录；旧项目无 docs 时回退扫描根目录） */
export function listProjectMarkdownFiles(
  rootPath: string,
  config: ChmProjectConfig,
): string[] {
  const docsDir = projectDocsDir(config)
  const docsAbs = path.join(rootPath, docsDir)
  if (fs.existsSync(docsAbs)) {
    return scanMdFiles(rootPath, docsDir)
  }
  const assetsDir = config.assetsDir?.replace(/\\/g, '/') || 'assets'
  return scanMdFiles(rootPath, '').filter((p) => {
    const top = p.split('/')[0]
    return top !== assetsDir && top !== '.chm-build'
  })
}

const MD_EXT = /\.md$/i
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.chm-build',
  '.chm-assistant',
  'assets',
])

export function scanMdFiles(rootPath: string, relDir = ''): string[] {
  const abs = relDir ? path.join(rootPath, relDir) : rootPath
  if (!fs.existsSync(abs)) {
    return []
  }
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  const dirs: string[] = []
  for (const ent of entries) {
    if (ent.name.startsWith('.')) {
      continue
    }
    const rel = relDir ? path.posix.join(relDir, ent.name) : ent.name
    if (ent.isDirectory()) {
      if (!IGNORE_DIRS.has(ent.name)) {
        dirs.push(rel)
      }
    } else if (ent.isFile() && MD_EXT.test(ent.name)) {
      files.push(rel.replace(/\\/g, '/'))
    }
  }
  dirs.sort((a, b) => a.localeCompare(b))
  for (const d of dirs) {
    files.push(...scanMdFiles(rootPath, d))
  }
  files.sort((a, b) => a.localeCompare(b))
  return files
}

export function sanitizeDirName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').slice(0, 64) || 'folder'
}

export function uniquifyMdRelPath(
  rootPath: string,
  dirRel: string,
  baseName: string,
): string {
  const safeDir = dirRel.replace(/\\/g, '/').replace(/\/+$/, '')
  let fileName = baseName.trim()
  if (!/\.md$/i.test(fileName)) {
    fileName = `${fileName}.md`
  }
  let rel = safeDir ? `${safeDir}/${fileName}` : fileName
  let n = 1
  const absCheck = (r: string) => fs.existsSync(path.join(rootPath, r.replace(/\//g, path.sep)))
  while (absCheck(rel)) {
    const ext = path.posix.extname(fileName)
    const stem = path.posix.basename(fileName, ext)
    rel = safeDir ? `${safeDir}/${stem}-${n}${ext}` : `${stem}-${n}${ext}`
    n += 1
  }
  return rel.replace(/\\/g, '/')
}
