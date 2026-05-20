interface MarkdownPreviewPaneProps {
  html: string
}

export function MarkdownPreviewPane({ html }: MarkdownPreviewPaneProps) {
  return (
    <iframe
      title="Markdown preview"
      className="h-full w-full border-0 bg-white dark:bg-zinc-950"
      sandbox="allow-same-origin"
      srcDoc={html}
    />
  )
}
