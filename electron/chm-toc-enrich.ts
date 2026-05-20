import path from 'node:path'

import type { ChmTocItem } from '../src/shared/electron'
import type { ReadChmObject } from './chm-hhc'
import { normalizeChmInternalPath } from './chm-path'
import { decodeChmText, extractHtmlTitle } from './chm-text'

function basename(pathStr: string): string {
  return path.posix.basename(pathStr.replace(/\\/g, '/'))
}

/** 判断目录项标题是否只是文件名占位（需要从 HTML 补全）。 */
export function looksLikeFilenameTitle(title: string, pathStr: string): boolean {
  const trimmed = title.trim()
  if (!trimmed) {
    return true
  }
  if (/\.(html?|xhtml)$/i.test(trimmed)) {
    return true
  }
  if (!pathStr) {
    return false
  }
  const base = basename(pathStr)
  return trimmed === base || trimmed.toLowerCase() === base.toLowerCase()
}

function humanizeFilename(pathStr: string): string {
  const base = basename(pathStr)
  const withoutExt = base.replace(/\.(html?|xhtml)$/i, '')
  const pretty = withoutExt.replace(/[_-]+/g, ' ').trim()
  return pretty || base
}

function resolvePageTitle(
  pathStr: string,
  currentTitle: string,
  readObject: ReadChmObject,
  readerEncodingPref: string,
  titleCache: Map<string, string>,
): string {
  const norm = normalizeChmInternalPath(pathStr)
  const cached = titleCache.get(norm)
  if (cached) {
    return cached
  }

  if (!looksLikeFilenameTitle(currentTitle, pathStr)) {
    titleCache.set(norm, currentTitle.trim())
    return currentTitle.trim()
  }

  const buf = readObject(pathStr)
  if (buf) {
    const head = buf.subarray(0, Math.min(buf.length, 65536))
    const html = decodeChmText(head, readerEncodingPref, true)
    const extracted = extractHtmlTitle(html)
    if (extracted && !looksLikeFilenameTitle(extracted, pathStr)) {
      titleCache.set(norm, extracted)
      return extracted
    }
  }

  const fallback = humanizeFilename(pathStr)
  titleCache.set(norm, fallback)
  return fallback
}

function walkEnrich(
  items: ChmTocItem[],
  readObject: ReadChmObject,
  readerEncodingPref: string,
  titleCache: Map<string, string>,
): ChmTocItem[] {
  return items.map((item) => {
    const title =
      item.path && item.path.trim()
        ? resolvePageTitle(item.path, item.title, readObject, readerEncodingPref, titleCache)
        : item.title.trim()
    return {
      ...item,
      title,
      children: item.children?.length
        ? walkEnrich(item.children, readObject, readerEncodingPref, titleCache)
        : undefined,
    }
  })
}

/** 用 HTML 页面标题补全目录/索引中仅显示文件名的条目，并写入 titleCache。 */
export function enrichTocTitles(
  items: ChmTocItem[],
  readObject: ReadChmObject,
  readerEncodingPref: string,
  titleCache: Map<string, string>,
): ChmTocItem[] {
  if (items.length === 0) {
    return items
  }
  return walkEnrich(items, readObject, readerEncodingPref, titleCache)
}
