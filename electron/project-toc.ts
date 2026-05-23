import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig, ProjectTocNode, TocMovePlacement } from '../src/shared/project'
import {
  defaultIndexMdPath,
  projectDocsDir,
  sanitizeDirName,
  uniquifyMdRelPath,
} from './project-docs'
import { resolveMdPath, saveProjectConfig, writeUtf8NoBom } from './project-fs'

export type TocLocate = {
  node: ProjectTocNode
  parentList: ProjectTocNode[]
  index: number
}

export function locateTocNode(nodes: ProjectTocNode[], nodeId: string): TocLocate | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (node.id === nodeId) {
      return { node, parentList: nodes, index: i }
    }
    if (node.children?.length) {
      const hit = locateTocNode(node.children, nodeId)
      if (hit) return hit
    }
  }
  return null
}

export function collectMdPathsFromNode(node: ProjectTocNode): string[] {
  const out: string[] = []
  if (node.mdPath) {
    out.push(node.mdPath.replace(/\\/g, '/'))
  }
  for (const child of node.children ?? []) {
    out.push(...collectMdPathsFromNode(child))
  }
  return out
}

function findParentListByDirPath(
  nodes: ProjectTocNode[],
  dirRel: string,
): ProjectTocNode[] | null {
  for (const n of nodes) {
    if (!n.mdPath && n.dirPath?.replace(/\\/g, '/') === dirRel) {
      if (!n.children) {
        n.children = []
      }
      return n.children
    }
    if (n.children?.length) {
      const hit = findParentListByDirPath(n.children, dirRel)
      if (hit) return hit
    }
  }
  return null
}

function findDocsFolderNode(nodes: ProjectTocNode[], docsDir: string): ProjectTocNode | null {
  for (const n of nodes) {
    if (!n.mdPath && n.dirPath?.replace(/\\/g, '/') === docsDir) {
      return n
    }
  }
  return null
}

/** 解析新建页面/文件夹应写入的磁盘目录与 TOC 父列表 */
export function resolveTocInsertTarget(
  config: ChmProjectConfig,
  contextNodeId?: string | null,
): { ok: true; dirRel: string; parentList: ProjectTocNode[] } | { ok: false; message: string } {
  const docsDir = projectDocsDir(config)

  if (!contextNodeId) {
    const docsFolder = findDocsFolderNode(config.toc, docsDir)
    if (docsFolder) {
      if (!docsFolder.children) {
        docsFolder.children = []
      }
      return { ok: true, dirRel: docsDir, parentList: docsFolder.children }
    }
    return { ok: true, dirRel: docsDir, parentList: config.toc }
  }

  const loc = locateTocNode(config.toc, contextNodeId)
  if (!loc) {
    return { ok: false, message: '未找到节点' }
  }
  const { node } = loc

  if (!node.mdPath) {
    const dirRel = node.dirPath?.replace(/\\/g, '/') ?? docsDir
    if (!node.children) {
      node.children = []
    }
    return { ok: true, dirRel, parentList: node.children }
  }

  const mdDir = path.posix.dirname(node.mdPath.replace(/\\/g, '/'))
  const dirRel = mdDir === '.' ? docsDir : mdDir
  return { ok: true, dirRel, parentList: loc.parentList }
}

