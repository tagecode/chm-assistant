import type { ProjectTocNode } from '../../src/shared/project'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderUl(nodes: ProjectTocNode[], mdToHtml: (mdPath: string) => string): string {
  if (nodes.length === 0) {
    return ''
  }
  const items = nodes
    .map((node) => {
      const name = escapeHtml(node.title)
      let inner = ''
      if (node.mdPath) {
        const local = mdToHtml(node.mdPath)
        inner = `<OBJECT type="text/sitemap">
    <param name="Name" value="${name}">
    <param name="Local" value="${escapeHtml(local)}">
  </OBJECT>`
      } else {
        inner = `<OBJECT type="text/sitemap">
    <param name="Name" value="${name}">
  </OBJECT>`
      }
      const nested = node.children?.length
        ? renderUl(node.children, mdToHtml)
        : ''
      return `<LI>${inner}${nested}</LI>`
    })
    .join('\n')
  return `<UL>\n${items}\n</UL>`
}

function navHeadMeta(charset?: string): string {
  const lines = ['<meta name="GENERATOR" content="CHM Assistant">']
  lines.unshift(`<meta http-equiv="Content-Type" content="text/html; charset=${charset ?? 'UTF-8'}">`)
  return lines.join('\n')
}

export function generateHhc(
  toc: ProjectTocNode[],
  mdToHtmlRel: (mdPath: string) => string,
  opts?: { metaCharset?: string },
): string {
  const body = renderUl(toc, mdToHtmlRel)
  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<HTML>
<HEAD>
${navHeadMeta(opts?.metaCharset)}
</HEAD>
<BODY>
${body || '<UL></UL>'}
</BODY>
</HTML>
`
}

