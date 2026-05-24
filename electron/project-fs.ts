import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig, ProjectTocNode } from '../src/shared/project'
import { CHMPROJ_FILENAME } from '../src/shared/project'
import { DEFAULT_DOCS_DIR, listProjectMarkdownFiles, projectDocsDir } from './project-docs'

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

/** 将误写入 TOC 的 docs 根文件夹展开为其子节点（兼容旧数据） */
export function normalizeTocHideDocsRoot(
  toc: ProjectTocNode[],
  docsDir: string,
): ProjectTocNode[] {
  const normDocs = docsDir.replace(/\\/g, '/')
  const idx = toc.findIndex((n) => !n.mdPath && n.dirPath?.replace(/\\/g, '/') === normDocs)
  if (idx < 0) {
    return toc
  }
  const docsNode = toc[idx]!
  const rest = toc.filter((_, i) => i !== idx)
  return [...rest, ...(docsNode.children ?? [])]
}

function treeDirRelative(mdPath: string, docsDir: string, hideDocsRoot: boolean): string {
  const rel = mdPath.replace(/\\/g, '/')
  const dir = path.posix.dirname(rel)
  if (dir === '.') {
    return ''
  }
  if (!hideDocsRoot) {
    return dir
  }
  if (dir === docsDir) {
    return ''
  }
  const prefix = `${docsDir}/`
  if (dir.startsWith(prefix)) {
    return dir.slice(prefix.length)
  }
  return dir
}

function diskDirFromTreeDir(treeDir: string, docsDir: string, hideDocsRoot: boolean): string {
  if (!treeDir) {
    return hideDocsRoot ? docsDir : '.'
  }
  if (!hideDocsRoot) {
    return treeDir
  }
  return `${docsDir}/${treeDir}`
}

/** 根据磁盘上的 .md 重建目录树（合并磁盘变更；保留已有节点的 id 与侧栏标题） */
export function buildTocFromFilesystem(
  rootPath: string,
  existing?: ProjectTocNode[],
  config?: ChmProjectConfig,
): ProjectTocNode[] {
  const docsDir = config ? projectDocsDir(config) : DEFAULT_DOCS_DIR
  const hideDocsRoot = fs.existsSync(path.join(rootPath, docsDir))
  const mdFiles = config
    ? listProjectMarkdownFiles(rootPath, config)
    : listProjectMarkdownFiles(rootPath, { docsDir: DEFAULT_DOCS_DIR } as ChmProjectConfig)
  const idByMd = new Map<string, string>()
  const titleByMd = new Map<string, string>()
  const idByDir = new Map<string, string>()
  const titleByDir = new Map<string, string>()
  const walkExisting = (nodes: ProjectTocNode[]) => {
    for (const n of nodes) {
      if (n.mdPath) {
        const md = n.mdPath.replace(/\\/g, '/')
        idByMd.set(md, n.id)
        titleByMd.set(md, n.title)
      }
      if (n.dirPath) {
        const dir = n.dirPath.replace(/\\/g, '/')
        idByDir.set(dir, n.id)
        titleByDir.set(dir, n.title)
      }
      if (n.children?.length) {
        walkExisting(n.children)
      }
    }
  }
  if (existing?.length) {
    walkExisting(existing)
  }

  const root: ProjectTocNode[] = []
  const folderMap = new Map<string, ProjectTocNode[]>()

  const ensureFolderChildren = (treeFolderRel: string): ProjectTocNode[] => {
    if (!treeFolderRel) {
      return root
    }
    if (folderMap.has(treeFolderRel)) {
      return folderMap.get(treeFolderRel)!
    }
    const parts = treeFolderRel.split('/')
    let parentList = root
    let treeBuilt = ''
    for (const part of parts) {
      treeBuilt = treeBuilt ? `${treeBuilt}/${part}` : part
      const diskBuilt = diskDirFromTreeDir(treeBuilt, docsDir, hideDocsRoot)
      if (!folderMap.has(treeBuilt)) {
        const folderNode = nodeForFolder(titleByDir.get(diskBuilt) ?? part, diskBuilt, [])
        const existingId = idByDir.get(diskBuilt)
        if (existingId) {
          folderNode.id = existingId
        }
        folderMap.set(treeBuilt, folderNode.children!)
        parentList.push(folderNode)
        parentList = folderNode.children!
      } else {
        const existingFolder = parentList.find(
          (n) =>
            !n.mdPath &&
            (n.dirPath?.replace(/\\/g, '/') === diskBuilt || n.title === part),
        )
        parentList =
          existingFolder?.children ??
          folderMap.get(treeBuilt) ??
          (() => {
            const n = nodeForFolder(titleByDir.get(diskBuilt) ?? part, diskBuilt, [])
            const existingId = idByDir.get(diskBuilt)
            if (existingId) {
              n.id = existingId
            }
            parentList.push(n)
            return n.children!
          })()
      }
    }
    return folderMap.get(treeFolderRel)!
  }

  for (const mdPath of mdFiles) {
    const treeDir = treeDirRelative(mdPath, docsDir, hideDocsRoot)
    const parent = treeDir === '' ? root : ensureFolderChildren(treeDir)
    const id = idByMd.get(mdPath) ?? crypto.randomUUID()
    parent.push({
      id,
      title: titleByMd.get(mdPath) ?? titleFromMdPath(mdPath),
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
