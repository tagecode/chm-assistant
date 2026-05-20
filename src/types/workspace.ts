import type { ChmTocItem, ReaderSidePanel, ReaderWidthMode } from '@/shared/electron'

export type { ReaderSidePanel, ReaderWidthMode }

export type ReaderUiState = {
  currentPath: string
  currentFragment?: string
  sidePanel: ReaderSidePanel
  zoomPercent: number
  widthMode: ReaderWidthMode
}

export type WorkspaceTab =
  | {
      id: string
      kind: 'reader'
      title: string
      path: string
      chmTitle?: string
      sessionId: string
      entryInternalPath: string
      entryFragment?: string
      toc: ChmTocItem[]
      index: ChmTocItem[]
      /** 运行时 UI 状态（同步到会话持久化） */
      readerUi?: ReaderUiState
    }
  | {
      id: string
      kind: 'project'
      title: string
      path: string
    }
