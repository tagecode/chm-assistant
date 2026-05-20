import path from 'node:path'

import type { ChmOpenResult, ChmTocItem } from '../src/shared/electron'
import { pickFirstHhcPath, parseHhcToTree, type ReadChmObject } from './chm-hhc'
import { parseHhkToEntries, pickFirstHhkPath } from './chm-hhk'
import { normalizeChmInternalPath } from './chm-path'
import { getChmAddon } from './chm-native'
import { resolveChmFsPath } from './chm-fs'
import { findSystemInternalPath, parseChmSystem } from './chm-system'
import { decodeChmText, htmlToPlainText } from './chm-text'
import { enrichTocTitles } from './chm-toc-enrich'

export interface SessionRecord {
  filePath: string
  paths: string[]
  /** 包内 HTML 路径 → 可读标题（目录补全 / 搜索复用） */
  pageTitles: Map<string, string>
}

const openSessions = new Set<string>()
const sessionRecords = new Map<string, SessionRecord>()

export { normalizeChmInternalPath } from './chm-path'

export function getSessionRecord(sessionId: string): SessionRecord | undefined {
  return sessionRecords.get(sessionId)
}

export function pickDefaultHtmlPath(filePaths: string[]): string {
  const html = filePaths.filter((p) => /\.(htm|html)$/i.test(p))
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()
  const pairs = html.map((p) => ({ raw: p, n: norm(p) }))
  for (const cand of ['index.html', 'index.htm', 'default.html', 'default.htm']) {
    const hit = pairs.find((x) => x.n.endsWith(`/${cand}`) || x.n === `/${cand}`)
    if (hit) {
      return normalizeChmInternalPath(hit.raw)
    }
  }
  const sorted = [...html].sort((a, b) => a.localeCompare(b))
  const first = sorted[0]
  if (first) {
    return normalizeChmInternalPath(first)
  }
  const fallback = filePaths.find((p) => {
    const u = p.replace(/\\/g, '/')
    return !u.startsWith('/#') && !u.startsWith('/$')
  })
  return fallback ? normalizeChmInternalPath(fallback) : '/'
}

export function flatTocFromPaths(filePaths: string[]): ChmTocItem[] {
  const html = filePaths.filter((p) => /\.(htm|html)$/i.test(p))
  return [...html]
    .sort((a, b) => a.localeCompare(b))
    .map((p) => ({
      title: path.posix.basename(p.replace(/\\/g, '/')),
      path: normalizeChmInternalPath(p),
    }))
}

function resolvePathInArchive(internalPath: string, filePaths: string[]): string | null {
  const want = normalizeChmInternalPath(internalPath).toLowerCase()
  for (const p of filePaths) {
    if (normalizeChmInternalPath(p).toLowerCase() === want) {
      return normalizeChmInternalPath(p)
    }
  }
  const base = path.posix.basename(want)
  for (const p of filePaths) {
    const bn = path.posix.basename(normalizeChmInternalPath(p)).toLowerCase()
    if (bn === base) {
      return normalizeChmInternalPath(p)
    }
  }
  return null
}

function splitDefaultTopic(s: string): { file: string; fragment?: string } {
  const x = s.trim().replace(/\\/g, '/')
  const h = x.indexOf('#')
  if (h < 0) {
    return { file: x }
  }
  return { file: x.slice(0, h), fragment: x.slice(h + 1) || undefined }
}

