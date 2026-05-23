import type { ProjectTocNode } from '../../src/shared/project'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function flatten(nodes: ProjectTocNode[]): { title: string; mdPath: string }[] {
  const out: { title: string; mdPath: string }[] = []
  const walk = (list: ProjectTocNode[]) => {
    for (const n of list) {
      if (n.mdPath) {
        out.push({ title: n.title, mdPath: n.mdPath })
      }
      if (n.children?.length) {
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return out.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
}

export function generateHhk(
  toc: ProjectTocNode[],
  mdToHtmlRel: (mdPath: string) => string,
  opts?: { metaCharset?: string },
): string {
  const entries = flatten(toc)
  const items = entries
    .map((e) => {
      const local = mdToHtmlRel(e.mdPath)
      return `<LI><OBJECT type="text/sitemap">
    <param name="Name" value="${escapeHtml(e.title)}">
    <param name="Local" value="${escapeHtml(local)}">
  </OBJECT></LI>`
    })
    .join('\n')
  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<HTML>
<HEAD>
${navHeadMeta(opts?.metaCharset)}
</HEAD>
<BODY>
<UL>
${items}
</UL>
</BODY>
</HTML>
`
}

function navHeadMeta(charset?: string): string {
  const lines = ['<meta name="GENERATOR" content="CHM Assistant">']
  lines.unshift(`<meta http-equiv="Content-Type" content="text/html; charset=${charset ?? 'UTF-8'}">`)
  return lines.join('\n')
}

