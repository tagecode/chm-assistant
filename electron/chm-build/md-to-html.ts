import MarkdownIt from 'markdown-it'

import {
  decodeResourceRef,
  resolveProjectResourceRef,
} from '../project-resources'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

export function markdownToHtmlBody(source: string): string {
  return md.render(source)
}

function applyBuildResourcePaths(
  markdown: string,
  rootPath: string,
  mdRel: string,
  pathMap: Map<string, string>,
): string {
  const renderer = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  })
  const defaultImage =
    renderer.renderer.rules.image ??
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options))
  const defaultLinkOpen =
    renderer.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options))

  const rewriteLocalRef = (href: string): string | null => {
    const ref = decodeResourceRef(href)
    if (
      !ref ||
      /^https?:/i.test(ref) ||
      ref.startsWith('data:') ||
      ref.startsWith('#') ||
      ref.startsWith('mailto:')
    ) {
      return null
    }
    const resolved = resolveProjectResourceRef(rootPath, mdRel, ref)
    if (!resolved) {
      return null
    }
    return pathMap.get(resolved.replace(/\\/g, '/')) ?? null
  }

  renderer.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') ?? ''
    const buildRef = rewriteLocalRef(src)
    if (buildRef) {
      token.attrSet('src', buildRef)
    }
    return defaultImage(tokens, idx, options, env, self)
  }

  renderer.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const href = token.attrGet('href') ?? ''
    const buildRef = rewriteLocalRef(href)
    if (buildRef) {
      token.attrSet('href', buildRef)
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  return renderer.render(markdown)
}

export function markdownToCompileHtmlBody(
  source: string,
  rootPath: string,
  mdRel: string,
  pathMap: Map<string, string>,
): string {
  return applyBuildResourcePaths(source, rootPath, mdRel, pathMap)
}

export function wrapHtmlDocument(
  title: string,
  bodyHtml: string,
  baseHref?: string,
): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const safeBase = baseHref
    ? baseHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    : ''
  const baseTag = safeBase ? `<base href="${safeBase}">\n` : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseTag}<title>${safeTitle}</title>
<style>
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; margin: 1.5rem; max-width: 52rem; }
img { max-width: 100%; height: auto; }
pre { overflow-x: auto; padding: 0.75rem; background: #f4f4f5; border-radius: 6px; }
code { font-family: ui-monospace, monospace; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 0.35rem 0.6rem; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
}