export function openChmSession(rawPath: string, readerEncodingPref = 'auto'): ChmOpenResult {
  const addon = getChmAddon()
  if (!addon) {
    return { ok: false, path: rawPath, code: 'NATIVE_MISSING' }
  }
  const resolved = resolveChmFsPath(rawPath)
  if (!resolved.ok) {
    return { ok: false, path: rawPath, code: 'FS_INVALID' }
  }
  const op = addon.openChm(resolved.path)
  if (!op.ok || !op.sessionId) {
    return { ok: false, path: resolved.path, code: 'OPEN_FAILED' }
  }
  const list = addon.listPaths(op.sessionId)
  if (!list.ok || !list.paths) {
    addon.closeChm(op.sessionId)
    return { ok: false, path: resolved.path, code: 'ENUM_FAILED' }
  }
  const paths = list.paths
  const sid = op.sessionId

  const readObject: ReadChmObject = (internalPath) => {
    const r = addon.readObject(sid, normalizeChmInternalPath(internalPath))
    if (!r.ok || !r.data) {
      return null
    }
    return r.data
  }

  let systemMeta: ReturnType<typeof parseChmSystem> = {}
  const sysPath = findSystemInternalPath(paths)
  if (sysPath) {
    const sysBuf = readObject(sysPath)
    if (sysBuf && sysBuf.length >= 8) {
      systemMeta = parseChmSystem(sysBuf)
    }
  }

  let toc: ChmTocItem[] = flatTocFromPaths(paths)
  let hhcInternal: string | null = null
  if (systemMeta.contentsFile) {
    hhcInternal = resolvePathInArchive(systemMeta.contentsFile, paths)
  }
  if (!hhcInternal) {
    const pick = pickFirstHhcPath(paths)
    if (pick) {
      hhcInternal = resolvePathInArchive(pick, paths) ?? normalizeChmInternalPath(pick)
    }
  }
  if (hhcInternal) {
    const hhcBuf = readObject(hhcInternal)
    if (hhcBuf) {
      const html = decodeChmText(hhcBuf, readerEncodingPref, true)
      try {
        const tree = parseHhcToTree(html, hhcInternal, readObject, readerEncodingPref)
        if (tree.length > 0) {
          toc = tree
        }
      } catch {
        // 保持扁平目录
      }
    }
  }

  let index: ChmTocItem[] = []
  let hhkInternal: string | null = null
  if (systemMeta.indexFile) {
    hhkInternal = resolvePathInArchive(systemMeta.indexFile, paths)
  }
  if (!hhkInternal) {
    const pick = pickFirstHhkPath(paths)
    if (pick) {
      hhkInternal = resolvePathInArchive(pick, paths) ?? normalizeChmInternalPath(pick)
    }
  }
  if (hhkInternal) {
    const hhkBuf = readObject(hhkInternal)
    if (hhkBuf) {
      const html = decodeChmText(hhkBuf, readerEncodingPref, true)
      try {
        index = parseHhkToEntries(html, hhkInternal, readObject, readerEncodingPref)
      } catch {
        index = []
      }
    }
  }

  let entryInternalPath = pickDefaultHtmlPath(paths)
  let entryFragment: string | undefined
  if (systemMeta.defaultTopic) {
    const sp = splitDefaultTopic(systemMeta.defaultTopic)
    const rel = sp.file.replace(/\\/g, '/')
    const candidates = rel.startsWith('/')
      ? [normalizeChmInternalPath(rel)]
      : [normalizeChmInternalPath(`/${rel}`), normalizeChmInternalPath(rel)]
    const resolvedTopic = candidates
      .map((c) => resolvePathInArchive(c, paths))
      .find((x): x is string => x != null)
    if (resolvedTopic) {
      entryInternalPath = resolvedTopic
      entryFragment = sp.fragment
    }
  }

  const chmTitle =
    systemMeta.title?.trim() ||
    path.basename(resolved.path, path.extname(resolved.path))

  const pageTitles = new Map<string, string>()
  toc = enrichTocTitles(toc, readObject, readerEncodingPref, pageTitles)
  index = enrichTocTitles(index, readObject, readerEncodingPref, pageTitles)

  sessionRecords.set(sid, { filePath: resolved.path, paths, pageTitles })
  openSessions.add(sid)
  return {
    ok: true,
    path: resolved.path,
    sessionId: sid,
    chmTitle,
    entryInternalPath,
    entryFragment,
    toc,
    index,
  }
}

export function readChmPagePlainText(
  sessionId: string,
  internalPath: string,
  readerEncodingPref: string,
): { ok: true; text: string } | { ok: false; message: string } {
  const addon = getChmAddon()
  if (!addon) {
    return { ok: false, message: 'CHM native module not loaded' }
  }
  const pathNorm = normalizeChmInternalPath(internalPath)
  const r = addon.readObject(sessionId, pathNorm)
  if (!r.ok || !r.data) {
    return { ok: false, message: 'Page not found' }
  }
  const isHtml = /\.(htm|html|hhc|hhk)$/i.test(pathNorm)
  if (isHtml) {
    const html = decodeChmText(r.data, readerEncodingPref, true)
    return { ok: true, text: htmlToPlainText(html) }
  }
  return { ok: true, text: decodeChmText(r.data, readerEncodingPref, false) }
}

export function closeChmSession(sessionId: string): void {
  getChmAddon()?.closeChm(sessionId)
  openSessions.delete(sessionId)
  sessionRecords.delete(sessionId)
}

/** 进程退出前释放 CHMLib 句柄（例如用户直接 Cmd+Q） */
export function closeAllChmSessions(): void {
  for (const id of [...openSessions]) {
    closeChmSession(id)
  }
}
