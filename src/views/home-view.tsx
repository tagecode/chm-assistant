import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { BookOpen, Clock, FolderKanban } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import type { RecentEntry } from '@/shared/electron'
import type { WorkspaceTab } from '@/types/workspace'

interface HomeViewProps {
  recents: RecentEntry[]
  onOpenChmByPath: (filePath: string) => Promise<void>
  onOpenProjectTab: (tab: WorkspaceTab) => void
  onClearRecent: () => void
  onRefreshRecent: () => void
  pendingMenuAction?: 'new-project' | null
  onPendingMenuActionHandled?: () => void
}

export function HomeView({
  recents,
  onOpenChmByPath,
  onOpenProjectTab,
  onClearRecent,
  onRefreshRecent,
  pendingMenuAction,
  onPendingMenuActionHandled,
}: HomeViewProps) {
  const { t } = useI18n()
  const [projectOpen, setProjectOpen] = useState(false)
  const [pickedDir, setPickedDir] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const handleOpenChm = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const picked = await api.openChmDialog()
    if (!picked) return
    await onOpenChmByPath(picked)
  }, [onOpenChmByPath])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      const api = window.electronAPI
      if (!api) return
      const paths = await api.getPathsForFileList([...e.dataTransfer.files])
      const chm = paths.find((p) => p.toLowerCase().endsWith('.chm'))
      if (chm) {
        await onOpenChmByPath(chm)
      }
    },
    [onOpenChmByPath],
  )

  const startNewProject = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const dir = await api.openProjectDialog()
    if (!dir) return
    setPickedDir(dir)
    setProjectTitle(dir.split(/[/\\]/).pop() ?? 'Project')
    setCreateError(null)
    setProjectOpen(true)
  }, [])

  useEffect(() => {
    if (pendingMenuAction !== 'new-project') return
    onPendingMenuActionHandled?.()
    void startNewProject()
  }, [onPendingMenuActionHandled, pendingMenuAction, startNewProject])

  const confirmCreateProject = useCallback(async () => {
    const api = window.electronAPI
    if (!api || !pickedDir) return
    const title = projectTitle.trim() || 'Untitled'
    const result = await api.createProjectInDirectory(pickedDir, title)
    if (!result.ok) {
      setCreateError(t('project.errorExists'))
      return
    }
    await api.addRecent({ type: 'project', path: pickedDir })
    onRefreshRecent()
    setProjectOpen(false)
    onOpenProjectTab({
      id: crypto.randomUUID(),
      kind: 'project',
      title,
      path: pickedDir,
    })
  }, [pickedDir, projectTitle, onOpenProjectTab, onRefreshRecent, t])

  const openRecent = useCallback(
    async (item: RecentEntry) => {
      const api = window.electronAPI
      if (!api) return
      if (item.type === 'chm') {
        await onOpenChmByPath(item.path)
        return
      }
      const title = item.path.split(/[/\\]/).pop() ?? 'Project'
      onOpenProjectTab({
        id: crypto.randomUUID(),
        kind: 'project',
        title,
        path: item.path,
      })
    },
    [onOpenChmByPath, onOpenProjectTab],
  )

  const openExistingProject = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const dir = await api.openProjectDialog()
    if (!dir) return
    await api.addRecent({ type: 'project', path: dir })
    onRefreshRecent()
    const title = dir.split(/[/\\]/).pop() ?? 'Project'
    onOpenProjectTab({
      id: crypto.randomUUID(),
      kind: 'project',
      title,
      path: dir,
    })
  }, [onOpenProjectTab, onRefreshRecent])

  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col gap-10 px-6 py-12"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void handleDrop(e)}
    >
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">{t('home.welcome')}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {t('app.title')}
        </h1>
        <p className="text-muted-foreground">{t('app.motto')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className="cursor-pointer border-border/80 transition hover:border-primary/40 hover:shadow-md"
          onClick={() => void handleOpenChm()}
        >
          <CardHeader>
            <BookOpen className="mb-2 size-8 text-primary" />
            <CardTitle>{t('home.openChm')}</CardTitle>
            <CardDescription>{t('home.openChmDesc')}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-border/80 transition hover:border-primary/40 hover:shadow-md">
          <CardHeader>
            <FolderKanban className="mb-2 size-8 text-primary" />
            <CardTitle>{t('home.newProject')}</CardTitle>
            <CardDescription>{t('home.newProjectDesc')}</CardDescription>
          </CardHeader>
          <CardFooter className="gap-2 pt-0">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => void startNewProject()}
            >
              {t('home.newProjectAction')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => void openExistingProject()}
            >
              {t('home.openProjectAction')}
            </Button>
          </CardFooter>
        </Card>
        <Card
          className="cursor-pointer border-border/80 transition hover:border-primary/40 hover:shadow-md"
          onClick={() =>
            document.getElementById('home-recent')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        >
          <CardHeader>
            <Clock className="mb-2 size-8 text-primary" />
            <CardTitle>{t('home.recent')}</CardTitle>
            <CardDescription>{t('home.recentDesc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">{t('home.dropHint')}</p>

      <section id="home-recent" className="scroll-mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" />
            {t('home.recent')}
          </div>
          {recents.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void onClearRecent()}>
              {t('home.clearRecent')}
            </Button>
          ) : null}
        </div>
        {recents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
            {t('home.recentEmpty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {recents.map((item) => (
              <li key={`${item.type}-${item.path}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left text-sm transition hover:bg-card"
                  onClick={() => void openRecent(item)}
                >
                  <span className="truncate font-medium">{item.path}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.type === 'chm' ? 'CHM' : 'Project'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('project.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('project.dialogHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="proj-title">
              {t('project.titleLabel')}
            </label>
            <Input
              id="proj-title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder={t('project.titlePlaceholder')}
            />
            {pickedDir ? (
              <p className="break-all text-xs text-muted-foreground">{pickedDir}</p>
            ) : null}
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProjectOpen(false)}>
              {t('project.cancel')}
            </Button>
            <Button onClick={() => void confirmCreateProject()}>{t('project.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
