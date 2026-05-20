import type { AppSettings, RecentEntry, ThemeMode, WorkspaceSession } from '../src/shared/electron'

export interface PersistedState extends AppSettings {
  recent: RecentEntry[]
  workspace: WorkspaceSession | null
}

export const storeDefaults: PersistedState = {
  theme: 'system' as ThemeMode,
  locale: 'system',
  readerEncoding: 'auto',
  /** 空字符串表示自动检测（Unix 优先内置 chmcmd） */
  chmCompilerPath: '',
  recent: [],
  workspace: null,
}
