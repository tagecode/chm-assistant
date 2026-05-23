import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig, ProjectTocNode } from '../src/shared/project'
import { CHMPROJ_FILENAME } from '../src/shared/project'
import { listProjectMarkdownFiles } from './project-docs'

export function projectConfigPath(rootPath: string): string {
  return path.join(rootPath, CHMPROJ_FILENAME)
}

export function readUtf8NoBom(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  return buf.toString('utf8')
}

/** 写入 UTF-8，无 BOM */
export function writeUtf8NoBom(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, { encoding: 'utf8' })
}

export function loadProjectConfig(rootPath: string): ChmProjectConfig | null {
  const fp = projectConfigPath(rootPath)
  if (!fs.existsSync(fp)) {
    return null
  }
  try {
    const raw = readUtf8NoBom(fp)
    const parsed = JSON.parse(raw) as ChmProjectConfig
    if (parsed.version !== 1 || typeof parsed.title !== 'string') {
      return null
    }
    if (!Array.isArray(parsed.toc)) {
      parsed.toc = []
    }
    return parsed
  } catch {
    return null
  }
}

export function saveProjectConfig(rootPath: string, config: ChmProjectConfig): void {
  const next: ChmProjectConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  }
  writeUtf8NoBom(projectConfigPath(rootPath), `${JSON.stringify(next, null, 2)}\n`)
}

export function titleFromMdPath(mdPath: string): string {
  const base = path.posix.basename(mdPath, path.posix.extname(mdPath))
  if (base.toLowerCase() === 'index') {
    return '首页'
  }
  return base.replace(/[-_]/g, ' ')
}

function nodeForFolder(
  title: string,
  dirPath: string,
  children: ProjectTocNode[],
): ProjectTocNode {
  return {
    id: crypto.randomUUID(),
    title,
    dirPath: dirPath.replace(/\\/g, '/'),
    children,
  }
}

/** 根据磁盘上的 .md 重建目录树（保留已有 id 时按 mdPath 合并） */
export function buildTocFromFilesystem(
  rootPath: string,
  existing?: ProjectTocNode[],
  config?: ChmProjectConfig,
): ProjectTocNode[] {
  const mdFiles = config
    ? listProjectMarkdownFiles(rootPath, config)
    : listProjectMarkdownFiles(rootPath, { docsDir: 'docs' } as ChmProjectConfig)
  const idByMd = new Map<string, string>()
  const walkIds = (nodes: ProjectTocNode[]) => {
    for (const n of nodes) {
      if (n.mdPath) {
        idByMd.set(n.mdPath.replace(/\\/g, '/'), n.id)
      }
      if (n.children?.length) {
        walkIds(n.children)
      }
    }
  }
  if (existing?.length) {
    walkIds(existing)
  }

  const root: ProjectTocNode[] = []
  const folderMap = new Map<string, ProjectTocNode[]>()

  const ensureFolderChildren = (folderRel: string): ProjectTocNode[] => {
    if (!folderRel) {
      return root
    }
    if (folderMap.has(folderRel)) {
      return folderMap.get(folderRel)!
    }
    const parts = folderRel.split('/')
    let parentList = root
    let built = ''
    for (const part of parts) {
      built = built ? `${built}/${part}` : part
      if (!folderMap.has(built)) {
        const folderNode = nodeForFolder(part, built, [])
        folderMap.set(built, folderNode.children!)
        parentList.push(folderNode)
        parentList = folderNode.children!
      } else {
        const existingFolder = parentList.find(
          (n) => !n.mdPath && (n.dirPath?.replace(/\\/g, '/') === built || n.title === part),
        )
        parentList =
          existingFolder?.children ??
          folderMap.get(built) ??
          (() => {
            const n = nodeForFolder(part, built, [])
            parentList.push(n)
            return n.children!
          })()
      }
    }
    return folderMap.get(folderRel)!
  }

  for (const mdPath of mdFiles) {
    const dir = path.posix.dirname(mdPath)
    const parent = dir === '.' ? root : ensureFolderChildren(dir)
    const id = idByMd.get(mdPath) ?? crypto.randomUUID()
    parent.push({
      id,
      title: titleFromMdPath(mdPath),
      mdPath,
    })
  }

  return root
}

export function listAllMdPaths(nodes: ProjectTocNode[]): string[] {
  const out: string[] = []
  const walk = (list: ProjectTocNode[]) => {
    for (const n of list) {
      if (n.mdPath) {
        out.push(n.mdPath.replace(/\\/g, '/'))
      }
      if (n.children?.length) {
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return out
}

export function resolveMdPath(rootPath: string, relMd: string): string {
  const safe = relMd.replace(/\\/g, '/').replace(/^\/+/, '')
  const abs = path.normalize(path.join(rootPath, safe))
  if (!abs.startsWith(path.normalize(rootPath))) {
    throw new Error('非法路径')
  }
  return abs
}
