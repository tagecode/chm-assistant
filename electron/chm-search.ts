import type { ChmSearchHit } from '../src/shared/electron'
import { getChmAddon } from './chm-native'
import { normalizeChmInternalPath } from './chm-path'
import { decodeChmText } from './chm-text'
import { getSessionRecord } from './chm-reader-service'

const HTML_PAGE = /\.(htm|html)$/i
/** 每批扫描页数，批间让出事件循环，避免阻塞 UI */
const SCAN_BATCH_SIZE = 12

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

/** 全文检索用轻量 HTML 去标签（比 DOM 解析快 orders of magnitude） */
function fastHtmlToSearchText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeSnippet(text: string, query: string, radius = 60): string {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) {
    return text.slice(0, radius * 2)
  }
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + query.length + radius)
  let s = text.slice(start, end)
  if (start > 0) {
    s = `…${s}`
  }
  if (end < text.length) {
    s = `${s}…`
  }
  return s
}

function titleFromPath(internalPath: string): string {
  const base = internalPath.replace(/\\/g, '/').split('/').pop() ?? internalPath
  return base.replace(/\.(htm|html)$/i, '')
}

function scanPage(
  sessionId: string,
  rawPath: string,
  q: string,
  qLower: string,
  readerEncodingPref: string,
  pageTitles: Map<string, string>,
): ChmSearchHit | null {
  const addon = getChmAddon()
  if (!addon) {
    return null
  }
  const internal = normalizeChmInternalPath(rawPath)
  const buf = addon.readObject(sessionId, internal)
  if (!buf.ok || !buf.data) {
    return null
  }
  const html = decodeChmText(buf.data, readerEncodingPref, true)
  const text = fastHtmlToSearchText(html)
  if (!text.toLowerCase().includes(qLower)) {
    return null
  }
  return {
    path: internal,
    title: pageTitles.get(internal) ?? titleFromPath(internal),
    snippet: makeSnippet(text, q),
  }
}

/** 同步全文检索（测试/脚本用；大 CHM 请用 async 版本） */
export function searchChmSession(
  sessionId: string,
  query: string,
  readerEncodingPref: string,
  maxResults = 80,
): ChmSearchHit[] {
  const q = query.trim()
  if (!q) {
    return []
  }
  const rec = getSessionRecord(sessionId)
  if (!rec || !getChmAddon()) {
    return []
  }

  const qLower = q.toLowerCase()
  const hits: ChmSearchHit[] = []
  const htmlPaths = rec.paths.filter((p) => HTML_PAGE.test(p))

  for (const rawPath of htmlPaths) {
    if (hits.length >= maxResults) {
      break
    }
    const hit = scanPage(sessionId, rawPath, q, qLower, readerEncodingPref, rec.pageTitles)
    if (hit) {
      hits.push(hit)
    }
  }

  return hits
}

export type SearchChmSessionOptions = {
  signal?: AbortSignal
  maxResults?: number
}

/** 异步分批全文检索，不阻塞 Electron 主进程事件循环 */
export async function searchChmSessionAsync(
  sessionId: string,
  query: string,
  readerEncodingPref: string,
  options: SearchChmSessionOptions = {},
): Promise<ChmSearchHit[]> {
  const q = query.trim()
  if (!q) {
    return []
  }
  const rec = getSessionRecord(sessionId)
  if (!rec || !getChmAddon()) {
    return []
  }

  const maxResults = options.maxResults ?? 80
  const qLower = q.toLowerCase()
  const hits: ChmSearchHit[] = []
  const htmlPaths = rec.paths.filter((p) => HTML_PAGE.test(p))

  for (let i = 0; i < htmlPaths.length; i++) {
    if (options.signal?.aborted) {
      break
    }
    if (hits.length >= maxResults) {
      break
    }

    const hit = scanPage(
      sessionId,
      htmlPaths[i],
      q,
      qLower,
      readerEncodingPref,
      rec.pageTitles,
    )
    if (hit) {
      hits.push(hit)
    }

    if (i > 0 && i % SCAN_BATCH_SIZE === 0) {
      await yieldToEventLoop()
    }
  }

  return hits
}
