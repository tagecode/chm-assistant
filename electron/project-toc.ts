import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig, ProjectTocNode, TocMovePlacement } from '../src/shared/project'
import { resolveMdPath, saveProjectConfig } from './project-fs'

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
    config.defaultPage = remain[0] ?? 'index.md'
  }
  saveProjectConfig(rootPath, config)
  return { ok: true, config, deletedMdPaths: mdPaths }
}
