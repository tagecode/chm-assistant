import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, FolderKanban } from 'lucide-react'
import type {
  AppMetadata,
  ChmOpenErrorCode,
  LocaleMode,
  PersistedWorkspaceTab,
  RecentEntry,
  ThemeMode,
} from '@/shared/electron'
import type { MessageKey } from '@/i18n/zh-Hans'
import type { ReaderUiState, WorkspaceTab } from '@/types/workspace'
import { AppDialogProvider, useAppDialog } from '@/components/app-dialog-provider'
import { I18nProvider, useI18n } from '@/i18n/i18n-context'
import { applyTheme } from '@/lib/theme'
import { buildWorkspaceSession } from '@/lib/reader-persist'
import {
  dedupeWorkspaceTabs,
  findTabByPath,
  formatWorkspaceTabLabel,
} from '@/lib/workspace-tabs'
import { Button } from '@/components/ui/button'
import { ChmOpeningOverlay } from '@/components/chm-loading-panel'
import {
  UnsavedChangesDialog,
} from '@/components/unsaved-changes-dialog'
import { HomeView } from '@/views/home-view'
import { ReaderView } from '@/views/reader-view'
import { ComposerView, type ComposerTabHandle } from '@/views/composer-view'
import { SettingsView } from '@/views/settings-view'
import { AboutView } from '@/views/about-view'
import { cn } from '@/lib/utils'

const CHM_OPEN_ERR: Record<ChmOpenErrorCode, MessageKey> = {
  NATIVE_MISSING: 'reader.error.nativeMissing',
  FS_INVALID: 'reader.error.fsInvalid',
  OPEN_FAILED: 'reader.error.openFailed',
  ENUM_FAILED: 'reader.error.enumFailed',
}

const browserMetadata: AppMetadata = {
  name: 'CHM Assistant',
  version: '0.1.0',
  electron: 'browser',
  chromium: 'n/a',
  node: 'n/a',
  platform: 'web',
  arch: 'n/a',
}

type Overlay = null | 'settings' | 'about'

async function restoreTab(
  p: PersistedWorkspaceTab,
): Promise<WorkspaceTab | null> {
  const api = window.electronAPI
  if (!api) return null
  if (p.kind === 'project') {
    return { id: p.id, kind: 'project', title: p.title, path: p.path }
  }
  const opened = await api.openChmSession(p.path)
  if (!opened.ok) return null
  return {
    id: p.id,
    kind: 'reader',
    title: opened.chmTitle || p.title,
    path: opened.path,
    chmTitle: opened.chmTitle,
    sessionId: opened.sessionId,
    entryInternalPath: opened.entryInternalPath,
    entryFragment: opened.entryFragment,
    toc: opened.toc,
    index: opened.index,
    readerUi: {
      currentPath: p.currentPath,
      currentFragment: p.currentFragment,
      sidePanel: p.sidePanel,
      zoomPercent: p.zoomPercent,
      widthMode: p.widthMode,
    },
  }
}

