import type { ChmTocItem } from '../src/shared/electron'
import { parseHhcToTree, type ReadChmObject } from './chm-hhc'

/** 将目录/索引树压平为字母索引列表（仅保留可跳转条目）。 */
export function flattenTocLinks(items: ChmTocItem[]): ChmTocItem[] {
  const out: ChmTocItem[] = []
  const walk = (nodes: ChmTocItem[]) => {
    for (const n of nodes) {
      if (n.path) {
        out.push({
          title: n.title,
          path: n.path,
          fragment: n.fragment,
        })
      }
      if (n.children?.length) {
        walk(n.children)
      }
    }
  }
  walk(items)
  return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

export function parseHhkToEntries(
  hhkHtml: string,
  hhkInternalPath: string,
  readObject: ReadChmObject,
  readerEncodingPref: string,
): ChmTocItem[] {
  const tree = parseHhcToTree(hhkHtml, hhkInternalPath, readObject, readerEncodingPref)
  return flattenTocLinks(tree)
}

export function pickFirstHhkPath(filePaths: string[]): string | null {
  const hhks = filePaths.filter((p) => /\.hhk$/i.test(p.replace(/\\/g, '/')))
  if (hhks.length === 0) {
    return null
  }
  const sorted = [...hhks].sort((a, b) => a.localeCompare(b))
  return sorted[0] ?? null
}
