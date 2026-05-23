import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Columns2,
  FilePlus,
  Hammer,
  ImagePlus,
  RefreshCw,
  Save,
  Settings2,
} from 'lucide-react'

import {
  ComposerEditor,
  type ComposerEditorHandle,
} from '@/components/composer/composer-editor'
import { MarkdownPreviewPane } from '@/components/composer/markdown-preview-pane'
import { ProjectTree } from '@/components/composer/project-tree'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import { promptCompilerMissing } from '@/lib/compiler-ui'
import { cn } from '@/lib/utils'
import type { ChmProjectConfig, CompileLogLine, ProjectTocNode, TocMovePlacement } from '@/shared/project'
import type { WorkspaceTab } from '@/types/workspace'

function firstMdInToc(nodes: ProjectTocNode[]): string | null {
  for (const n of nodes) {
    if (n.mdPath) return n.mdPath
    if (n.children?.length) {
      const hit = firstMdInToc(n.children)
      if (hit) return hit
    }
  }
  return null
}

function logSourceToMd(sourcePath?: string): string | undefined {
  if (!sourcePath) return undefined
  const p = sourcePath.replace(/\\/g, '/')
  if (/\.md$/i.test(p)) return p
  if (/\.html?$/i.test(p)) return p.replace(/\.html?$/i, '.md')
  return p
}

export interface ComposerTabHandle {
  isDirty: () => boolean
  save: () => Promise<boolean>
}

interface ComposerViewProps {
  tab: WorkspaceTab & { kind: 'project' }
  onOpenChm: (filePath: string) => void
  onTabTitleChange?: (tabId: string, title: string) => void
  onRegisterTabHandle?: (tabId: string, handle: ComposerTabHandle | null) => void
}

