import { parse } from 'node-html-parser'

import type { ChmSearchHit } from '../src/shared/electron'
import { getChmAddon } from './chm-native'
import { normalizeChmInternalPath } from './chm-path'
import { decodeChmText } from './chm-text'
import { getSessionRecord } from './chm-reader-service'

const HTML_PAGE = /\.(htm|html)$/i

function stripHtmlToText(html: string): string {
  try {
    const root = parse(html, { lowerCaseTagName: true })
    return root.structuredText.replace(/\s+/g, ' ').trim()
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
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

/** 在已打开会话的 HTML 页面中流式全文检索（首版：线性扫描 + 解码一致）。 */
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
  const addon = getChmAddon()
  if (!rec || !addon) {
    return []
  }

  const qLower = q.toLowerCase()
  const hits: ChmSearchHit[] = []
  const htmlPaths = rec.paths.filter((p) => HTML_PAGE.test(p))

  for (const rawPath of htmlPaths) {
    if (hits.length >= maxResults) {
      break
    }
    const internal = normalizeChmInternalPath(rawPath)
    const buf = addon.readObject(sessionId, internal)
    if (!buf.ok || !buf.data) {
      continue
    }
    const html = decodeChmText(buf.data, readerEncodingPref, true)
    const text = stripHtmlToText(html)
    if (!text.toLowerCase().includes(qLower)) {
      continue
    }
    hits.push({
      path: internal,
      title: rec.pageTitles.get(internal) ?? titleFromPath(internal),
      snippet: makeSnippet(text, q),
    })
  }

  return hits
}