function AppInner() {
  const { t, setLocaleMode, localeMode } = useI18n()
  const dialog = useAppDialog()
  const [screen, setScreen] = useState<'home' | 'workspace'>('home')
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [metadata, setMetadata] = useState<AppMetadata>(browserMetadata)
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [readerEncoding, setReaderEncoding] = useState('auto')
  const [chmCompilerPath, setChmCompilerPath] = useState('')
  const [bootstrapped, setBootstrapped] = useState(false)
  const [closeTabPrompt, setCloseTabPrompt] = useState<{ tabId: string } | null>(null)
  const [chmOpening, setChmOpening] = useState<{
    filePath: string
    waitingTabId?: string
  } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composerHandles = useRef<Map<string, ComposerTabHandle>>(new Map())
  const tabsRef = useRef<WorkspaceTab[]>([])
  const chmOpeningWaitRef = useRef<string | null>(null)
  const chmOpeningResolveRef = useRef<(() => void) | null>(null)

  const activeTab = tabs.find((x) => x.id === activeTabId) ?? null

  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  const persistWorkspace = useCallback(
    (nextScreen: typeof screen, nextTabs: WorkspaceTab[], nextActiveId: string | null) => {
      const api = window.electronAPI
      if (!api) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const session = buildWorkspaceSession(nextScreen, nextActiveId, nextTabs)
        void api.setWorkspaceSession(session)
      }, 400)
    },
    [],
  )

  useEffect(() => {
    void (async () => {
      const api = window.electronAPI
      if (!api) {
        applyTheme('system')
        setBootstrapped(true)
        return
      }
      const [m, r, s, ws] = await Promise.all([
        api.getAppMetadata(),
        api.getRecent(),
        api.getSettings(),
        api.getWorkspaceSession(),
      ])
      setMetadata(m)
      setRecents(r)
      setTheme(s.theme)
      setReaderEncoding(s.readerEncoding)
      setChmCompilerPath(s.chmCompilerPath ?? '')
      setLocaleMode(s.locale)
      applyTheme(s.theme)

      if (ws?.tabs?.length) {
        const restored: WorkspaceTab[] = []
        for (const p of ws.tabs) {
          const tab = await restoreTab(p)
          if (tab) restored.push(tab)
        }
        if (restored.length > 0) {
          const platform = m.platform
          const deduped = dedupeWorkspaceTabs(restored, platform, (sessionId) => {
            void api.closeChmSession(sessionId)
          })
          setTabs(deduped)
          const aid =
            ws.activeTabId && deduped.some((x) => x.id === ws.activeTabId)
              ? ws.activeTabId
              : deduped[deduped.length - 1]?.id ?? null
          setActiveTabId(aid)
          setScreen(ws.screen === 'workspace' ? 'workspace' : 'home')
        }
      }
      setBootstrapped(true)
    })()
  }, [setLocaleMode])

  useEffect(() => {
    if (!bootstrapped) return
    persistWorkspace(screen, tabs, activeTabId)
  }, [screen, tabs, activeTabId, bootstrapped, persistWorkspace])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    return api.onMenuOpenChm(() => {
      void (async () => {
        const picked = await api.openChmDialog()
        if (picked) {
          document.dispatchEvent(new CustomEvent('chm-assistant:open-chm-path', { detail: picked }))
        }
      })()
    })
  }, [])

  const refreshRecent = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    setRecents(await api.getRecent())
  }, [])

  const activateOrOpenTab = useCallback(
    (tab: WorkspaceTab) => {
      const platform = metadata.platform
      setTabs((prev) => {
        const existing = findTabByPath(prev, tab.kind, tab.path, platform)
        if (existing) {
          if (
            tab.kind === 'reader' &&
            existing.kind === 'reader' &&
            tab.sessionId !== existing.sessionId
          ) {
            void window.electronAPI?.closeChmSession(tab.sessionId)
          }
          setActiveTabId(existing.id)
          return prev
        }
        setActiveTabId(tab.id)
        return [...prev, tab]
      })
      setScreen('workspace')
    },
    [metadata.platform],
  )

  const openReaderTab = useCallback(
    (tab: WorkspaceTab) => {
      activateOrOpenTab(tab)
    },
    [activateOrOpenTab],
  )

  const openProjectTab = useCallback(
    (tab: WorkspaceTab) => {
      activateOrOpenTab(tab)
    },
    [activateOrOpenTab],
  )

  const openChmFromPath = useCallback(
    async (filePath: string) => {
      const api = window.electronAPI
      if (!api) return
      const platform = metadata.platform
      const existing = findTabByPath(tabsRef.current, 'reader', filePath, platform)
      if (existing) {
        setActiveTabId(existing.id)
        setScreen('workspace')
        return
      }

      const displayName = filePath.split(/[/\\]/).pop() || filePath
      setChmOpening({ filePath: displayName })
      try {
        const opened = await api.openChmSession(filePath)
        if (!opened.ok) {
          await dialog.showAlert({
            titleKey: 'dialog.errorTitle',
            detail: t(CHM_OPEN_ERR[opened.code]),
          })
          return
        }

        const tabId = crypto.randomUUID()
        chmOpeningWaitRef.current = tabId
        setChmOpening({ filePath: displayName, waitingTabId: tabId })

        await api.addRecent({ type: 'chm', path: opened.path })
        await refreshRecent()
        openReaderTab({
          id: tabId,
          kind: 'reader',
          title: opened.path.split(/[/\\]/).pop() || 'file.chm',
          path: opened.path,
          chmTitle: opened.chmTitle,
          sessionId: opened.sessionId,
          entryInternalPath: opened.entryInternalPath,
          entryFragment: opened.entryFragment,
          toc: opened.toc,
          index: opened.index,
        })

        await new Promise<void>((resolve) => {
          chmOpeningResolveRef.current = resolve
          window.setTimeout(resolve, 20_000)
        })
      } finally {
        chmOpeningWaitRef.current = null
        chmOpeningResolveRef.current = null
        setChmOpening(null)
      }
    },
    [dialog, metadata.platform, openReaderTab, refreshRecent, t],
  )

  const handleReaderInitialPageReady = useCallback((tabId: string) => {
    if (chmOpeningWaitRef.current !== tabId) return
    chmOpeningWaitRef.current = null
    chmOpeningResolveRef.current?.()
    chmOpeningResolveRef.current = null
  }, [])

  const handleProjectTabTitle = useCallback((tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((x) => (x.id === tabId && x.kind === 'project' ? { ...x, title } : x)),
    )
  }, [])

  const registerComposerHandle = useCallback(
    (tabId: string, handle: ComposerTabHandle | null) => {
      if (handle) {
        composerHandles.current.set(tabId, handle)
      } else {
        composerHandles.current.delete(tabId)
      }
    },
    [],
  )

  const performCloseTab = useCallback((id: string) => {
    setTabs((prev) => {
      const v = prev.find((x) => x.id === id)
      if (v?.kind === 'reader') {
        void window.electronAPI?.closeChmSession(v.sessionId)
      }
      composerHandles.current.delete(id)
      const next = prev.filter((x) => x.id !== id)
      setActiveTabId((cur) => {
        if (cur !== id) return cur
        return next[next.length - 1]?.id ?? null
      })
      if (next.length === 0) {
        setScreen('home')
      }
      return next
    })
  }, [])

  const closeReaderTabsForChmPath = useCallback(
    (filePath: string) => {
      const platform = metadata.platform
      setTabs((prev) => {
        const removing = prev.filter(
          (t) =>
            t.kind === 'reader' &&
            findTabByPath([t], 'reader', filePath, platform) != null,
        )
        if (removing.length === 0) {
          return prev
        }
        for (const tab of removing) {
          if (tab.kind === 'reader') {
            void window.electronAPI?.closeChmSession(tab.sessionId)
          }
        }
        const removeIds = new Set(removing.map((t) => t.id))
        const next = prev.filter((t) => !removeIds.has(t.id))
        setActiveTabId((cur) => {
          if (cur && removeIds.has(cur)) {
            return next[next.length - 1]?.id ?? null
          }
          return cur
        })
        if (next.length === 0) {
          setScreen('home')
        }
        return next
      })
    },
    [metadata.platform],
  )

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    return api.onCloseChmForPath((filePath) => {
      closeReaderTabsForChmPath(filePath)
    })
  }, [closeReaderTabsForChmPath])

  const requestCloseTab = useCallback(
    (id: string) => {
      const victim = tabs.find((x) => x.id === id)
      if (!victim) return
      if (victim.kind === 'reader') {
        performCloseTab(id)
        return
      }
      const composer = composerHandles.current.get(id)
      if (composer?.isDirty()) {
        setCloseTabPrompt({ tabId: id })
        return
      }
      performCloseTab(id)
    },
    [tabs, performCloseTab],
  )

  const completeUnsavedClosePrompt = useCallback(
    async (action: 'cancel' | 'discard' | 'save') => {
      if (!closeTabPrompt) return
      const tabId = closeTabPrompt.tabId
      if (action === 'cancel') {
        setCloseTabPrompt(null)
        return
      }
      if (action === 'save') {
        const composer = composerHandles.current.get(tabId)
        const ok = await composer?.save()
        if (!ok) return
      }
      setCloseTabPrompt(null)
      performCloseTab(tabId)
    },
    [closeTabPrompt, performCloseTab],
  )

  const closeTab = requestCloseTab

  const handleReaderStateChange = useCallback(
    (
      tabId: string,
      patch: ReaderUiState,
    ) => {
      setTabs((prev) =>
        prev.map((x) =>
          x.id === tabId && x.kind === 'reader' ? { ...x, readerUi: patch } : x,
        ),
      )
    },
    [],
  )

  const handleClearRecent = useCallback(async () => {
    await window.electronAPI?.clearRecent()
    await refreshRecent()
  }, [refreshRecent])

  const handleThemeChange = useCallback(async (next: ThemeMode) => {
    setTheme(next)
    applyTheme(next)
    await window.electronAPI?.setTheme(next)
  }, [])

  const handleLocaleChange = useCallback(
    (next: LocaleMode) => {
      setLocaleMode(next)
    },
    [setLocaleMode],
  )

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('app.loading')}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
        <Button
          variant={screen === 'home' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setOverlay(null)
            setScreen('home')
          }}
        >
          {t('nav.home')}
        </Button>
        {screen === 'workspace' && tabs.length > 0 ? (
          <div className="ml-2 flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const TabIcon = tab.kind === 'reader' ? BookOpen : FolderKanban
              const label = formatWorkspaceTabLabel(tab)
              return (
              <button
                key={tab.id}
                type="button"
                title={tab.path}
                className={cn(
                  'flex max-w-[14rem] shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition',
                  tab.id === activeTabId
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-transparent bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setActiveTabId(tab.id)
                  setScreen('workspace')
                }}
              >
                <TabIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{label}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t('workspace.tabs.close')}
                  className="ml-0.5 shrink-0 rounded px-0.5 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation()
                    void closeTab(tab.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      void closeTab(tab.id)
                    }
                  }}
                >
                  ×
                </span>
              </button>
            )})}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('app.title')}</span>
        )}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOverlay('settings')}>
            {t('nav.settings')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOverlay('about')}>
            {t('nav.about')}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {overlay === 'settings' ? (
          <SettingsView
            theme={theme}
            onThemeChange={(x) => void handleThemeChange(x)}
            localeMode={localeMode}
            onLocaleChange={handleLocaleChange}
            readerEncoding={readerEncoding}
            onReaderEncodingChange={setReaderEncoding}
            chmCompilerPath={chmCompilerPath}
            onChmCompilerPathChange={setChmCompilerPath}
            onBack={() => setOverlay(null)}
          />
        ) : overlay === 'about' ? (
          <AboutView metadata={metadata} onBack={() => setOverlay(null)} />
        ) : screen === 'home' ? (
          <HomeView
            recents={recents}
            onOpenChmByPath={openChmFromPath}
            onOpenProjectTab={openProjectTab}
            onClearRecent={handleClearRecent}
            onRefreshRecent={refreshRecent}
          />
        ) : activeTab?.kind === 'reader' ? (
          <ReaderView
            tab={activeTab}
            readerEncoding={readerEncoding}
            onReaderStateChange={handleReaderStateChange}
            onInitialPageReady={handleReaderInitialPageReady}
          />
        ) : activeTab?.kind === 'project' ? (
          <ComposerView
            tab={activeTab}
            onOpenChm={(p) => void openChmFromPath(p)}
            onTabTitleChange={handleProjectTabTitle}
            onRegisterTabHandle={registerComposerHandle}
          />
        ) : (
          <HomeView
            recents={recents}
            onOpenChmByPath={openChmFromPath}
            onOpenProjectTab={openProjectTab}
            onClearRecent={handleClearRecent}
            onRefreshRecent={refreshRecent}
          />
        )}
      </main>

      <UnsavedChangesDialog
        open={closeTabPrompt != null}
        onOpenChange={(open) => {
          if (!open) setCloseTabPrompt(null)
        }}
        descriptionKey="workspace.tabs.confirmSaveBeforeClose"
        saveLabelKey="composer.saveAndClose"
        onCancel={() => setCloseTabPrompt(null)}
        onDiscard={() => void completeUnsavedClosePrompt('discard')}
        onSave={() => void completeUnsavedClosePrompt('save')}
      />

      {chmOpening ? (
        <ChmOpeningOverlay
          fileName={chmOpening.filePath}
          title={t(chmOpening.waitingTabId ? 'reader.openingPage' : 'reader.openingChm')}
          hint={t('reader.openingHint')}
        />
      ) : null}
    </div>
  )
}

interface AppRootProps {
  initialLocale: LocaleMode
}

export function AppRoot({ initialLocale }: AppRootProps) {
  return (
    <I18nProvider initialLocaleMode={initialLocale}>
      <AppDialogProvider>
        <AppInner />
      </AppDialogProvider>
    </I18nProvider>
  )
}
