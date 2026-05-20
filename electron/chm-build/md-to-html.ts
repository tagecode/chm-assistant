import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

export function markdownToHtmlBody(source: string): string {
  return md.render(source)
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

