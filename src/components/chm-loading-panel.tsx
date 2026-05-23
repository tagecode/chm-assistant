import { BookOpen, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ChmLoadingPanel({
  title,
  fileName,
  hint,
  className,
}: {
  title: string
  fileName?: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center gap-5 px-6 py-8 text-center', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex size-[4.5rem] items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
        <BookOpen className="size-8 text-primary/85" aria-hidden />
        <Loader2
          className="absolute -right-0.5 -top-0.5 size-6 animate-spin text-primary"
          aria-hidden
        />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {fileName ? (
          <p className="truncate text-xs text-muted-foreground" title={fileName}>
            {fileName}
          </p>
        ) : null}
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground/90">{hint}</p> : null}
      </div>
      <div className="h-1 w-52 overflow-hidden rounded-full bg-muted">
        <div className="chm-loading-bar h-full w-2/5 rounded-full bg-primary/80" />
      </div>
    </div>
  )
}

export function ChmOpeningOverlay({
  fileName,
  title,
  hint,
}: {
  fileName: string
  title: string
  hint?: string
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 backdrop-blur-sm"
      aria-modal="true"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card/95 shadow-lg">
        <ChmLoadingPanel title={title} fileName={fileName} hint={hint} />
      </div>
    </div>
  )
}
