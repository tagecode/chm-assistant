import type { ChmTocItem } from '@/shared/electron'

export function findTocBreadcrumb(
  items: ChmTocItem[],
  currentPath: string,
  currentFragment: string,
): ChmTocItem[] {
  const wantPath = currentPath
  const wantFrag = currentFragment || ''
  const trail: ChmTocItem[] = []

  const walk = (nodes: ChmTocItem[]): boolean => {
    for (const n of nodes) {
      trail.push(n)
      const matchPath = n.path && n.path === wantPath
      const matchFrag = (n.fragment ?? '') === wantFrag
      if (matchPath && (wantFrag === '' || matchFrag)) {
        return true
      }
      if (n.children?.length && walk(n.children)) {
        return true
      }
      trail.pop()
    }
    return false
  }

  if (walk(items)) {
    return [...trail]
  }
  return []
}
