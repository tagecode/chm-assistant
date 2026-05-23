import path from 'node:path'

import { parse, type HTMLElement } from 'node-html-parser'

import type { ChmTocItem } from '../src/shared/electron'
import { decodeChmNavText } from './chm-text'
import { normalizeChmInternalPath } from './chm-path'

export interface ReadChmObject {
  (internalPath: string): Buffer | null
}

function splitPathAndFragment(local: string): { file: string; fragment?: string } {
  const s = local.replace(/\\/g, '/')
  const hash = s.indexOf('#')
  if (hash < 0) {
    return { file: s }
  }
  return {
    file: s.slice(0, hash),
    fragment: s.slice(hash + 1) || undefined,
  }
}

function posixDir(p: string): string {
  const x = normalizeChmInternalPath(p)
  const d = path.posix.dirname(x)
  return d === '.' ? '/' : d
}

function resolveLocalToInternal(hhcInternalPath: string, localRaw: string): { path: string; fragment?: string } {
  const { file, fragment } = splitPathAndFragment(localRaw.trim())
  if (!file) {
    return { path: '', fragment }
  }
  const dir = posixDir(hhcInternalPath)
  let joined: string
  if (file.startsWith('/')) {
    joined = path.posix.normalize(file)
  } else {
    joined = path.posix.normalize(path.posix.join(dir === '/' ? '/' : dir, file))
  }
  if (!joined.startsWith('/')) {
    joined = `/${joined}`
  }
  return { path: normalizeChmInternalPath(joined), fragment }
}

function readParams(obj: HTMLElement): { name?: string; local?: string; merge?: string; url?: string } {
  const o: { name?: string; local?: string; merge?: string; url?: string } = {}
  for (const ch of obj.childNodes) {
    if (ch.nodeType !== 1) {
      continue
    }
    const el = ch as HTMLElement
    if (el.tagName?.toLowerCase() !== 'param') {
      continue
    }
    const pn = el.getAttribute('name')?.toLowerCase()
    const val = el.getAttribute('value') ?? ''
    if (pn === 'name') {
      o.name = val
    } else if (pn === 'local') {
      o.local = val
    } else if (pn === 'merge') {
      o.merge = val
    } else if (pn === 'url') {
      o.url = val
    }
  }
  return o
}

function isSitemapObject(el: HTMLElement): boolean {
  const t = (el.getAttribute('type') ?? '').toLowerCase().replace(/\s+/g, '')
  return t.includes('text/sitemap')
}

function walkUl(
  ul: HTMLElement,
  hhcInternalPath: string,
  readObject: ReadChmObject,
  readerEncodingPref: string,
): ChmTocItem[] {
  const out: ChmTocItem[] = []
  for (const li of ul.childNodes) {
    if (li.nodeType !== 1) {
      continue
    }
    if ((li as HTMLElement).tagName?.toLowerCase() !== 'li') {
      continue
    }
    const itemEl = li as HTMLElement
    let objParams: ReturnType<typeof readParams> | null = null
    let nestedUl: HTMLElement | null = null
    for (const ch of itemEl.childNodes) {
      if (ch.nodeType !== 1) {
        continue
      }
      const el = ch as HTMLElement
      const tag = el.tagName?.toLowerCase()
      if (tag === 'object' && isSitemapObject(el)) {
        objParams = readParams(el)
      } else if (tag === 'ul') {
        nestedUl = el
      }
    }
    const merged: ChmTocItem[] = []
    if (objParams?.merge) {
      const { path: mergePath } = resolveLocalToInternal(hhcInternalPath, objParams.merge)
      const mb = readObject(mergePath)
      if (mb) {
        const html = decodeChmNavText(mb, readerEncodingPref)
        merged.push(...parseHhcToTree(html, mergePath, readObject, readerEncodingPref))
      }
    }
    let pathStr = ''
    let fragment: string | undefined
    const title = objParams?.name?.trim() ?? ''
    if (objParams?.local) {
      const r = resolveLocalToInternal(hhcInternalPath, objParams.local)
      pathStr = r.path
      fragment = r.fragment
    }
    const nested = nestedUl ? walkUl(nestedUl, hhcInternalPath, readObject, readerEncodingPref) : []
    const children = [...nested, ...merged]
    if (children.length === 0 && !pathStr && !title.trim()) {
      continue
    }
    const node: ChmTocItem = {
      title: title.trim() || (pathStr ? path.posix.basename(pathStr) : '…'),
      path: pathStr,
      fragment,
      children: children.length > 0 ? children : undefined,
    }
    out.push(node)
  }
  return out
}

export function parseHhcToTree(
  hhcHtml: string,
  hhcInternalPath: string,
  readObject: ReadChmObject,
  readerEncodingPref: string,
): ChmTocItem[] {
  const root = parse(hhcHtml, { lowerCaseTagName: true })
  const firstUl = root.querySelector('ul')
  if (!firstUl) {
    return []
  }
  return walkUl(firstUl as HTMLElement, hhcInternalPath, readObject, readerEncodingPref)
}

export function pickFirstHhcPath(filePaths: string[]): string | null {
  const hhcs = filePaths.filter((p) => /\.hhc$/i.test(p.replace(/\\/g, '/')))
  if (hhcs.length === 0) {
    return null
  }
  const sorted = [...hhcs].sort((a, b) => a.localeCompare(b))
  return sorted[0] ?? null
}