function uniquifyDirRel(rootPath: string, parentDirRel: string, baseName: string): string {
  const safeParent = parentDirRel.replace(/\\/g, '/').replace(/\/+$/, '')
  let rel = safeParent ? `${safeParent}/${baseName}` : baseName
  let n = 1
  while (fs.existsSync(path.join(rootPath, rel.replace(/\//g, path.sep)))) {
    rel = safeParent ? `${safeParent}/${baseName}-${n}` : `${baseName}-${n}`
    n += 1
  }
  return rel.replace(/\\/g, '/')
}

export function createTocFolder(
  rootPath: string,
  config: ChmProjectConfig,
  folderName: string,
  contextNodeId?: string | null,
): { ok: true; config: ChmProjectConfig; dirPath: string } | { ok: false; message: string } {
  const name = folderName.trim()
  if (!name) {
    return { ok: false, message: '文件夹名不能为空' }
  }
  const target = resolveTocInsertTarget(config, contextNodeId)
  if (!target.ok) {
    return target
  }
  const safeName = sanitizeDirName(name)
  const dirRel = uniquifyDirRel(rootPath, target.dirRel, safeName)
  try {
    fs.mkdirSync(path.join(rootPath, dirRel.replace(/\//g, path.sep)), { recursive: true })
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
  const node: ProjectTocNode = {
    id: crypto.randomUUID(),
    title: safeName,
    dirPath: dirRel,
    children: [],
  }
  target.parentList.push(node)
  saveProjectConfig(rootPath, config)
  return { ok: true, config, dirPath: dirRel }
}

export function createTocMarkdownPage(
  rootPath: string,
  config: ChmProjectConfig,
  title: string,
  mdRelPath?: string,
  contextNodeId?: string | null,
): { ok: true; config: ChmProjectConfig; mdPath: string } | { ok: false; message: string } {
  const pageTitle = title.trim() || '新页面'
  const docsDir = projectDocsDir(config)

  let rel: string
  let target:
    | { ok: true; dirRel: string; parentList: ProjectTocNode[] }
    | { ok: false; message: string }

  if (mdRelPath?.trim()) {
    rel = mdRelPath.trim().replace(/\\/g, '/')
    if (!/\.md$/i.test(rel)) {
      return { ok: false, message: '路径须以 .md 结尾' }
    }
    const mdDir = path.posix.dirname(rel)
    const dirRel = mdDir === '.' ? docsDir : mdDir
    const parentList = findParentListByDirPath(config.toc, dirRel)
    target = parentList
      ? { ok: true, dirRel, parentList }
      : resolveTocInsertTarget(config, contextNodeId)
  } else {
    target = resolveTocInsertTarget(config, contextNodeId)
    if (!target.ok) {
      return target
    }
    const stem = sanitizeDirName(pageTitle).replace(/-/g, '_')
    rel = uniquifyMdRelPath(rootPath, target.dirRel, `${stem}.md`)
  }

  if (!target.ok) {
    return target
  }

  try {
    const abs = resolveMdPath(rootPath, rel)
    if (fs.existsSync(abs)) {
      return { ok: false, message: '文件已存在' }
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    writeUtf8NoBom(abs, `# ${pageTitle}\n\n`)
    const node: ProjectTocNode = {
      id: crypto.randomUUID(),
      title: pageTitle,
      mdPath: rel,
    }
    target.parentList.push(node)
    saveProjectConfig(rootPath, config)
    return { ok: true, config, mdPath: rel }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

function walkUpdateMdPath(nodes: ProjectTocNode[], oldPath: string, newPath: string): void {
  const oldNorm = oldPath.replace(/\\/g, '/')
  const newNorm = newPath.replace(/\\/g, '/')
  for (const n of nodes) {
    if (n.mdPath?.replace(/\\/g, '/') === oldNorm) {
      n.mdPath = newNorm
    }
    if (n.children?.length) {
      walkUpdateMdPath(n.children, oldNorm, newNorm)
    }
  }
}

export function renameTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
  title: string,
  mdPath?: string,
): { ok: true; config: ChmProjectConfig } | { ok: false; message: string } {
  const nextTitle = title.trim()
  if (!nextTitle) {
    return { ok: false, message: '标题不能为空' }
  }
  const loc = locateTocNode(config.toc, nodeId)
  if (!loc) {
    return { ok: false, message: '未找到目录节点' }
  }
  const { node } = loc
  node.title = nextTitle

  if (node.mdPath && mdPath !== undefined) {
    const rel = mdPath.trim().replace(/\\/g, '/')
    if (!/\.md$/i.test(rel)) {
      return { ok: false, message: '路径须以 .md 结尾' }
    }
    const oldRel = node.mdPath.replace(/\\/g, '/')
    if (rel !== oldRel) {
      try {
        const oldAbs = resolveMdPath(rootPath, oldRel)
        const newAbs = resolveMdPath(rootPath, rel)
        if (!fs.existsSync(oldAbs)) {
          return { ok: false, message: '源文件不存在' }
        }
        if (fs.existsSync(newAbs)) {
          return { ok: false, message: '目标路径已存在' }
        }
        fs.mkdirSync(path.dirname(newAbs), { recursive: true })
        fs.renameSync(oldAbs, newAbs)
        walkUpdateMdPath(config.toc, oldRel, rel)
        if (config.defaultPage.replace(/\\/g, '/') === oldRel) {
          config.defaultPage = rel
        }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) }
      }
    }
  }

  saveProjectConfig(rootPath, config)
  return { ok: true, config }
}

function nodeContainsId(node: ProjectTocNode, nodeId: string): boolean {
  if (node.id === nodeId) return true
  for (const child of node.children ?? []) {
    if (nodeContainsId(child, nodeId)) return true
  }
  return false
}

export function moveTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
  placement: TocMovePlacement,
): { ok: true; config: ChmProjectConfig } | { ok: false; message: string } {
  const loc = locateTocNode(config.toc, nodeId)
  if (!loc) {
    return { ok: false, message: '未找到目录节点' }
  }

  const [removed] = loc.parentList.splice(loc.index, 1)
  if (!removed) {
    return { ok: false, message: '移动失败' }
  }

  let targetList: ProjectTocNode[]
  let insertIndex: number

  if (placement.kind === 'inside') {
    const parentLoc = locateTocNode(config.toc, placement.parentId)
    if (!parentLoc) {
      loc.parentList.splice(loc.index, 0, removed)
      return { ok: false, message: '目标文件夹不存在' }
    }
    if (parentLoc.node.mdPath) {
      loc.parentList.splice(loc.index, 0, removed)
      return { ok: false, message: '不能移入页面节点' }
    }
    if (nodeContainsId(removed, placement.parentId)) {
      loc.parentList.splice(loc.index, 0, removed)
      return { ok: false, message: '不能移入自身或子节点' }
    }
    if (!parentLoc.node.children) {
      parentLoc.node.children = []
    }
    targetList = parentLoc.node.children
    insertIndex = targetList.length
  } else {
    const targetLoc = locateTocNode(config.toc, placement.targetId)
    if (!targetLoc) {
      loc.parentList.splice(loc.index, 0, removed)
      return { ok: false, message: '目标节点不存在' }
    }
    if (nodeContainsId(removed, placement.targetId)) {
      loc.parentList.splice(loc.index, 0, removed)
      return { ok: false, message: '不能移到自身或子节点内' }
    }
    targetList = targetLoc.parentList
    insertIndex = placement.kind === 'before' ? targetLoc.index : targetLoc.index + 1
    if (targetList === loc.parentList && loc.index < insertIndex) {
      insertIndex -= 1
    }
  }

  targetList.splice(Math.max(0, Math.min(insertIndex, targetList.length)), 0, removed)
  saveProjectConfig(rootPath, config)
  return { ok: true, config }
}

export function deleteTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
): { ok: true; config: ChmProjectConfig; deletedMdPaths: string[] } | { ok: false; message: string } {
  const loc = locateTocNode(config.toc, nodeId)
  if (!loc) {
    return { ok: false, message: '未找到目录节点' }
  }
  const removed = loc.parentList.splice(loc.index, 1)[0]
  if (!removed) {
    return { ok: false, message: '删除失败' }
  }
  const mdPaths = collectMdPathsFromNode(removed)
  const defaultNorm = config.defaultPage.replace(/\\/g, '/')
  for (const rel of mdPaths) {
    try {
      const abs = resolveMdPath(rootPath, rel)
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs)
      }
    } catch {
      /* 忽略单文件删除失败 */
    }
  }
  if (mdPaths.some((p) => p === defaultNorm)) {
    const remain = config.toc.flatMap((n) => collectMdPathsFromNode(n))
    config.defaultPage = remain[0] ?? defaultIndexMdPath(config)
  }
  saveProjectConfig(rootPath, config)
  return { ok: true, config, deletedMdPaths: mdPaths }
}
