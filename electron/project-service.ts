import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  ChmProjectConfig,
  CompileLogLine,
  CompileProjectResult,
  ProjectLoadError,
  ProjectLoadResult,
  ProjectTocNode,
  TocMovePlacement,
} from '../src/shared/project'
import { compileProject } from './chm-build/compile-project'
import { markdownToHtmlBody, wrapHtmlDocument } from './chm-build/md-to-html'
import {
  importResourcesToProject,
  listProjectAssetFiles,
} from './project-resources'
import {
  buildTocFromFilesystem,
  loadProjectConfig,
  projectConfigPath,
  readUtf8NoBom,
  resolveMdPath,
  saveProjectConfig,
  writeUtf8NoBom,
} from './project-fs'
import { deleteTocNode, moveTocNode, renameTocNode } from './project-toc'

export function loadProject(rootPath: string): ProjectLoadResult | ProjectLoadError {
  const config = loadProjectConfig(rootPath)
  if (!config) {
    return {
      ok: false,
      code: fs.existsSync(projectConfigPath(rootPath)) ? 'INVALID' : 'NOT_FOUND',
      message: '未找到有效的 chm-assistant.chmproj',
    }
  }
  if (config.toc.length === 0) {
    config.toc = buildTocFromFilesystem(rootPath)
    saveProjectConfig(rootPath, config)
  }
  const defaultMd = config.defaultPage || 'index.md'
  const activeMdPath = fs.existsSync(resolveMdPath(rootPath, defaultMd))
    ? defaultMd.replace(/\\/g, '/')
    : config.toc.find((n) => n.mdPath)?.mdPath ?? null

  return {
    ok: true,
    rootPath,
    config,
    activeMdPath,
  }
}

export function saveProject(
  rootPath: string,
  config: ChmProjectConfig,
): { ok: true } | { ok: false; message: string } {
  try {
    saveProjectConfig(rootPath, config)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, message }
  }
}

export function readProjectMarkdown(
  rootPath: string,
  mdRelPath: string,
): { ok: true; content: string } | { ok: false; message: string } {
  try {
    const abs = resolveMdPath(rootPath, mdRelPath)
    if (!fs.existsSync(abs)) {
      return { ok: false, message: '文件不存在' }
    }
    return { ok: true, content: readUtf8NoBom(abs) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export function writeProjectMarkdown(
  rootPath: string,
  mdRelPath: string,
  content: string,
): { ok: true } | { ok: false; message: string } {
  try {
    const abs = resolveMdPath(rootPath, mdRelPath)
    writeUtf8NoBom(abs, content)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export function createMarkdownPage(
  rootPath: string,
  config: ChmProjectConfig,
  mdRelPath: string,
  title: string,
): { ok: true; config: ChmProjectConfig } | { ok: false; message: string } {
  const rel = mdRelPath.replace(/\\/g, '/')
  try {
    const abs = resolveMdPath(rootPath, rel)
    if (fs.existsSync(abs)) {
      return { ok: false, message: '文件已存在' }
    }
    writeUtf8NoBom(abs, `# ${title}\n\n`)
    const node: ProjectTocNode = {
      id: crypto.randomUUID(),
      title,
      mdPath: rel,
    }
    config.toc.push(node)
    saveProjectConfig(rootPath, config)
    return { ok: true, config }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export function refreshProjectToc(
  rootPath: string,
  config: ChmProjectConfig,
): ChmProjectConfig {
  config.toc = buildTocFromFilesystem(rootPath, config.toc)
  saveProjectConfig(rootPath, config)
  return config
}

export async function compileProjectWithProgress(
  rootPath: string,
  config: ChmProjectConfig,
  customCompilerPath: string | null,
  onProgress: (line: CompileLogLine) => void,
): Promise<CompileProjectResult> {
  return compileProject(rootPath, config, customCompilerPath, onProgress)
}

export function buildMarkdownPreviewHtml(
  rootPath: string,
  mdRelPath: string,
  markdown: string,
): string {
  const mdRel = mdRelPath.replace(/\\/g, '/')
  const mdDir = path.posix.dirname(mdRel)
  const basePath =
    mdDir === '.' ? rootPath : path.join(rootPath, mdDir.replace(/\//g, path.sep))
  const baseHref = `${pathToFileURL(basePath).href}/`
  const body = markdownToHtmlBody(markdown)
  return wrapHtmlDocument('Preview', body, baseHref)
}

export function importProjectResources(
  rootPath: string,
  config: ChmProjectConfig,
  sourcePaths: string[],
): ReturnType<typeof importResourcesToProject> {
  return importResourcesToProject(rootPath, config, sourcePaths)
}

export function listAssets(
  rootPath: string,
  config: ChmProjectConfig,
): string[] {
  return listProjectAssetFiles(rootPath, config)
}

export function renameProjectTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
  title: string,
  mdPath?: string,
) {
  return renameTocNode(rootPath, config, nodeId, title, mdPath)
}

export function deleteProjectTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
) {
  return deleteTocNode(rootPath, config, nodeId)
}

export function moveProjectTocNode(
  rootPath: string,
  config: ChmProjectConfig,
  nodeId: string,
  placement: TocMovePlacement,
) {
  return moveTocNode(rootPath, config, nodeId, placement)
}
