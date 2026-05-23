import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Copy, Minus, Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ChmLoadingPanel } from '@/components/chm-loading-panel'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import type { MessageKey } from '@/i18n/zh-Hans'
import { buildChmPageUrl } from '@/lib/chm-url'
import { clearFindInChmIframe, findInChmIframe, previewFindInChmIframe } from '@/lib/find-in-chm-iframe'
import { findTocBreadcrumb } from '@/lib/toc-utils'
import { cn } from '@/lib/utils'
import type { ChmSearchHit, ChmTocItem, ReaderSidePanel, ReaderWidthMode } from '@/shared/electron'
import type { ReaderUiState, WorkspaceTab } from '@/types/workspace'

const SIDE_PANELS: ReaderSidePanel[] = ['toc', 'index', 'search', 'bookmarks']

function clampZoom(n: number) {
  return Math.min(500, Math.max(25, n))
}

function defaultReaderUi(tab: WorkspaceTab & { kind: 'reader' }) {
  return (
    tab.readerUi ?? {
      currentPath: tab.entryInternalPath,
      currentFragment: tab.entryFragment,
      sidePanel: 'toc' as ReaderSidePanel,
      zoomPercent: 100,
      widthMode: 'full' as ReaderWidthMode,
    }
  )
}

function TocTree({
  items,
  depth,
  currentPath,
  currentFragment,
  onPick,
}: {
  items: ChmTocItem[]
  depth: number
  currentPath: string
  currentFragment: string
  onPick: (item: ChmTocItem) => void
}) {
  return (
    <ul
      className={cn(
        'space-y-0.5',
        depth > 0 && 'ml-2 border-l border-border/50 pl-2',
      )}
    >
      {items.map((item, idx) => {
        const active =
          Boolean(item.path) &&
          item.path === currentPath &&
          (item.fragment ?? '') === (currentFragment || '')
        return (
          <li key={`${depth}-${idx}-${item.path}-${item.title}`}>
            {item.path ? (
              <button
                type="button"
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-xs transition',
                  active
                    ? 'bg-primary/15 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                onClick={() => onPick(item)}
              >
                {item.title}
              </button>
            ) : (
              <span className="block px-2 py-1.5 text-left text-xs font-medium text-foreground/80">
                {item.title}
              </span>
            )}
            {item.children?.length ? (
              <TocTree
                items={item.children}
                depth={depth + 1}
                currentPath={currentPath}
                currentFragment={currentFragment}
                onPick={onPick}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function IndexList({
  items,
  currentPath,
  currentFragment,
  onPick,
}: {
  items: ChmTocItem[]
  currentPath: string
  currentFragment: string
  onPick: (item: ChmTocItem) => void
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, idx) => {
        const active =
          item.path === currentPath && (item.fragment ?? '') === (currentFragment || '')
        return (
          <li key={`idx-${idx}-${item.path}-${item.title}`}>
            <button
              type="button"
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-xs transition',
                active
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              onClick={() => onPick(item)}
            >
              {item.title}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FindBar({
  t,
  findQuery,
  setFindQuery,
  findInputRef,
  runFind,
  onClose,
}: {
  t: (k: MessageKey) => string
  findQuery: string
  setFindQuery: (s: string) => void
  findInputRef: React.RefObject<HTMLInputElement | null>
  runFind: (forward: boolean) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
      <Input
        ref={findInputRef}
        className="h-8 max-w-md flex-1 text-sm"
        placeholder={t('reader.findPlaceholder')}
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') runFind(!e.shiftKey)
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => runFind(false)}>
        {t('reader.findPrev')}
      </Button>
      <Button type="button" size="sm" onClick={() => runFind(true)}>
        {t('reader.findNext')}
      </Button>
      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

function SearchPanel({
  t,
  searchQuery,
  setSearchQuery,
  searchBusy,
  searchHits,
  runFullSearch,
  openSearchHit,
}: {
  t: (k: MessageKey) => string
  searchQuery: string
  setSearchQuery: (s: string) => void
  searchBusy: boolean
  searchHits: ChmSearchHit[]
  runFullSearch: () => void
  openSearchHit: (hit: ChmSearchHit) => void
}) {
  return (
    <div className="space-y-2">
      <SearchQueryForm
        t={t}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchBusy={searchBusy}
        runFullSearch={runFullSearch}
      />
      {searchBusy ? (
        <p className="text-xs text-muted-foreground">{t('reader.searchScanning')}</p>
      ) : searchHits.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('reader.searchEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {searchHits.map((hit) => (
            <li key={`${hit.path}-${hit.title}`}>
              <button
                type="button"
                className="w-full rounded-md border border-border/50 px-2 py-2 text-left transition hover:bg-muted/50"
                onClick={() => openSearchHit(hit)}
              >
                <p className="text-xs font-medium">{hit.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {hit.snippet}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchQueryForm({
  t,
  searchQuery,
  setSearchQuery,
  searchBusy,
  runFullSearch,
}: {
  t: (k: MessageKey) => string
  searchQuery: string
  setSearchQuery: (s: string) => void
  searchBusy: boolean
  runFullSearch: () => void
}) {
  return (
    <div className="flex gap-1">
      <Input
        className="h-8 text-xs"
        placeholder={t('reader.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void runFullSearch()
        }}
      />
      <Button
        type="button"
        size="sm"
        className="h-8 shrink-0"
        disabled={searchBusy}
        onClick={() => void runFullSearch()}
      >
        {searchBusy ? t('reader.searchScanning') : t('reader.searchGo')}
      </Button>
    </div>
  )
}

export function ReaderView({
  tab,
  readerEncoding,
  onReaderStateChange,
  onInitialPageReady,
}: {
  tab: WorkspaceTab & { kind: 'reader' }
  readerEncoding: string
  onReaderStateChange: (tabId: string, patch: ReaderUiState) => void
  onInitialPageReady?: (tabId: string) => void
}) {
  const { t } = useI18n()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initial = defaultReaderUi(tab)
  const [side, setSide] = useState<ReaderSidePanel>(initial.sidePanel)
  const [currentPath, setCurrentPath] = useState(initial.currentPath)
  const [currentFragment, setCurrentFragment] = useState(initial.currentFragment ?? '')
  const [zoomPercent, setZoomPercent] = useState(initial.zoomPercent)
  const [widthMode, setWidthMode] = useState<ReaderWidthMode>(initial.widthMode)

  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const findInputRef = useRef<HTMLInputElement>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchHits, setSearchHits] = useState<ChmSearchHit[]>([])
  const [pendingFind, setPendingFind] = useState<string | null>(null)
  const searchSeqRef = useRef(0)
  const [pageLoading, setPageLoading] = useState(true)
  const initialPageReadyRef = useRef(false)

  const pushState = useCallback(
    (patch: Partial<ReaderUiState>) => {
      onReaderStateChange(tab.id, {
        currentPath: patch.currentPath ?? currentPath,
        currentFragment: patch.currentFragment ?? currentFragment,
        sidePanel: patch.sidePanel ?? side,
        zoomPercent: patch.zoomPercent ?? zoomPercent,
        widthMode: patch.widthMode ?? widthMode,
      })
    },
    [currentFragment, currentPath, onReaderStateChange, side, tab.id, widthMode, zoomPercent],
  )

  useEffect(() => {
    pushState({})
  }, [currentPath, currentFragment, side, zoomPercent, widthMode, pushState])

  useEffect(() => {
    const ui = defaultReaderUi(tab)
    setCurrentPath(ui.currentPath)
    setCurrentFragment(ui.currentFragment ?? '')
    setSide(ui.sidePanel)
    setZoomPercent(ui.zoomPercent)
    setWidthMode(ui.widthMode)
    setPageLoading(true)
    initialPageReadyRef.current = false
  }, [tab.sessionId])

  const frameSrc = buildChmPageUrl(tab.sessionId, currentPath, currentFragment || undefined)

  useEffect(() => {
    setPageLoading(true)
  }, [frameSrc])

  const syncFromIframe = useCallback(() => {
    const w = iframeRef.current?.contentWindow
    if (!w) return
    try {
      const u = new URL(w.location.href)
      if (u.protocol !== 'chm:' || u.hostname !== tab.sessionId) return
      setCurrentPath(decodeURIComponent(u.pathname) || '/')
      setCurrentFragment(u.hash.startsWith('#') ? u.hash.slice(1) : u.hash)
    } catch {
      /* 导航中 */
    }
  }, [tab.sessionId])

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return
    const fn = () => {
      syncFromIframe()
      setPageLoading(false)
      if (!initialPageReadyRef.current) {
        initialPageReadyRef.current = true
        onInitialPageReady?.(tab.id)
      }
      if (pendingFind) {
        const q = pendingFind
        setPendingFind(null)
        window.setTimeout(() => {
          findInChmIframe(el, q, true)
        }, 50)
      }
    }
    el.addEventListener('load', fn)
    return () => el.removeEventListener('load', fn)
  }, [syncFromIframe, frameSrc, pendingFind, onInitialPageReady, tab.id])

  const onTocPick = useCallback((item: ChmTocItem) => {
    if (!item.path) return
    setCurrentPath(item.path)
    setCurrentFragment(item.fragment ?? '')
  }, [])

  const runFind = useCallback(
    (forward: boolean) => {
      const q = findQuery.trim()
      if (!q) return
      findInChmIframe(iframeRef.current, q, forward)
    },
    [findQuery],
  )

  const toggleFindBar = useCallback(() => {
    setFindOpen((open) => {
      const next = !open
      if (next) {
        window.setTimeout(() => findInputRef.current?.focus(), 0)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
        window.setTimeout(() => findInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && findOpen) setFindOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [findOpen])

  useEffect(() => {
    if (!findOpen) return
    const q = findQuery.trim()
    const timer = window.setTimeout(() => {
      if (!q) {
        clearFindInChmIframe(iframeRef.current)
        return
      }
      previewFindInChmIframe(iframeRef.current, q)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [findQuery, findOpen])

  useEffect(() => {
    if (!findOpen) {
      clearFindInChmIframe(iframeRef.current)
    }
  }, [findOpen])

  useEffect(() => {
    return () => clearFindInChmIframe(iframeRef.current)
  }, [frameSrc])

  const runFullSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q || !window.electronAPI) {
      setSearchHits([])
      return
    }
    const seq = ++searchSeqRef.current
    setSearchBusy(true)
    setSearchHits([])
    try {
      const hits = await window.electronAPI.searchChmSession(tab.sessionId, q)
      if (seq !== searchSeqRef.current) return
      setSearchHits(hits)
    } finally {
      if (seq === searchSeqRef.current) {
        setSearchBusy(false)
      }
    }
  }, [searchQuery, tab.sessionId])

  useEffect(() => {
    searchSeqRef.current += 1
    setSearchBusy(false)
    setSearchHits([])
  }, [tab.sessionId])

  const openSearchHit = useCallback(
    (hit: ChmSearchHit) => {
      setCurrentPath(hit.path)
      setCurrentFragment('')
      if (searchQuery.trim()) setPendingFind(searchQuery.trim())
    },
    [searchQuery],
  )

  const copyFromReader = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const win = iframeRef.current?.contentWindow
    let text = ''
    try {
      const sel = win?.getSelection()?.toString().trim()
      if (sel) {
        text = sel
      }
    } catch {
      /* cross-origin unlikely on chm: */
    }
    if (!text) {
      const res = await api.readChmPagePlainText(tab.sessionId, currentPath)
      if (!res.ok) {
        window.alert(t('reader.copyFailed'))
        return
      }
      text = res.text
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.alert(t('reader.copyFailed'))
      return
    }
  }, [currentPath, t, tab.sessionId])

  const sideLabel = (key: ReaderSidePanel) => {
    const map: Record<ReaderSidePanel, MessageKey> = {
      toc: 'reader.side.toc',
      index: 'reader.side.index',
      search: 'reader.side.search',
      bookmarks: 'reader.side.bookmarks',
    }
    return t(map[key])
  }

  const breadcrumb = findTocBreadcrumb(tab.toc, currentPath, currentFragment)
  const zoomStyle: CSSProperties = { zoom: `${zoomPercent}%` }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col border-t border-border/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-2 py-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t('reader.nav.back')}
            onClick={() => iframeRef.current?.contentWindow?.history.back()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t('reader.nav.forward')}
            onClick={() => iframeRef.current?.contentWindow?.history.forward()}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setZoomPercent(clampZoom(zoomPercent - 10))}
            aria-label={t('reader.zoom.out')}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums">{zoomPercent}%</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setZoomPercent(clampZoom(zoomPercent + 10))}
            aria-label={t('reader.zoom.in')}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            type="button"
            variant={widthMode === 'fit' ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setWidthMode('fit')}
          >
            {t('reader.width.fit')}
          </Button>
          <Button
            type="button"
            variant={widthMode === 'full' ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setWidthMode('full')}
          >
            {t('reader.width.full')}
          </Button>
        </div>
        <Button
          type="button"
          variant={findOpen ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1 text-xs"
          aria-pressed={findOpen}
          onClick={toggleFindBar}
        >
          <Search className="size-3.5" />
          {t('reader.find')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          title={t('reader.copyPage')}
          onClick={() => void copyFromReader()}
        >
          <Copy className="size-3.5" />
          {t('reader.copy')}
        </Button>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {tab.chmTitle ? (
            <span className="font-medium text-foreground">{tab.chmTitle}</span>
          ) : null}
          {breadcrumb.length > 0 ? (
            <span className="ml-1">
              {breadcrumb.map((b, i) => (
                <span key={`${b.path}-${b.title}-${i}`}>
                  {i > 0 ? <span className="mx-1 text-border">›</span> : null}
                  {b.title}
                </span>
              ))}
            </span>
          ) : (
            <span className="ml-1 break-all">
              {currentPath}
              {currentFragment ? `#${currentFragment}` : ''}
            </span>
          )}
        </div>
      </div>

      {findOpen ? (
        <FindBar
          t={t}
          findQuery={findQuery}
          setFindQuery={setFindQuery}
          findInputRef={findInputRef}
          runFind={runFind}
          onClose={() => setFindOpen(false)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-muted/20">
          <SidePanelTabs
            side={side}
            sideLabel={sideLabel}
            onSideChange={(key: ReaderSidePanel) => {
              setSide(key)
              pushState({ sidePanel: key })
            }}
          />
          <div className="flex-1 overflow-auto p-3 text-sm">
            {side === 'toc' ? (
              tab.toc.length === 0 ? (
                <p className="text-muted-foreground">{t('reader.tocEmpty')}</p>
              ) : (
                <TocTree
                  items={tab.toc}
                  depth={0}
                  currentPath={currentPath}
                  currentFragment={currentFragment}
                  onPick={onTocPick}
                />
              )
            ) : side === 'index' ? (
              tab.index.length === 0 ? (
                <p className="text-muted-foreground">{t('reader.indexEmpty')}</p>
              ) : (
                <IndexList
                  items={tab.index}
                  currentPath={currentPath}
                  currentFragment={currentFragment}
                  onPick={onTocPick}
                />
              )
            ) : side === 'search' ? (
              <SearchPanel
                t={t}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchBusy={searchBusy}
                searchHits={searchHits}
                runFullSearch={runFullSearch}
                openSearchHit={openSearchHit}
              />
            ) : (
              <p className="text-muted-foreground">{t('reader.placeholder.bookmarks')}</p>
            )}
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div
            className={cn(
              'mx-auto flex h-full min-h-0 w-full flex-col p-4',
              widthMode === 'fit' ? 'max-w-4xl' : 'max-w-none',
            )}
          >
            <div className="relative flex min-h-0 flex-1 flex-col" style={zoomStyle}>
              {pageLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-[1px]">
                  <ChmLoadingPanel
                    title={t('reader.openingPage')}
                    fileName={tab.title}
                    className="py-4"
                  />
                </div>
              ) : null}
              <iframe
                ref={iframeRef}
                key={`${tab.sessionId}:${readerEncoding}:${currentPath}#${currentFragment}`}
                title={t('reader.frameTitle')}
                className={cn(
                  'min-h-0 flex-1 w-full border-0 bg-background transition-opacity duration-200',
                  pageLoading ? 'opacity-0' : 'opacity-100',
                )}
                src={frameSrc}
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SidePanelTabs({
  side,
  sideLabel,
  onSideChange,
}: {
  side: ReaderSidePanel
  sideLabel: (k: ReaderSidePanel) => string
  onSideChange: (k: ReaderSidePanel) => void
}) {
  return (
    <div className="flex border-b border-border/60 text-xs font-medium">
      {SIDE_PANELS.map((key) => (
        <button
          key={key}
          type="button"
          className={cn(
            'flex-1 px-1 py-2 transition',
            side === key
              ? 'border-b-2 border-primary bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onSideChange(key)}
        >
          {sideLabel(key)}
        </button>
      ))}
    </div>
  )
}
