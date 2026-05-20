import type {
  PersistedReaderTab,
  PersistedWorkspaceTab,
  WorkspaceSession,
} from '@/shared/electron'
import type { WorkspaceTab } from '@/types/workspace'

export function buildWorkspaceSession(
  screen: 'home' | 'workspace',
  activeTabId: string | null,
  tabs: WorkspaceTab[],
): WorkspaceSession {
  const persisted: PersistedWorkspaceTab[] = tabs.map((tab) => {
    if (tab.kind === 'project') {
      return { kind: 'project', id: tab.id, title: tab.title, path: tab.path }
    }
    const ui = tab.readerUi ?? {
      currentPath: tab.entryInternalPath,
      currentFragment: tab.entryFragment,
      sidePanel: 'toc' as const,
      zoomPercent: 100,
      widthMode: 'fit' as const,
    }
    return {
      kind: 'reader',
      id: tab.id,
      title: tab.title,
      path: tab.path,
      chmTitle: tab.chmTitle,
      currentPath: ui.currentPath,
      currentFragment: ui.currentFragment,
      sidePanel: ui.sidePanel,
      zoomPercent: ui.zoomPercent,
      widthMode: ui.widthMode,
    } satisfies PersistedReaderTab
  })
  return { screen, activeTabId, tabs: persisted }
}