export function ComposerView({
  tab,
  onOpenChm,
  onTabTitleChange,
  onRegisterTabHandle,
}: ComposerViewProps) {
  const { t } = useI18n()
  const editorRef = useRef<ComposerEditorHandle>(null)
  const pendingRevealLine = useRef<number | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [config, setConfig] = useState<ChmProjectConfig | null>(null)
  const [activeMdPath, setActiveMdPath] = useState<string | null>(null)
  const [editorReadyPath, setEditorReadyPath] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [compileLogs, setCompileLogs] = useState<CompileLogLine[]>([])
  const [showCompile, setShowCompile] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [previewHtml, setPreviewHtml] = useState('')
  const [metaOpen, setMetaOpen] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPagePath, setNewPagePath] = useState('page.md')
  const [lastImportSnippets, setLastImportSnippets] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameNode, setRenameNode] = useState<ProjectTocNode | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameMdPath, setRenameMdPath] = useState('')
  const [leavePrompt, setLeavePrompt] = useState<{ targetMdPath: string } | null>(null)

  const rootPath = tab.path

  useEffect(() => {
    const api = window.electronAPI
    if (!api) {
      setLoadError(t('composer.error.noElectron'))
      return
    }
    void (async () => {
      const loaded = await api.loadProject(rootPath)
      if (!loaded.ok) {
        setLoadError(loaded.message)
        return
      }
      setConfig(loaded.config)
      setActiveMdPath(loaded.activeMdPath)
      onTabTitleChange?.(tab.id, loaded.config.title)
    })()
  }, [rootPath, tab.id, onTabTitleChange, t])

  useEffect(() => {
    const api = window.electronAPI
    if (!api || !activeMdPath) {
      setEditorReadyPath(null)
      return
    }
    let cancelled = false
    setEditorReadyPath(null)
    void (async () => {
      const res = await api.readProjectMarkdown(rootPath, activeMdPath)
      if (cancelled) return
      if (res.ok && res.content != null) {
        setEditorValue(res.content)
        setDirty(false)
        setEditorReadyPath(activeMdPath)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeMdPath, rootPath])

  useEffect(() => {
    if (
      pendingRevealLine.current != null &&
      activeMdPath &&
      editorReadyPath === activeMdPath
    ) {
      const line = pendingRevealLine.current
      pendingRevealLine.current = null
      requestAnimationFrame(() => editorRef.current?.revealLine(line))
    }
  }, [activeMdPath, editorReadyPath])

  useEffect(() => {
    const api = window.electronAPI
    if (
      !api ||
      !showPreview ||
      !activeMdPath ||
      editorReadyPath !== activeMdPath
    ) {
      setPreviewHtml('')
      return
    }
    const timer = setTimeout(() => {
      void api
        .previewProjectMarkdown(rootPath, activeMdPath, editorValue)
        .then(setPreviewHtml)
        .catch(() => setPreviewHtml(''))
    }, 280)
    return () => clearTimeout(timer)
  }, [editorValue, activeMdPath, editorReadyPath, rootPath, showPreview])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    return api.onCompileLog((line) => {
      setCompileLogs((prev) => [...prev, line])
    })
  }, [])

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    const api = window.electronAPI
    if (!api || !activeMdPath) return false
    const content = editorRef.current?.getValue() || editorValue
    setSaving(true)
    const res = await api.writeProjectMarkdown(rootPath, activeMdPath, content)
    setSaving(false)
    if (!res.ok) {
      window.alert(res.message ?? t('composer.error.saveFailed'))
      return false
    }
    setEditorValue(content)
    setDirty(false)
    return true
  }, [activeMdPath, editorValue, rootPath, t])

  const handleEditorSave = useCallback(() => {
    if (activeMdPath && !saving) {
      void saveCurrent()
    }
  }, [activeMdPath, saveCurrent, saving])

  useEffect(() => {
    onRegisterTabHandle?.(tab.id, {
      isDirty: () => dirty,
      save: saveCurrent,
    })
    return () => onRegisterTabHandle?.(tab.id, null)
  }, [tab.id, dirty, saveCurrent, onRegisterTabHandle])

  const selectMd = useCallback(
    (mdPath: string) => {
      if (mdPath === activeMdPath) return
      if (dirty) {
        setLeavePrompt({ targetMdPath: mdPath })
        return
      }
      setActiveMdPath(mdPath)
    },
    [activeMdPath, dirty],
  )

  const completeLeavePrompt = useCallback(
    async (action: 'save' | 'discard' | 'cancel') => {
      if (!leavePrompt) return
      const target = leavePrompt.targetMdPath
      if (action === 'cancel') {
        setLeavePrompt(null)
        return
      }
      if (action === 'save') {
        const did = await saveCurrent()
        if (!did) return
      }
      setLeavePrompt(null)
      setActiveMdPath(target)
    },
    [leavePrompt, saveCurrent],
  )

  const jumpToLogLine = useCallback(
    (line: CompileLogLine) => {
      const md = logSourceToMd(line.sourcePath)
      if (!md) return
      if (line.line) {
        pendingRevealLine.current = line.line
      }
      void selectMd(md)
    },
    [selectMd],
  )

  const handleImportResources = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config) return
    const picked = await api.openImportResourcesDialog()
    if (picked.length === 0) return
    const res = await api.importProjectResources(rootPath, config, picked)
    if (!res.ok) {
      window.alert(res.message)
      return
    }
    const snippet = res.markdownSnippets.join('\n')
    setLastImportSnippets(snippet)
    editorRef.current?.insertAtCursor(`\n${snippet}\n`)
    setDirty(true)
  }, [config, rootPath])

  const handleRefreshToc = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config) return
    const res = await api.refreshProjectToc(rootPath, config)
    if (res.ok) {
      setConfig(res.config)
    }
  }, [config, rootPath])

  const handleCompile = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config) return
    if (dirty) {
      const saved = await saveCurrent()
      if (!saved) return
    }
    const compilerStatus = await api.getCompilerStatus()
    if (!compilerStatus.available) {
      await promptCompilerMissing(compilerStatus, t)
      return
    }
    setCompiling(true)
    setCompileLogs([])
    setShowCompile(true)
    const result = await api.compileProject(rootPath, config)
    setCompiling(false)
    if (result.logs.length) {
      setCompileLogs(result.logs)
    }
    if (!result.ok) {
      if (result.error === 'COMPILER_NOT_FOUND') {
        await promptCompilerMissing(await api.getCompilerStatus(), t)
      } else {
        window.alert(result.error)
      }
      return
    }
    if (config.compile?.openAfterCompile !== false) {
      onOpenChm(result.chmPath)
    }
  }, [config, dirty, onOpenChm, rootPath, saveCurrent, t])

  const handleSaveMeta = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config) return
    const res = await api.saveProjectConfig(rootPath, config)
    if (!res.ok) {
      window.alert(res.message ?? t('composer.error.saveFailed'))
      return
    }
    onTabTitleChange?.(tab.id, config.title)
    setMetaOpen(false)
  }, [config, onTabTitleChange, rootPath, tab.id, t])

  const openRenameDialog = useCallback((node: ProjectTocNode) => {
    setRenameNode(node)
    setRenameTitle(node.title)
    setRenameMdPath(node.mdPath ?? '')
    setRenameOpen(true)
  }, [])

  const handleRenameNode = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config || !renameNode) return
    const res = await api.renameProjectTocNode(
      rootPath,
      config,
      renameNode.id,
      renameTitle,
      renameNode.mdPath ? renameMdPath : undefined,
    )
    if (!res.ok) {
      window.alert(res.message)
      return
    }
    const oldPath = activeMdPath
    setConfig(res.config)
    setRenameOpen(false)
    if (renameNode.mdPath && activeMdPath === renameNode.mdPath.replace(/\\/g, '/')) {
      setActiveMdPath(renameMdPath.replace(/\\/g, '/'))
    } else if (oldPath) {
      setActiveMdPath(oldPath)
    }
  }, [activeMdPath, config, renameMdPath, renameNode, renameTitle, rootPath])

  const handleDeleteNode = useCallback(
    async (node: ProjectTocNode) => {
      const api = window.electronAPI
      if (!api || !config) return
      if (!window.confirm(`${t('composer.tree.confirmDelete')}\n${node.title}`)) {
        return
      }
      const res = await api.deleteProjectTocNode(rootPath, config, node.id)
      if (!res.ok) {
        window.alert(res.message)
        return
      }
      setConfig(res.config)
      const deletedNorm = res.deletedMdPaths.map((p) => p.replace(/\\/g, '/'))
      if (activeMdPath && deletedNorm.includes(activeMdPath)) {
        const next = firstMdInToc(res.config.toc)
        setActiveMdPath(next)
        if (!next) {
          setEditorValue('')
          setDirty(false)
        }
      }
    },
    [activeMdPath, config, rootPath, t],
  )

  const handleMoveNode = useCallback(
    async (nodeId: string, placement: TocMovePlacement) => {
      const api = window.electronAPI
      if (!api || !config) return
      const res = await api.moveProjectTocNode(rootPath, config, nodeId, placement)
      if (!res.ok) {
        window.alert(res.message)
        return
      }
      setConfig(res.config)
    },
    [config, rootPath],
  )

  const handleCreatePage = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !config) return
    const title = newPageTitle.trim() || t('composer.newPage.defaultTitle')
    const mdPath = newPagePath.trim().replace(/\\/g, '/')
    if (!/\.md$/i.test(mdPath)) {
      window.alert(t('composer.newPage.pathHint'))
      return
    }
    const res = await api.createProjectPage(rootPath, config, mdPath, title)
    if (!res.ok) {
      window.alert(res.message)
      return
    }
    setConfig(res.config)
    setNewPageOpen(false)
    setNewPageTitle('')
    setNewPagePath('page.md')
    setActiveMdPath(mdPath)
  }, [config, newPagePath, newPageTitle, rootPath, t])

  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-8 text-center text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
        {t('app.loading')}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="truncate text-sm font-medium">{config.title}</span>
        {dirty ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {t('composer.unsaved')}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => setNewPageOpen(true)}>
            <FilePlus className="mr-1 size-3.5" />
            {t('composer.newPage')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleImportResources()}>
            <ImagePlus className="mr-1 size-3.5" />
            {t('composer.importAssets')}
          </Button>
          <Button
            variant={showPreview ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            <Columns2 className="mr-1 size-3.5" />
            {t('composer.preview')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleRefreshToc()}>
            <RefreshCw className="mr-1 size-3.5" />
            {t('composer.refreshToc')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!activeMdPath || saving}
            onClick={() => void saveCurrent()}
          >
            <Save className="mr-1 size-3.5" />
            {t('composer.save')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMetaOpen(true)}>
            <Settings2 className="mr-1 size-3.5" />
            {t('composer.metadata')}
          </Button>
          <Button size="sm" disabled={compiling} onClick={() => void handleCompile()}>
            <Hammer className="mr-1 size-3.5" />
            {compiling ? t('composer.compiling') : t('composer.compile')}
          </Button>
        </div>
      </div>

      {lastImportSnippets ? (
        <p className="shrink-0 border-b border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          {t('composer.importDone')}: <code className="text-foreground">{lastImportSnippets}</code>
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-border/60">
          <p className="border-b border-border/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            {t('composer.files')}
          </p>
          <ProjectTree
            nodes={config.toc}
            activeMdPath={activeMdPath}
            onSelect={(p) => void selectMd(p)}
            onRename={openRenameDialog}
            onDelete={(n) => void handleDeleteNode(n)}
            onMove={(nodeId, placement) => void handleMoveNode(nodeId, placement)}
          />
        </aside>

        <div
          className={cn(
            'flex min-w-0 flex-1',
            showPreview ? 'flex-row' : 'flex-col',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 flex-col',
              showPreview ? 'w-1/2 min-w-0 border-r border-border/60' : 'flex-1',
            )}
          >
            {activeMdPath ? (
              <p className="shrink-0 border-b border-border/40 px-3 py-1.5 text-xs text-muted-foreground">
                {activeMdPath}
              </p>
            ) : null}
            <div className="min-h-0 flex-1">
              {activeMdPath ? (
                editorReadyPath === activeMdPath ? (
                  <ComposerEditor
                    key={activeMdPath}
                    ref={editorRef}
                    filePath={activeMdPath}
                    initialValue={editorValue}
                    onChange={(v) => {
                      setEditorValue(v)
                      setDirty(true)
                    }}
                    onSave={handleEditorSave}
                    loadingLabel={t('app.loading')}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t('app.loading')}
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t('composer.pickFile')}
                </div>
              )}
            </div>
          </div>

          {showPreview && activeMdPath ? (
            <div className="flex w-1/2 min-w-0 flex-col">
              <p className="shrink-0 border-b border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('composer.preview')}
              </p>
              <div className="min-h-0 flex-1">
                <MarkdownPreviewPane html={previewHtml} />
              </div>
            </div>
          ) : null}
        </div>

        {showCompile ? (
          <aside className="flex w-80 shrink-0 flex-col border-l border-border/60">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-xs font-medium">{t('composer.compileLog')}</span>
              <Button variant="ghost" size="sm" onClick={() => setShowCompile(false)}>
                ×
              </Button>
            </div>
            <ul className="flex-1 overflow-y-auto p-2 font-mono text-xs">
              {compileLogs.length === 0 ? (
                <li className="text-muted-foreground">{t('composer.compileLogEmpty')}</li>
              ) : (
                compileLogs.map((line, i) => {
                  const jumpable = Boolean(logSourceToMd(line.sourcePath))
                  return (
                    <li key={`${i}-${line.message}`} className="mb-1">
                      <button
                        type="button"
                        disabled={!jumpable}
                        className={cn(
                          'w-full break-words text-left',
                          jumpable && 'cursor-pointer hover:underline',
                          !jumpable && 'cursor-default',
                          line.level === 'error' && 'text-destructive',
                          line.level === 'warn' && 'text-amber-600 dark:text-amber-400',
                          line.level === 'info' && 'text-muted-foreground',
                        )}
                        onClick={() => jumpable && jumpToLogLine(line)}
                      >
                        {line.message}
                        {line.line != null ? (
                          <span className="ml-1 opacity-70">
                            ({t('composer.logLine')} {line.line})
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </aside>
        ) : null}
      </div>

      <UnsavedChangesDialog
        open={leavePrompt != null}
        onOpenChange={(open) => {
          if (!open) setLeavePrompt(null)
        }}
        descriptionKey="composer.confirmSaveBeforeLeave"
        saveLabelKey="composer.saveAndSwitch"
        onCancel={() => setLeavePrompt(null)}
        onDiscard={() => void completeLeavePrompt('discard')}
        onSave={() => void completeLeavePrompt('save')}
      />

      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('composer.metadata')}</DialogTitle>
            <DialogDescription>{t('composer.metadataHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              {t('project.titleLabel')}
              <Input
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t('composer.meta.author')}
              <Input
                value={config.author ?? ''}
                onChange={(e) => setConfig({ ...config, author: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t('composer.meta.language')}
              <Input
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t('composer.meta.defaultPage')}
              <Input
                value={config.defaultPage}
                onChange={(e) => setConfig({ ...config, defaultPage: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t('composer.meta.assetsDir')}
              <Input
                value={config.assetsDir ?? 'assets'}
                onChange={(e) => setConfig({ ...config, assetsDir: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.compile?.openAfterCompile !== false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    compile: {
                      ...config.compile,
                      openAfterCompile: e.target.checked,
                    },
                  })
                }
              />
              {t('composer.meta.openAfterCompile')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>
              {t('project.cancel')}
            </Button>
            <Button onClick={() => void handleSaveMeta()}>{t('composer.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('composer.tree.rename')}</DialogTitle>
            <DialogDescription>{t('composer.tree.renameHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              placeholder={t('project.titlePlaceholder')}
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
            />
            {renameNode?.mdPath ? (
              <Input
                placeholder="page.md"
                value={renameMdPath}
                onChange={(e) => setRenameMdPath(e.target.value)}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t('project.cancel')}
            </Button>
            <Button onClick={() => void handleRenameNode()}>{t('composer.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('composer.newPage')}</DialogTitle>
            <DialogDescription>{t('composer.newPage.hint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              placeholder={t('project.titlePlaceholder')}
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
            />
            <Input
              placeholder="page.md"
              value={newPagePath}
              onChange={(e) => setNewPagePath(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPageOpen(false)}>
              {t('project.cancel')}
            </Button>
            <Button onClick={() => void handleCreatePage()}>{t('project.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
