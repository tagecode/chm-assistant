import fs from 'node:fs'
import path from 'node:path'

import MarkdownIt from 'markdown-it'

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
import { wrapHtmlDocument } from './chm-build/md-to-html'
import {
  importResourcesToProject,
  listProjectAssetFiles,
  decodeResourceRef,
  resolveProjectResourceRef,
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
  const body = markdownToPreviewHtmlBody(rootPath, mdRel, markdown)
  // 预览 iframe 无法加载 file://；图片已内联为 data URL，不再设置 base 避免回退到本地文件
  return wrapHtmlDocument('Preview', body)
}

const PREVIEW_IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
}

function localImageToDataUrl(absPath: string): string | null {
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return null
  }
  const ext = path.extname(absPath).toLowerCase()
  const mime = PREVIEW_IMAGE_MIME[ext]
  if (!mime) {
    return null
  }
  const buf = fs.readFileSync(absPath)
  return `data:${mime};base64,${buf.toString('base64')}`
}

function markdownToPreviewHtmlBody(
  rootPath: string,
  mdRel: string,
  markdown: string,
): string {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  })
  const defaultImage =
    md.renderer.rules.image ??
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options))
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') ?? ''
    const ref = decodeResourceRef(src)
    if (
      ref &&
      !/^https?:/i.test(ref) &&
      !ref.startsWith('data:') &&
      !ref.startsWith('#')
    ) {
      const resolved = resolveProjectResourceRef(rootPath, mdRel, ref)
      if (resolved) {
        const abs = path.join(rootPath, resolved.replace(/\//g, path.sep))
        const dataUrl = localImageToDataUrl(abs)
        if (dataUrl) {
          token.attrSet('src', dataUrl)
        }
      }
    }
    return defaultImage(tokens, idx, options, env, self)
  }
  return md.render(markdown)
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
