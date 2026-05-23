import fs from 'node:fs'
import path from 'node:path'

import type { ChmProjectConfig } from '../src/shared/project'
import { readUtf8NoBom, resolveMdPath } from './project-fs'

export const DEFAULT_ASSETS_DIR = 'assets'

const RESOURCE_REF =
  /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[[^\]]+]\([^)\s]+:\s*([^)\s]+)\)/g

export function projectAssetsDir(config: ChmProjectConfig): string {
  return config.assetsDir?.replace(/\\/g, '/') || DEFAULT_ASSETS_DIR
}

export function assetsAbs(rootPath: string, config: ChmProjectConfig): string {
  return path.join(rootPath, projectAssetsDir(config))
}

/** 从 Markdown 提取相对资源引用（跳过 http/https、#、data:） */
export function extractMarkdownResourceRefs(markdown: string): string[] {
  const refs: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(RESOURCE_REF.source, 'g')
  while ((m = re.exec(markdown)) !== null) {
    const ref = (m[1] ?? m[2] ?? '').trim()
    if (!ref || /^https?:/i.test(ref) || ref.startsWith('#') || ref.startsWith('data:')) {
      continue
    }
    refs.push(ref.replace(/\\/g, '/'))
  }
  return refs
}

/** 解码 Markdown / HTML 中的资源路径（markdown-it 会对非 ASCII 做 URL 编码） */
export function decodeResourceRef(ref: string): string {
  try {
    return decodeURIComponent(ref)
  } catch {
    return ref
  }
}

export function resolveProjectResourceRef(
  rootPath: string,
  mdRel: string,
  ref: string,
): string | null {
  const decoded = decodeResourceRef(ref.trim())
  const mdDir = path.posix.dirname(mdRel.replace(/\\/g, '/'))
  const joined =
    decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)
      ? decoded.replace(/^\//, '')
      : mdDir === '.' || mdDir === ''
        ? decoded
        : path.posix.join(mdDir, decoded)
  const norm = joined.replace(/\\/g, '/')
  try {
    const abs = resolveMdPath(rootPath, norm)
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return path.relative(rootPath, abs).replace(/\\/g, '/')
    }
  } catch {
    /* ignore invalid */
  }
  return null
}

export function collectResourcesForMarkdown(
  rootPath: string,
  mdRel: string,
  markdown: string,
): { found: string[]; missing: string[] } {
  const found: string[] = []
  const missing: string[] = []
  for (const ref of extractMarkdownResourceRefs(markdown)) {
    const resolved = resolveProjectResourceRef(rootPath, mdRel, ref)
    if (resolved) {
      found.push(resolved)
    } else {
      missing.push(ref)
    }
  }
  return { found, missing }
}

function listFilesRecursive(dir: string, baseDir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }
  const out: string[] = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) {
      continue
    }
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...listFilesRecursive(abs, baseDir))
    } else if (ent.isFile()) {
      out.push(path.relative(baseDir, abs).replace(/\\/g, '/'))
    }
  }
  return out
}

export function listProjectAssetFiles(
  rootPath: string,
  config: ChmProjectConfig,
): string[] {
  const dir = assetsAbs(rootPath, config)
  if (!fs.existsSync(dir)) {
    return []
  }
  return listFilesRecursive(dir, rootPath).filter((p) =>
    p.replace(/\\/g, '/').startsWith(`${projectAssetsDir(config)}/`),
  )
}

function uniquifyName(dir: string, name: string): string {
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  let candidate = name
  let n = 1
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${n}${ext}`
    n += 1
  }
  return candidate
}

export function importResourcesToProject(
  rootPath: string,
  config: ChmProjectConfig,
  sourcePaths: string[],
  subdir?: string,
): { ok: true; paths: string[]; markdownSnippets: string[] } | { ok: false; message: string } {
  const assetsRel = subdir
    ? path.posix.join(projectAssetsDir(config), subdir.replace(/\\/g, '/'))
    : projectAssetsDir(config)
  const targetDir = path.join(rootPath, assetsRel)
  try {
    fs.mkdirSync(targetDir, { recursive: true })
    const copied: string[] = []
    const snippets: string[] = []
    for (const src of sourcePaths) {
      if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
        continue
      }
      const base = uniquifyName(targetDir, path.basename(src))
      const dest = path.join(targetDir, base)
      fs.copyFileSync(src, dest)
      const rel = path.posix.join(assetsRel, base)
      copied.push(rel)
      const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(base)
      snippets.push(isImage ? `![](${rel})` : `[${base}](${rel})`)
    }
    if (copied.length === 0) {
      return { ok: false, message: '没有可导入的文件' }
    }
    return { ok: true, paths: copied, markdownSnippets: snippets }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export function copyResourcesToBuild(
  rootPath: string,
  buildDir: string,
  resourceRelPaths: string[],
): string[] {
  const copied: string[] = []
  for (const rel of resourceRelPaths) {
    const src = path.join(rootPath, rel.replace(/\//g, path.sep))
    if (!fs.existsSync(src)) {
      continue
    }
    const dest = path.join(buildDir, rel.replace(/\//g, path.sep))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    copied.push(rel.replace(/\\/g, '/'))
  }
  return copied
}

export function gatherAllProjectResources(
  rootPath: string,
  config: ChmProjectConfig,
  mdRelPaths: string[],
): { all: string[]; missingByMd: { mdPath: string; refs: string[] }[] } {
  const set = new Set<string>()
  const missingByMd: { mdPath: string; refs: string[] }[] = []

  for (const p of listProjectAssetFiles(rootPath, config)) {
    set.add(p)
  }

  for (const mdRel of mdRelPaths) {
    const abs = resolveMdPath(rootPath, mdRel)
    if (!fs.existsSync(abs)) {
      continue
    }
    const md = readUtf8NoBom(abs)
    const { found, missing } = collectResourcesForMarkdown(rootPath, mdRel, md)
    for (const f of found) {
      set.add(f)
    }
    if (missing.length > 0) {
      missingByMd.push({ mdPath: mdRel, refs: missing })
    }
  }

  return { all: [...set], missingByMd }
}
