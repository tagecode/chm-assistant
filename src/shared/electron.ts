import type {
  ChmProjectConfig,
  CompileLogLine,
  CompileProjectResult,
  ProjectLoadError,
  ProjectLoadResult,
  TocMovePlacement,
} from './project'

export type { ChmProjectConfig, CompileLogLine, CompileProjectResult, ProjectLoadResult }

export type ThemeMode = 'system' | 'light' | 'dark' | 'sepia'

/** 界面语言：system 表示跟随操作系统 */
export type LocaleMode = 'system' | 'zh-Hans' | 'zh-Hant' | 'en'

export type RecentEntryType = 'chm' | 'project'

export interface RecentEntry {
  type: RecentEntryType
  path: string
  openedAt: number
}

export interface AppMetadata {
  name: string
  version: string
  electron: string
  chromium: string
  node: string
  platform: string
  arch: string
}

export interface ChmTocItem {
  title: string
  /** 包内路径，不含 #fragment；文件夹节点可无正文 */
  path: string
  fragment?: string
  children?: ChmTocItem[]
}

export interface ChmSearchHit {
  path: string
  title: string
  snippet: string
}

export type ChmOpenResult =
  | {
      ok: true
      path: string
      sessionId: string
      chmTitle: string
      entryInternalPath: string
      /** 默认页的 URL hash（无 # 前缀） */
      entryFragment?: string
      toc: ChmTocItem[]
      index: ChmTocItem[]
    }
  | { ok: false; path: string; code: ChmOpenErrorCode }

export type ChmOpenErrorCode =
  | 'NATIVE_MISSING'
  | 'FS_INVALID'
  | 'OPEN_FAILED'
  | 'ENUM_FAILED'

export type CompilerMessageKey =
  | 'ok.bundled'
  | 'ok.system'
  | 'ok.settings'
  | 'missing.win'
  | 'missing.unix'
  | 'missing.custom'

export interface CompilerStatus {
  available: boolean
  kind: 'hhc' | 'chmcmd' | null
  source: 'bundled' | 'settings' | 'system' | null
  path: string | null
  bundledIncluded: boolean
  installGuideUrl: string | null
  messageKey: CompilerMessageKey
}

export interface AppSettings {
  theme: ThemeMode
  locale: LocaleMode
  /** 阅读器默认字符集提示：auto | utf-8 | gb18030 等 */
  readerEncoding: string
  /** 自定义 CHM 编译器路径；空字符串为自动 */
  chmCompilerPath: string
}

export type ReaderSidePanel = 'toc' | 'index' | 'search' | 'bookmarks'
export type ReaderWidthMode = 'fit' | 'full'

export interface PersistedReaderTab {
  kind: 'reader'
  id: string
  title: string
  path: string
  chmTitle?: string
  currentPath: string
  currentFragment?: string
  sidePanel: ReaderSidePanel
  zoomPercent: number
  widthMode: ReaderWidthMode
}

export interface PersistedProjectTab {
  kind: 'project'
  id: string
  title: string
  path: string
}

export type PersistedWorkspaceTab = PersistedReaderTab | PersistedProjectTab

export interface WorkspaceSession {
  screen: 'home' | 'workspace'
  activeTabId: string | null
  tabs: PersistedWorkspaceTab[]
}

export interface ElectronApi {
  getAppMetadata: () => Promise<AppMetadata>
  getPathsForFileList: (files: File[]) => Promise<string[]>
  getSettings: () => Promise<AppSettings>
  setTheme: (theme: ThemeMode) => Promise<ThemeMode>
  setLocale: (locale: LocaleMode) => Promise<LocaleMode>
  setReaderEncoding: (encoding: string) => Promise<string>
  setChmCompilerPath: (path: string) => Promise<string>
  getCompilerStatus: () => Promise<CompilerStatus>
  pickCompilerDialog: () => Promise<string | null>
  openExternalUrl: (url: string) => Promise<void>
  getRecent: () => Promise<RecentEntry[]>
  addRecent: (entry: Omit<RecentEntry, 'openedAt'>) => Promise<RecentEntry[]>
  clearRecent: () => Promise<void>
  openChmDialog: () => Promise<string | null>
  openProjectDialog: () => Promise<string | null>
  createProjectInDirectory: (
    rootPath: string,
    title: string,
  ) => Promise<{ ok: boolean; error?: string }>
  openChmSession: (filePath: string) => Promise<ChmOpenResult>
  closeChmSession: (sessionId: string) => Promise<void>
  searchChmSession: (
    sessionId: string,
    query: string,
  ) => Promise<ChmSearchHit[]>
  getWorkspaceSession: () => Promise<WorkspaceSession | null>
  setWorkspaceSession: (session: WorkspaceSession | null) => Promise<void>
  onMenuOpenChm: (handler: () => void) => () => void
  loadProject: (rootPath: string) => Promise<ProjectLoadResult | ProjectLoadError>
  saveProjectConfig: (
    rootPath: string,
    config: ChmProjectConfig,
  ) => Promise<{ ok: boolean; message?: string }>
  readProjectMarkdown: (
    rootPath: string,
    mdPath: string,
  ) => Promise<{ ok: boolean; content?: string; message?: string }>
  writeProjectMarkdown: (
    rootPath: string,
    mdPath: string,
    content: string,
  ) => Promise<{ ok: boolean; message?: string }>
  createProjectPage: (
    rootPath: string,
    config: ChmProjectConfig,
    mdPath: string,
    title: string,
  ) => Promise<
    | { ok: true; config: ChmProjectConfig }
    | { ok: false; message: string }
  >
  refreshProjectToc: (
    rootPath: string,
    config: ChmProjectConfig,
  ) => Promise<{ ok: true; config: ChmProjectConfig }>
  compileProject: (
    rootPath: string,
    config: ChmProjectConfig,
  ) => Promise<CompileProjectResult>
  onCompileLog: (handler: (line: CompileLogLine) => void) => () => void
  previewProjectMarkdown: (
    rootPath: string,
    mdPath: string,
    content: string,
  ) => Promise<string>
  openImportResourcesDialog: () => Promise<string[]>
  importProjectResources: (
    rootPath: string,
    config: ChmProjectConfig,
    sourcePaths: string[],
  ) => Promise<
    | { ok: true; paths: string[]; markdownSnippets: string[] }
    | { ok: false; message: string }
  >
  listProjectAssets: (rootPath: string, config: ChmProjectConfig) => Promise<string[]>
  renameProjectTocNode: (
    rootPath: string,
    config: ChmProjectConfig,
    nodeId: string,
    title: string,
    mdPath?: string,
  ) => Promise<
    | { ok: true; config: ChmProjectConfig }
    | { ok: false; message: string }
  >
  deleteProjectTocNode: (
    rootPath: string,
    config: ChmProjectConfig,
    nodeId: string,
  ) => Promise<
    | { ok: true; config: ChmProjectConfig; deletedMdPaths: string[] }
    | { ok: false; message: string }
  >
  moveProjectTocNode: (
    rootPath: string,
    config: ChmProjectConfig,
    nodeId: string,
    placement: TocMovePlacement,
  ) => Promise<
    | { ok: true; config: ChmProjectConfig }
    | { ok: false; message: string }
  >
  readChmPagePlainText: (
    sessionId: string,
    internalPath: string,
  ) => Promise<{ ok: true; text: string } | { ok: false; message: string }>
  openNoticesFile: () => Promise<{ ok: true; path: string } | { ok: false; message: string }>
}
